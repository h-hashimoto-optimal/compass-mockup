// ASIN取得グループ（拡張1回分）。受信トレイの管理単位。RLS対象（ingest_batches/channel_listings）。
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { withTenant } from '@/lib/db';
import { ingestBatches, channelListings, sourceProducts } from '@/lib/db/schema';

export async function createBatch(
  tenantId: string,
  input: { source?: string; query?: string | null; url?: string | null; capturedAt?: string | null; itemCount?: number },
) {
  return withTenant(tenantId, async (tx) => {
    const [b] = await tx
      .insert(ingestBatches)
      .values({
        tenantId,
        source: input.source ?? 'amazon',
        query: input.query ?? null,
        url: input.url ?? null,
        capturedAt: input.capturedAt ? new Date(input.capturedAt) : null,
        itemCount: input.itemCount ?? 0,
      })
      .returning();
    return b;
  });
}

// グループ一覧（各グループの総数/未処理[draft]/進行[draft以外]を集計）＋ グループ外draftの擬似グループ。
export async function listBatches(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const res = await tx.execute(sql`
      SELECT b.id, b.query, b.source, b.url, b.captured_at AS "capturedAt", b.created_at AS "createdAt",
             COUNT(cl.id)::int AS total,
             COUNT(cl.id) FILTER (WHERE cl.status = 'draft')::int AS drafts,
             COUNT(cl.id) FILTER (WHERE cl.status <> 'draft')::int AS advanced,
             COUNT(cl.id) FILTER (WHERE cl.status = 'submitted' AND cl.coupang_approval_status IN ('approved','partial_approved') AND (cl.coupang_sales_status = 'on_sale' OR cl.coupang_sales_status IS NULL))::int AS selling
      FROM ingest_batches b
      LEFT JOIN channel_listings cl ON cl.ingest_batch_id = b.id AND cl.deleted_at IS NULL
      WHERE b.tenant_id = ${tenantId}
      GROUP BY b.id
      ORDER BY b.created_at DESC
    `);
    const batches = (res.rows as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      query: (r.query as string | null) ?? null,
      source: r.source as string,
      url: (r.url as string | null) ?? null,
      capturedAt: (r.capturedAt as string | null) ?? null,
      createdAt: r.createdAt as string,
      total: Number(r.total),
      drafts: Number(r.drafts),
      advanced: Number(r.advanced),
      selling: Number(r.selling),
    }));

    // グループ外（手動追加など batch_id null）の draft を擬似グループとして先頭に
    const [orphan] = (
      await tx.execute(sql`
        SELECT COUNT(*)::int AS n FROM channel_listings
        WHERE tenant_id = ${tenantId} AND ingest_batch_id IS NULL AND status = 'draft' AND deleted_at IS NULL
      `)
    ).rows as unknown as Array<{ n: number }>;
    const orphanN = Number(orphan?.n ?? 0);
    if (orphanN > 0) {
      batches.unshift({
        id: 'none',
        query: '（グループ外・手動追加）',
        source: 'manual',
        url: null,
        capturedAt: null,
        createdAt: new Date().toISOString(),
        total: orphanN,
        drafts: orphanN,
        advanced: 0,
        selling: 0,
      });
    }
    return batches;
  });
}

// グループ内のアイテム（仕入元情報＋スクレイプ画像を結合）。batchId='none' はグループ外draft。
export async function listBatchItems(tenantId: string, batchId: string) {
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .select({
        id: channelListings.id,
        status: channelListings.status,
        coupangApprovalStatus: channelListings.coupangApprovalStatus,
        coupangSalesStatus: channelListings.coupangSalesStatus,
        titleJa: channelListings.titleJa,
        titleTranslated: channelListings.titleTranslated,
        listPrice: channelListings.listPrice,
        listCurrency: channelListings.listCurrency,
        source: sourceProducts.source,
        sourceProductId: sourceProducts.sourceProductId,
        sourcePriceJpy: sourceProducts.lastPriceJpy,
        sourceInStock: sourceProducts.lastInStock,
        sourceRaw: sourceProducts.raw,
        createdAt: channelListings.createdAt,
      })
      .from(channelListings)
      .innerJoin(sourceProducts, eq(channelListings.sourceProductId, sourceProducts.id))
      .where(
        and(
          eq(channelListings.tenantId, tenantId),
          batchId === 'none'
            ? isNull(channelListings.ingestBatchId)
            : eq(channelListings.ingestBatchId, batchId),
          isNull(channelListings.deletedAt),
        ),
      )
      .orderBy(desc(channelListings.createdAt)),
  );
  return rows.map((r) => {
    const raw = (r.sourceRaw ?? {}) as { imageUrls?: string[] };
    return {
      id: r.id,
      status: r.status,
      coupangApprovalStatus: r.coupangApprovalStatus,
      coupangSalesStatus: r.coupangSalesStatus,
      titleJa: r.titleJa,
      titleTranslated: r.titleTranslated,
      listPrice: r.listPrice,
      listCurrency: r.listCurrency,
      source: r.source,
      sourceProductId: r.sourceProductId,
      sourcePriceJpy: r.sourcePriceJpy,
      sourceInStock: r.sourceInStock,
      image: raw.imageUrls?.[0] ?? null,
    };
  });
}
