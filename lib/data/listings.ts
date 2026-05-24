// テナント・スコープのデータアクセス層（仕入商品→出品）。
// channel_listings は RLS 対象 → withTenant 経由（app.current_tenant をセット）。
// アプリ層でも tenant_id で絞り、soft-delete(deleted_at IS NULL) を強制する＝二重の漏洩防止。
import { and, desc, eq, isNull, ne, or, ilike, inArray, count } from 'drizzle-orm';
import { withTenant } from '@/lib/db';
import { sourceProducts, channelListings, ingestBatches } from '@/lib/db/schema';
import { isBlacklisted } from '@/lib/data/lists';
import { listingGroup, type ListingGroup } from '@/lib/listing-status';

export type IngestInput = {
  source: string; // amazon / rakuten / yahoo / mercari
  sourceProductId: string; // ASIN 等
  channel: string; // coupang / naver / 11st
  url?: string | null;
  titleJa?: string | null;
  priceJpy?: number | null;
  brand?: string | null; // 拡張がスクレイプした実ブランド
  imageUrl?: string | null; // 拡張がスクレイプした実メイン画像
  ingestBatchId?: string | null; // 取得グループ
};

// 仕入元商品を upsert（全社共通・重複排除）し、テナントの出品(draft)を作る/既存を返す。
// テナントの仕入ブラックリスト該当は取込せず blocked を返す。
export async function ingestListing(tenantId: string, input: IngestInput) {
  if (await isBlacklisted(tenantId, input.source, input.sourceProductId)) {
    return { blocked: true as const };
  }

  // 拡張がスクレイプした実ブランド/画像を raw に退避（処理時の hint として使い、実データを維持）
  const scraped =
    input.brand || input.imageUrl
      ? { brand: input.brand ?? null, imageUrls: input.imageUrl ? [input.imageUrl] : [], scraped: true }
      : null;

  return withTenant(tenantId, async (tx) => {
    const [sp] = await tx
      .insert(sourceProducts)
      .values({
        source: input.source,
        sourceProductId: input.sourceProductId,
        url: input.url ?? null,
        lastPriceJpy: input.priceJpy ?? null,
        ...(scraped ? { raw: scraped } : {}),
      })
      .onConflictDoUpdate({
        target: [sourceProducts.source, sourceProducts.sourceProductId],
        set: {
          url: input.url ?? null,
          lastPriceJpy: input.priceJpy ?? null,
          ...(scraped ? { raw: scraped } : {}),
        },
      })
      .returning();

    const existing = await tx
      .select()
      .from(channelListings)
      .where(
        and(
          eq(channelListings.tenantId, tenantId),
          eq(channelListings.sourceProductId, sp.id),
          eq(channelListings.channel, input.channel),
          isNull(channelListings.deletedAt),
        ),
      )
      .limit(1);
    if (existing[0]) return { blocked: false as const, listing: existing[0], created: false };

    const [listing] = await tx
      .insert(channelListings)
      .values({
        tenantId,
        sourceProductId: sp.id,
        channel: input.channel,
        titleJa: input.titleJa ?? null,
        sourcePriceJpyAtList: input.priceJpy ?? null,
        ingestBatchId: input.ingestBatchId ?? null,
      })
      .returning();
    return { blocked: false as const, listing, created: true };
  });
}

function toIntOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

// 出品の個別編集（テナント・スコープ＋soft-delete除外）。編集可能列のみ。
export async function updateListing(
  tenantId: string,
  id: string,
  fields: Record<string, unknown>,
) {
  const set: Record<string, unknown> = {};
  if ('titleJa' in fields) set.titleJa = fields.titleJa == null ? null : String(fields.titleJa);
  if ('titleTranslated' in fields)
    set.titleTranslated = fields.titleTranslated == null ? null : String(fields.titleTranslated);
  if ('listPrice' in fields) set.listPrice = toIntOrNull(fields.listPrice);
  if ('floorPriceJpy' in fields) set.floorPriceJpy = toIntOrNull(fields.floorPriceJpy);
  if ('marginOverride' in fields) {
    const v = Number(fields.marginOverride);
    set.marginOverride =
      fields.marginOverride == null || fields.marginOverride === '' || !Number.isFinite(v)
        ? null
        : Math.min(Math.max(v, 0), 0.9).toFixed(4);
  }
  if ('coupangCategoryCode' in fields) set.coupangCategoryCode = toIntOrNull(fields.coupangCategoryCode);
  if ('coupangCategoryName' in fields)
    set.coupangCategoryName = fields.coupangCategoryName == null || fields.coupangCategoryName === '' ? null : String(fields.coupangCategoryName);
  if (Object.keys(set).length === 0) return null;

  return withTenant(tenantId, async (tx) => {
    const [updated] = await tx
      .update(channelListings)
      .set(set)
      .where(
        and(
          eq(channelListings.id, id),
          eq(channelListings.tenantId, tenantId),
          isNull(channelListings.deletedAt),
          // 送信済み（却下以外のsubmitted）は編集不可＝Coupang連携内容とのズレを防ぐ
          or(ne(channelListings.status, 'submitted'), eq(channelListings.coupangApprovalStatus, 'rejected')),
        ),
      )
      .returning();
    return updated ?? null;
  });
}

