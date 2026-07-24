// Amazon SP-API ラッパ。テナントの SP-API 鍵（tenant_integrations.amazon_spapi）があれば本番、無ければmock。
// 認証は LWA アクセストークンのみ（2023以降 AWS SigV4/IAM 署名は不要）。
// 取得は Catalog Items API v2022-04-01（タイトル/ブランド/画像/重量）。価格はカタログに無いので hint/手入力で補う。
// 参考: https://developer-docs.amazon.com/sp-api/docs/catalog-items-api-v2022-04-01-reference

export type AmazonProductDetail = {
  asin: string;
  title: string;
  brand: string | null;
  manufacturer: string | null;
  imageUrls: string[]; // メイン+サブ
  bulletPoints: string[];
  description: string;
  category: string | null;
  gtin: string | null; // GTIN/EAN/UPC/JAN。Coupangのbarcode/emptyBarcode判定に使用
  priceJpy: number | null;
  weightG: number | null; // 商品重量（g）。配送料計算に使用
  inStock: boolean;
  fetchedAt: string;
  source: 'mock' | 'sp-api';
};

export type SpApiCreds = {
  lwaClientId?: string;
  lwaClientSecret?: string;
  refreshToken?: string;
  marketplaceId?: string;
  region?: string; // na / eu / fe（極東＝日本）
};

type Hint = { title?: string; brand?: string; priceJpy?: number | null; imageUrl?: string };

/**
 * ASINから商品詳細を取得。
 * - creds（テナントのSP-API鍵）があれば本番取得。失敗は throw（呼び出し側で「取得できず」扱い）。
 * - creds が無ければ mock（hint があれば優先して埋める）。
 */
export async function fetchAmazonProduct(
  asin: string,
  hint?: Hint,
  creds?: SpApiCreds | null,
): Promise<AmazonProductDetail> {
  if (creds && creds.refreshToken && creds.lwaClientId && creds.lwaClientSecret) {
    const sp = await fetchFromSpApi(asin, creds); // 失敗時は throw
    return applyHint(sp, hint);
  }
  return mockFetch(asin, hint);
}

// SP-API取得結果に hint を重ねる（カタログに無い価格は hint 優先、その他はSP-API優先）。
function applyHint(sp: AmazonProductDetail, hint?: Hint): AmazonProductDetail {
  return {
    ...sp,
    title: sp.title || hint?.title || sp.title,
    brand: sp.brand ?? hint?.brand ?? null,
    priceJpy: sp.priceJpy ?? hint?.priceJpy ?? null,
    imageUrls: sp.imageUrls.length ? sp.imageUrls : hint?.imageUrl ? [hint.imageUrl] : [],
  };
}

const SP_HOST: Record<string, string> = {
  na: 'sellingpartnerapi-na.amazon.com',
  eu: 'sellingpartnerapi-eu.amazon.com',
  fe: 'sellingpartnerapi-fe.amazon.com',
};

function toGrams(value: number, unit: string): number | null {
  if (!Number.isFinite(value)) return null;
  switch ((unit || '').toLowerCase()) {
    case 'grams':
    case 'g':
      return Math.round(value);
    case 'kilograms':
    case 'kg':
      return Math.round(value * 1000);
    case 'milligrams':
    case 'mg':
      return Math.round(value / 1000);
    case 'pounds':
    case 'lb':
    case 'lbs':
      return Math.round(value * 453.592);
    case 'ounces':
    case 'oz':
      return Math.round(value * 28.3495);
    default:
      return Math.round(value);
  }
}

