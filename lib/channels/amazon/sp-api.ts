// Amazon SP-API ラッパ。
// 実キーが env で設定されていれば本番呼出、無ければモックデータを返す。
//
// 必要env:
//   AMAZON_SP_API_REFRESH_TOKEN
//   AMAZON_SP_API_LWA_CLIENT_ID
//   AMAZON_SP_API_LWA_CLIENT_SECRET
//   AMAZON_SP_API_AWS_ACCESS_KEY
//   AMAZON_SP_API_AWS_SECRET_KEY
//   AMAZON_SP_API_MARKETPLACE_ID (デフォルト A1VC38T7YXB528 = JP)
//
// 本番実装の参考:
//   https://developer-docs.amazon.com/sp-api/

export type AmazonProductDetail = {
  asin: string;
  title: string;
  brand: string | null;
  manufacturer: string | null;
  imageUrls: string[]; // メイン+サブ
  bulletPoints: string[];
  description: string;
  category: string | null;
  priceJpy: number | null;
  weightG: number | null; // 商品重量（g）。配送料計算に使用
  inStock: boolean;
  fetchedAt: string;
  source: 'mock' | 'sp-api';
};

const HAS_REAL_CREDS = Boolean(
  process.env.AMAZON_SP_API_REFRESH_TOKEN &&
    process.env.AMAZON_SP_API_LWA_CLIENT_ID &&
    process.env.AMAZON_SP_API_LWA_CLIENT_SECRET,
);

/**
 * ASINから商品詳細を取得。
 * Hint: Chrome拡張から既に取れている title/brand/priceJpy/imageUrl を渡すと
 * モックモードでもそれを優先して埋める（より現実的なペイロードになる）。
 */
export async function fetchAmazonProduct(
  asin: string,
  hint?: {
    title?: string;
    brand?: string;
    priceJpy?: number | null;
    imageUrl?: string;
  },
): Promise<AmazonProductDetail> {
  if (HAS_REAL_CREDS) {
    return fetchFromSpApi(asin);
  }
  return mockFetch(asin, hint);
}

async function fetchFromSpApi(asin: string): Promise<AmazonProductDetail> {
  // TODO: 実装時はSP-API GetCatalogItem + GetItemOffers を呼び出す
  // 現状はキー設定済みの場合でも未実装エラーで明示的に倒す
  throw new Error(
    'SP-API real implementation not yet wired. Remove env vars to use mock mode.',
  );
}

function mockFetch(
  asin: string,
  hint?: {
    title?: string;
    brand?: string;
    priceJpy?: number | null;
    imageUrl?: string;
  },
): AmazonProductDetail {
  const title = hint?.title ?? `Amazon商品 (${asin})`;
  const brand = hint?.brand ?? guessBrandFromTitle(title) ?? 'NoBrand';
  const priceJpy =
    hint?.priceJpy ?? deterministicPrice(asin); // ASIN由来の擬似価格

  return {
    asin,
    title,
    brand,
    manufacturer: brand,
    imageUrls: [
      hint?.imageUrl || `https://picsum.photos/seed/${asin}/600/600`,
      `https://picsum.photos/seed/${asin}-2/600/600`,
      `https://picsum.photos/seed/${asin}-3/600/600`,
    ],
    bulletPoints: [
      `${brand} 公式 / 日本国内正規流通品`,
      '当日発送可能（営業日）',
      '初期不良時は無償交換',
    ],
    description: `【${brand}】${title}\n\n日本国内で広く流通している人気商品。当日発送可能。`,
    category: guessCategory(title),
    priceJpy,
    weightG: deterministicWeight(asin),
    inStock: true,
    fetchedAt: new Date().toISOString(),
    source: 'mock',
  };
}

function deterministicPrice(asin: string): number {
  const sum = asin.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  return 980 + (sum % 50) * 100; // 980〜5,880円
}

function deterministicWeight(asin: string): number {
  const sum = asin.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  return 100 + (sum % 30) * 100; // 100〜3,000g（mock。SP-API実装後は実重量）
}

function guessBrandFromTitle(title: string): string | null {
  const known = [
    'Anker',
    'Sony',
    'Nike',
    'Pokemon',
    'UNIQLO',
    'MUJI',
    'KALDI',
    'SHARP',
  ];
  for (const b of known) if (title.toLowerCase().includes(b.toLowerCase())) return b;
  return null;
}

function guessCategory(title: string): string {
  const t = title.toLowerCase();
  if (/(headphone|スピーカー|イヤホン|オーディオ)/.test(t)) return '家電 / オーディオ';
  if (/(モバイルバッテリー|charger|充電器|ケーブル)/.test(t))
    return '家電 / モバイルアクセサリ';
  if (/(シューズ|スニーカー|ブーツ|sneakers)/.test(t)) return 'シューズ';
  if (/(コーヒー|coffee|お茶|食品)/.test(t)) return '食品 / 飲料';
  if (/(ヒートテック|シャツ|tシャツ|ユニクロ)/.test(t))
    return 'アパレル / インナー';
  if (/(ぬいぐるみ|フィギュア|プラモ|toy)/.test(t)) return 'おもちゃ / ホビー';
  return '生活雑貨';
}
