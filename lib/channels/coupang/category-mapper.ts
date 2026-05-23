// Coupang Category Recommendation API のラッパ。
// 実キーがあれば呼出、なければキーワード→displayCategoryCode のモック辞書から推定。
//
// 公式: https://developers.coupangcorp.com/hc/en-us/articles/360033509234-Category-recommendation
// エンドポイント: POST /v2/providers/openapi/apis/api/v1/categorization/predictions

import { signRequest, type CoupangCredentials } from './hmac';

const HAS_REAL_CREDS = Boolean(
  process.env.COUPANG_VENDOR_ID &&
    process.env.COUPANG_ACCESS_KEY &&
    process.env.COUPANG_SECRET_KEY,
);

export type CategoryRecommendation = {
  displayCategoryCode: number;
  displayCategoryName: string;
  source: 'coupang-api' | 'mock';
  confidence: number; // 0-1
};

export async function recommendCategory(input: {
  productName: string;
  brand?: string;
  attributes?: Record<string, string>;
}): Promise<CategoryRecommendation> {
  if (HAS_REAL_CREDS) {
    return callCoupangApi(input);
  }
  return mockRecommend(input);
}

async function callCoupangApi(input: {
  productName: string;
  brand?: string;
  attributes?: Record<string, string>;
}): Promise<CategoryRecommendation> {
  const creds: CoupangCredentials = {
    vendorId: process.env.COUPANG_VENDOR_ID!,
    accessKey: process.env.COUPANG_ACCESS_KEY!,
    secretKey: process.env.COUPANG_SECRET_KEY!,
  };
  const path = '/v2/providers/openapi/apis/api/v1/categorization/predictions';
  const signed = signRequest({
    method: 'POST',
    pathWithQuery: path,
    body: {
      productName: input.productName,
      brand: input.brand ?? '',
      productDescription: '',
      attributes: input.attributes ?? {},
      sellerSkuCode: '',
    },
    credentials: creds,
  });
  const res = await fetch(signed.url, {
    method: signed.method,
    headers: signed.headers,
    body: signed.body,
  });
  if (!res.ok) {
    throw new Error(`Coupang Category API ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    code: string;
    data: { predictedCategoryId: number; predictedCategoryName: string };
  };
  return {
    displayCategoryCode: json.data.predictedCategoryId,
    displayCategoryName: json.data.predictedCategoryName,
    source: 'coupang-api',
    confidence: 0.9,
  };
}

// モック辞書: タイトルに含まれるキーワードでざっくり推定。本番運用ではAPI呼出に置き換える。
const mockMap: Array<{ kw: RegExp; code: number; name: string }> = [
  { kw: /(ヘッドホン|headphone|이어폰|スピーカー)/i, code: 56137, name: '가전 / 음향기기 / 헤드폰' },
  { kw: /(モバイルバッテリー|charger|充電器|powercore)/i, code: 56145, name: '가전 / 모바일 액세서리' },
  { kw: /(シューズ|スニーカー|sneakers|airmax)/i, code: 79431, name: '패션잡화 / 신발' },
  { kw: /(コーヒー|coffee|お茶)/i, code: 60192, name: '식품 / 커피·차' },
  { kw: /(ヒートテック|シャツ|tシャツ|アパレル)/i, code: 71022, name: '패션의류 / 이너웨어' },
  { kw: /(ぬいぐるみ|フィギュア|toy|pokemon|ピカチュウ)/i, code: 88210, name: '완구·취미 / 캐릭터' },
  { kw: /(調理|ホットクック|kitchen|쿡)/i, code: 56120, name: '가전 / 주방가전' },
  { kw: /(アロマ|디퓨저|香り|aroma)/i, code: 90033, name: '생활용품 / 방향제' },
];

function mockRecommend(input: {
  productName: string;
  brand?: string;
}): CategoryRecommendation {
  const target = `${input.productName} ${input.brand ?? ''}`;
  for (const m of mockMap) {
    if (m.kw.test(target)) {
      return {
        displayCategoryCode: m.code,
        displayCategoryName: m.name,
        source: 'mock',
        confidence: 0.7,
      };
    }
  }
  return {
    displayCategoryCode: 99999,
    displayCategoryName: '기타',
    source: 'mock',
    confidence: 0.3,
  };
}