async function fetchFromSpApi(asin: string, creds: SpApiCreds): Promise<AmazonProductDetail> {
  const mp = creds.marketplaceId || 'A1VC38T7YXB528'; // JP
  const host = SP_HOST[(creds.region || 'fe').toLowerCase()] || SP_HOST.fe;

  // 1) LWA アクセストークン
  const tok = await fetch('https://api.amazon.com/auth/o2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: creds.refreshToken!,
      client_id: creds.lwaClientId!,
      client_secret: creds.lwaClientSecret!,
    }),
  });
  if (!tok.ok) throw new Error('SP_API_AUTH_FAILED: ' + tok.status + ' ' + (await tok.text()).slice(0, 120));
  const accessToken = ((await tok.json()) as { access_token?: string }).access_token;
  if (!accessToken) throw new Error('SP_API_AUTH_FAILED: no access_token');

  // 2) Catalog Items
  const url =
    `https://${host}/catalog/2022-04-01/items/${encodeURIComponent(asin)}` +
    `?marketplaceIds=${mp}&includedData=summaries,images,dimensions,attributes,identifiers`;
  const res = await fetch(url, { headers: { 'x-amz-access-token': accessToken } });
  if (!res.ok) throw new Error('SP_API_CATALOG_FAILED: ' + res.status + ' ' + (await res.text()).slice(0, 160));
  const j = (await res.json()) as {
    summaries?: Array<{ marketplaceId?: string; itemName?: string; brand?: string; manufacturer?: string; browseClassification?: { displayName?: string } }>;
    images?: Array<{ marketplaceId?: string; images?: Array<{ variant?: string; link?: string }> }>;
    dimensions?: Array<{ marketplaceId?: string; item?: { weight?: { value?: number; unit?: string } }; package?: { weight?: { value?: number; unit?: string } } }>;
    identifiers?: Array<{ marketplaceId?: string; identifiers?: Array<{ identifierType?: string; identifier?: string }> }>;
    attributes?: Record<string, Array<{ value?: unknown }>>;
  };

  const sum = (j.summaries ?? []).find((s) => s.marketplaceId === mp) ?? (j.summaries ?? [])[0] ?? {};
  const imgGroup = (j.images ?? []).find((g) => g.marketplaceId === mp) ?? (j.images ?? [])[0];
  const imageUrls = (imgGroup?.images ?? [])
    .sort((a) => (a.variant === 'MAIN' ? -1 : 1))
    .map((i) => i.link)
    .filter((x): x is string => !!x)
    .slice(0, 5);
  const dim = (j.dimensions ?? []).find((d) => d.marketplaceId === mp) ?? (j.dimensions ?? [])[0];
  const w = dim?.item?.weight ?? dim?.package?.weight;
  const weightG = w && w.value != null ? toGrams(w.value, w.unit ?? '') : null;

  const idGroup = (j.identifiers ?? []).find((g) => g.marketplaceId === mp) ?? (j.identifiers ?? [])[0];
  const gtin =
    (idGroup?.identifiers ?? []).find((x) =>
      ['GTIN', 'EAN', 'UPC', 'JAN'].includes((x.identifierType || '').toUpperCase()),
    )?.identifier ?? null;
  const attrs = j.attributes ?? {};
  const bulletPoints = Array.isArray(attrs.bullet_point)
    ? attrs.bullet_point.map((b) => String(b?.value ?? '')).filter(Boolean).slice(0, 10)
    : [];
  const description =
    Array.isArray(attrs.product_description) && attrs.product_description[0]?.value != null
      ? String(attrs.product_description[0].value)
      : '';

  // 価格は Catalog に無いので Product Pricing API v0 で取得（失敗時は null→hintで補完）
  const priceJpy = await fetchPricing(asin, host, mp, accessToken);

  return {
    asin,
    title: sum.itemName || `ASIN ${asin}`,
    brand: sum.brand ?? sum.manufacturer ?? null,
    manufacturer: sum.manufacturer ?? sum.brand ?? null,
    imageUrls,
    bulletPoints,
    description,
    category: sum.browseClassification?.displayName ?? null,
    gtin,
    priceJpy, // Product Pricing API v0（取得不可時は null→hintで補完）
    weightG,
    inStock: true,
    fetchedAt: new Date().toISOString(),
    source: 'sp-api',
  };
}

// Product Pricing API v0：ASINの現行価格（円）を取得。取得不可は null。
async function fetchPricing(
  asin: string,
  host: string,
  mp: string,
  accessToken: string,
): Promise<number | null> {
  try {
    const url =
      `https://${host}/products/pricing/v0/price` +
      `?MarketplaceId=${mp}&Asins=${encodeURIComponent(asin)}&ItemType=Asin`;
    const res = await fetch(url, { headers: { 'x-amz-access-token': accessToken } });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      payload?: Array<{
        Product?: {
          Offers?: Array<{ BuyingPrice?: { ListingPrice?: { Amount?: number } } }>;
          CompetitivePricing?: {
            CompetitivePrices?: Array<{ Price?: { ListingPrice?: { Amount?: number } } }>;
          };
        };
      }>;
    };
    const p = (j.payload ?? [])[0]?.Product;
    const amount =
      p?.CompetitivePricing?.CompetitivePrices?.[0]?.Price?.ListingPrice?.Amount ??
      p?.Offers?.[0]?.BuyingPrice?.ListingPrice?.Amount ??
      null;
    return amount != null && Number.isFinite(Number(amount)) ? Math.round(Number(amount)) : null;
  } catch {
    return null;
  }
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
  // デモ用：mock時でもエラーUXを確認できるよう、ASINに特定語を含めると失敗させる。
  const u = asin.toUpperCase();
  if (u.includes('AUTHFAIL')) throw new Error('SP_API_AUTH_FAILED: 401 (demo)');
  if (u.includes('NOTFOUND')) throw new Error('SP_API_CATALOG_FAILED: 404 (demo)');
  if (u.includes('RATELIMIT')) throw new Error('SP_API_CATALOG_FAILED: 429 (demo)');
  if (u.includes('FAIL')) throw new Error('SP_API_FETCH_FAILED: (demo)');

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
    gtin: null,
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
