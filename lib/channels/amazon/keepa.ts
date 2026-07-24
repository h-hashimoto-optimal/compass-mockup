// Keepa 商品API（最小）。KEEPA_API_KEY があれば ASIN の現行価格/在庫を取得。無ければ null（＝クロール不可）。
// domain=5 = Amazon.co.jp。プラットフォーム鍵（env）で全社共通の source_products をクロールする想定。
// ⚠️ 価格の単位・在庫判定は Keepa 仕様に依存＝実キーで要検証（JPYが ×100 の可能性、stats.current の index 等）。
export type SourceLatest = { priceJpy: number | null; inStock: boolean | null };

export async function fetchKeepaLatest(asin: string): Promise<SourceLatest | null> {
  const key = process.env.KEEPA_API_KEY;
  if (!key) return null;

  const url =
    `https://api.keepa.com/product?key=${key}&domain=5` +
    `&asin=${encodeURIComponent(asin)}&stats=1&history=0`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const j = (await res.json()) as {
    products?: Array<{ stats?: { current?: number[] }; availabilityAmazon?: number }>;
  };
  const p = (j.products ?? [])[0];
  if (!p) return null;

  // stats.current の index: 0=AMAZON, 1=NEW。-1 はデータなし/在庫なし。正の最初の値を採用。
  const cur = p.stats?.current ?? [];
  const raw = [cur[0], cur[1]].find((v) => typeof v === 'number' && v > 0);
  const priceJpy = raw != null ? Math.round(raw) : null;
  const inStock = priceJpy != null;
  return { priceJpy, inStock };
}