// 出品の論理削除（soft-delete）。部分ユニークにより同一仕入を再出品できる。
export async function softDeleteListing(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    const [updated] = await tx
      .update(channelListings)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(channelListings.id, id),
          eq(channelListings.tenantId, tenantId),
          isNull(channelListings.deletedAt),
        ),
      )
      .returning();
    return !!updated;
  });
}

// テナントの出品1件（仕入元情報を結合・soft-delete除外）。他テナント/不存在はnull。
export async function getTenantListing(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    const [row] = await tx
      .select({
        id: channelListings.id,
        channel: channelListings.channel,
        status: channelListings.status,
        coupangApprovalStatus: channelListings.coupangApprovalStatus,
        coupangSalesStatus: channelListings.coupangSalesStatus,
        titleJa: channelListings.titleJa,
        titleTranslated: channelListings.titleTranslated,
        listPrice: channelListings.listPrice,
        listCurrency: channelListings.listCurrency,
        floorPriceJpy: channelListings.floorPriceJpy,
        marginOverride: channelListings.marginOverride,
        coupangCategoryCode: channelListings.coupangCategoryCode,
        coupangCategoryName: channelListings.coupangCategoryName,
        rejectedReason: channelListings.rejectedReason,
        source: sourceProducts.source,
        sourceProductId: sourceProducts.sourceProductId,
        sourceUrl: sourceProducts.url,
        sourcePriceJpy: sourceProducts.lastPriceJpy,
        sourceInStock: sourceProducts.lastInStock,
        sourceRaw: sourceProducts.raw,
        sourceCheckedAt: sourceProducts.lastCheckedAt,
        batchQuery: ingestBatches.query,
        batchCapturedAt: ingestBatches.capturedAt,
        createdAt: channelListings.createdAt,
        updatedAt: channelListings.updatedAt,
      })
      .from(channelListings)
      .innerJoin(sourceProducts, eq(channelListings.sourceProductId, sourceProducts.id))
      .leftJoin(ingestBatches, eq(channelListings.ingestBatchId, ingestBatches.id))
      .where(
        and(
          eq(channelListings.id, id),
          eq(channelListings.tenantId, tenantId),
          isNull(channelListings.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  });
}

// テナントの出品一覧（仕入元情報を結合・soft-delete除外）。サムネイル画像も付与。
export async function listTenantListings(tenantId: string) {
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .select({
        id: channelListings.id,
        channel: channelListings.channel,
        status: channelListings.status,
        coupangApprovalStatus: channelListings.coupangApprovalStatus,
        coupangSalesStatus: channelListings.coupangSalesStatus,
        titleJa: channelListings.titleJa,
        titleTranslated: channelListings.titleTranslated,
        listPrice: channelListings.listPrice,
        listCurrency: channelListings.listCurrency,
        floorPriceJpy: channelListings.floorPriceJpy,
        source: sourceProducts.source,
        sourceProductId: sourceProducts.sourceProductId,
        sourcePriceJpy: sourceProducts.lastPriceJpy,
        sourceInStock: sourceProducts.lastInStock,
        sourceRaw: sourceProducts.raw,
        batchQuery: ingestBatches.query,
        batchCapturedAt: ingestBatches.capturedAt,
        createdAt: channelListings.createdAt,
      })
      .from(channelListings)
      .innerJoin(sourceProducts, eq(channelListings.sourceProductId, sourceProducts.id))
      .leftJoin(ingestBatches, eq(channelListings.ingestBatchId, ingestBatches.id))
      .where(and(eq(channelListings.tenantId, tenantId), isNull(channelListings.deletedAt)))
      .orderBy(desc(channelListings.createdAt)),
  );
  return rows.map((r) => {
    const raw = (r.sourceRaw ?? {}) as { imageUrls?: string[] };
    const { sourceRaw: _omit, ...rest } = r;
    void _omit;
    return { ...rest, image: raw.imageUrls?.[0] ?? null };
  });
}

