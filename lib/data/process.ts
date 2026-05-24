// 出品パイプライン（mock/dry-run）：仕入元取得→翻訳→価格/floor算出→listingsへ保存。
// 実キーが無ければ各アダプタはmockを返す（SP-API/DeepL）。まずは Amazon→Coupang のみ。
import { and, eq, isNull } from 'drizzle-orm';
import { db, withTenant } from '@/lib/db';
import {
  channelListings,
  sourceProducts,
  tenantSettings,
  tenantChannelSettings,
  fxRates,
} from '@/lib/db/schema';
import { fetchAmazonProduct } from '@/lib/channels/amazon/sp-api';
import { translateJaToKo } from '@/lib/translation/translate';
import { computeListingPricing } from './pricing';
import { listNgWords, applyNgWords } from '@/lib/data/lists';
import { resolveShippingFee } from '@/lib/shipping';
import { DEFAULTS } from '@/lib/constants';

const num = (v: unknown, d: number) => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : d;
};

async function getFxJpyToKrw(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const [r] = await db.select().from(fxRates).where(eq(fxRates.date, today)).limit(1);
  return r?.jpyToKrw ? num(r.jpyToKrw, DEFAULTS.fxJpyToKrw) : DEFAULTS.fxJpyToKrw;
}

// テナントの出品1件を処理（mock）。channel_listings は RLS 対象 → withTenant 経由。
export async function processListing(tenantId: string, listingId: string) {
  return withTenant(tenantId, async (tx) => {
  const [row] = await tx
    .select({
      id: channelListings.id,
      channel: channelListings.channel,
      status: channelListings.status,
      coupangApprovalStatus: channelListings.coupangApprovalStatus,
      marginOverride: channelListings.marginOverride,
      weightGOverride: channelListings.weightGOverride,
      titleJa: channelListings.titleJa,
      sourceRowId: sourceProducts.id,
      source: sourceProducts.source,
      sourceProductId: sourceProducts.sourceProductId,
      sourcePriceJpy: sourceProducts.lastPriceJpy,
      sourceRaw: sourceProducts.raw,
    })
    .from(channelListings)
    .innerJoin(sourceProducts, eq(channelListings.sourceProductId, sourceProducts.id))
    .where(
      and(
        eq(channelListings.id, listingId),
        eq(channelListings.tenantId, tenantId),
        isNull(channelListings.deletedAt),
      ),
    )
    .limit(1);
  if (!row) throw new Error('NOT_FOUND');
  // 審査中・販売中（却下以外のsubmitted）は再処理不可＝Coupang連携済みの内容を壊さない
  if (row.status === 'submitted' && row.coupangApprovalStatus !== 'rejected') {
    throw new Error('NOT_PROCESSABLE');
  }

  // 1. 仕入元から取得（ソース別アダプタ。今はamazonのみ）。
  //    拡張がスクレイプ済みの実データ（価格/画像/ブランド）をhintで渡し、mockでも実値を維持する。
  if (row.source !== 'amazon') throw new Error('UNSUPPORTED_SOURCE');
  const scraped = (row.sourceRaw ?? {}) as { brand?: string | null; imageUrls?: string[] };
  const detail = await fetchAmazonProduct(row.sourceProductId, {
    title: row.titleJa ?? undefined,
    priceJpy: row.sourcePriceJpy ?? undefined,
    brand: scraped.brand ?? undefined,
    imageUrl: scraped.imageUrls?.[0],
  });

  // 2. 仕入元の最新状態を更新（＝外部データのキャッシュ更新）
  await tx
    .update(sourceProducts)
    .set({
      lastPriceJpy: detail.priceJpy ?? null,
      lastInStock: detail.inStock,
      lastCheckedAt: new Date(),
      raw: detail as unknown as Record<string, unknown>,
    })
    .where(eq(sourceProducts.id, row.sourceRowId));

  // 3. 翻訳（日→韓）→ テナントの禁止ワードを適用（block=除去 / replace=置換）
  const tr = await translateJaToKo(detail.title);
  const ngWordList = await listNgWords(tenantId);
  const ng = applyNgWords(tr.ko, ngWordList);

  // 4. 設定（仕入側＋チャネル側）。無ければ既定値。
  const [ts] = await tx
    .select()
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);
  const [cs] = await tx
    .select()
    .from(tenantChannelSettings)
    .where(
      and(eq(tenantChannelSettings.tenantId, tenantId), eq(tenantChannelSettings.channel, row.channel)),
    )
    .limit(1);
  const fxRate = await getFxJpyToKrw();

  // 重量(g)＝個別上書き優先→取得値。重量別の国際配送料をテナントの料金表から算出。
  const weightG = row.weightGOverride != null ? row.weightGOverride : detail.weightG ?? null;
  const intlShippingJpy = resolveShippingFee(weightG, (ts?.shippingRatesJson as unknown as []) ?? []);

  // 5. 価格＋赤字下限
  const { listPrice, floorPriceJpy } = computeListingPricing(detail.priceJpy ?? 0, {
    // 商品個別の利益率上書きがあれば優先、無ければテナント既定
    marginRate: row.marginOverride != null ? num(row.marginOverride, DEFAULTS.marginRate) : num(ts?.marginRate, DEFAULTS.marginRate),
    fxBuffer: num(ts?.fxBuffer, DEFAULTS.fxBuffer),
    domesticShippingJpy: num(ts?.domesticShippingJpy, DEFAULTS.domesticShippingJpy),
    intlShippingJpy,
    sellFeeRate: num(cs?.sellFeeRate, DEFAULTS.sellFeeRate[row.channel as keyof typeof DEFAULTS.sellFeeRate] ?? 0.11),
    priceRounding: num(cs?.priceRounding, DEFAULTS.priceRoundingKrw),
    fxRate,
  });

  // 6. 出品に反映
  const [updated] = await tx
    .update(channelListings)
    .set({
      titleJa: detail.title,
      titleTranslated: ng.text,
      listPrice,
      listCurrency: cs?.currency ?? 'KRW',
      sourcePriceJpyAtList: detail.priceJpy ?? null,
      floorPriceJpy,
      status: 'ready', // 翻訳・価格計算済み＝送信待ち（まだCoupang未送信）
    })
    .where(eq(channelListings.id, listingId))
    .returning();
  return updated;
  });
}