// 群（フィルタ）→SQL条件。listingGroup と論理を一致させる。
function groupCondition(group: ListingGroup) {
  const st = channelListings.status;
  const ap = channelListings.coupangApprovalStatus;
  const sl = channelListings.coupangSalesStatus;
  switch (group) {
    case 'draft':
      return eq(st, 'draft');
    case 'ready':
      return eq(st, 'ready');
    case 'review':
      return and(eq(st, 'submitted'), or(isNull(ap), eq(ap, 'requested')));
    case 'selling':
      return and(eq(st, 'submitted'), inArray(ap, ['approved', 'partial_approved']), or(isNull(sl), eq(sl, 'on_sale')));
    case 'attention':
      return or(
        eq(st, 'error'),
        and(eq(st, 'submitted'), inArray(ap, ['rejected', 'deleted'])),
        and(eq(st, 'submitted'), inArray(sl, ['suspended', 'soldout'])),
      );
  }
}

const LIST_COLS = {
  id: channelListings.id,
  channel: channelListings.channel,
  status: channelListings.status,
  coupangApprovalStatus: channelListings.coupangApprovalStatus,
  coupangSalesStatus: channelListings.coupangSalesStatus,
  titleJa: channelListings.titleJa,
  titleTranslated: channelListings.titleTranslated,
  listPrice: channelListings.listPrice,
  listCurrency: channelListings.listCurrency,
  floorPriceJpy: channelListings.floorPriceJpy,
  source: sourceProducts.source,
  sourceProductId: sourceProducts.sourceProductId,
  sourcePriceJpy: sourceProducts.lastPriceJpy,
  sourceInStock: sourceProducts.lastInStock,
  sourceRaw: sourceProducts.raw,
  batchQuery: ingestBatches.query,
  batchCapturedAt: ingestBatches.capturedAt,
  createdAt: channelListings.createdAt,
} as const;

// 検索＋群フィルタ＋ページング。件数（群別カウント＋総数）も返す。
export async function queryListings(
  tenantId: string,
  opts: { q?: string; group?: ListingGroup | 'all'; page?: number; pageSize?: number },
) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
  const q = (opts.q ?? '').trim();
  const search = q
    ? or(
        ilike(sourceProducts.sourceProductId, `%${q}%`),
        ilike(channelListings.titleJa, `%${q}%`),
        ilike(channelListings.titleTranslated, `%${q}%`),
        ilike(ingestBatches.query, `%${q}%`),
      )
    : undefined;
  const base = and(eq(channelListings.tenantId, tenantId), isNull(channelListings.deletedAt), search);
  const gc = opts.group && opts.group !== 'all' ? groupCondition(opts.group) : undefined;
  const where = gc ? and(base, gc) : base;

  return withTenant(tenantId, async (tx) => {
    // 群別カウント（検索条件込み・群フィルタ無し）
    const countRows = await tx
      .select({ status: channelListings.status, ap: channelListings.coupangApprovalStatus, sl: channelListings.coupangSalesStatus, n: count() })
      .from(channelListings)
      .innerJoin(sourceProducts, eq(channelListings.sourceProductId, sourceProducts.id))
      .leftJoin(ingestBatches, eq(channelListings.ingestBatchId, ingestBatches.id))
      .where(base)
      .groupBy(channelListings.status, channelListings.coupangApprovalStatus, channelListings.coupangSalesStatus);
    const counts = { all: 0, draft: 0, ready: 0, review: 0, selling: 0, attention: 0 };
    for (const r of countRows) {
      const g = listingGroup({ status: r.status, coupangApprovalStatus: r.ap, coupangSalesStatus: r.sl });
      counts[g] += Number(r.n);
      counts.all += Number(r.n);
    }

    const [tot] = await tx
      .select({ n: count() })
      .from(channelListings)
      .innerJoin(sourceProducts, eq(channelListings.sourceProductId, sourceProducts.id))
      .leftJoin(ingestBatches, eq(channelListings.ingestBatchId, ingestBatches.id))
      .where(where);
    const total = Number(tot?.n ?? 0);

    const rows = await tx
      .select(LIST_COLS)
      .from(channelListings)
      .innerJoin(sourceProducts, eq(channelListings.sourceProductId, sourceProducts.id))
      .leftJoin(ingestBatches, eq(channelListings.ingestBatchId, ingestBatches.id))
      .where(where)
      .orderBy(desc(channelListings.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const items = rows.map((r) => {
      const raw = (r.sourceRaw ?? {}) as { imageUrls?: string[] };
      const { sourceRaw: _omit, ...rest } = r;
      void _omit;
      return { ...rest, image: raw.imageUrls?.[0] ?? null };
    });

    return { items, total, counts, page, pageSize };
  });
}
