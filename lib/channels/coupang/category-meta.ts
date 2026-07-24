// Coupang Category Metadata Query のラッパ＋キャッシュ。
// 商品登録の必須項目（notices/attributes/書類）は「カテゴリ駆動」なので、displayCategoryCode
// ごとに Category Meta を取得して coupang_category_meta（全テナント共通）に貯める。
// 公式: https://developers.coupangcorp.com/hc/en-us/articles/360034035713-Category-Metadata-Query
// GET /v2/providers/seller_api/apis/api/v1/marketplace/meta/category-related-metas/display-category-codes/{code}
//
// ※ 実キー（テナントのCoupang鍵）が必要。creds が無ければ既存キャッシュのみを返す（probe前でも壊れない）。

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { coupangCategoryMeta, type CoupangCategoryMeta } from '@/lib/db/schema';
import { signRequest, type CoupangCredentials } from './hmac';

export type CoupangCategoryMetaData = {
  displayCategoryCode: number;
  categoryName: string | null;
  notices: Array<{ category: string; details: Array<{ name: string; required: boolean }> }>;
  attributes: Array<{
    name: string;
    required: boolean;
    exposed: boolean;
    dataType?: string | null;
    basicUnit?: string | null;
  }>;
  requiredDocuments: Array<{ name: string; required: boolean }>;
  admissible: boolean; // 必須の書類/認証が無ければ true（＝加盟者が満たせる見込み）
  raw: unknown;
  source: 'coupang-api';
};

const META_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30日

// 実キーで Category Metadata Query を取得し、構造化する。
export async function fetchCategoryMeta(
  displayCategoryCode: number,
  creds: CoupangCredentials,
): Promise<CoupangCategoryMetaData> {
  const path =
    `/v2/providers/seller_api/apis/api/v1/marketplace/meta/category-related-metas` +
    `/display-category-codes/${displayCategoryCode}`;
  const signed = signRequest({ method: 'GET', pathWithQuery: path, credentials: creds });
  const res = await fetch(signed.url, { method: signed.method, headers: signed.headers });
  if (!res.ok) {
    throw new Error(`Coupang Category Meta ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    data?: {
      name?: string;
      noticeCategories?: Array<{
        noticeCategoryName?: string;
        noticeCategoryDetailNames?: Array<{ noticeCategoryDetailName?: string; required?: string }>;
      }>;
      attributes?: Array<{
        attributeTypeName?: string;
        required?: string;
        exposed?: string;
        dataType?: string;
        basicUnit?: string;
      }>;
      requiredDocumentNames?: Array<{ templateName?: string; required?: string }>;
    };
  };
  const d = json.data ?? {};
  const isReq = (v?: string) => (v ?? '').toUpperCase() === 'MANDATORY';

  const notices = (d.noticeCategories ?? []).map((n) => ({
    category: n.noticeCategoryName ?? '',
    details: (n.noticeCategoryDetailNames ?? []).map((x) => ({
      name: x.noticeCategoryDetailName ?? '',
      required: isReq(x.required),
    })),
  }));
  const attributes = (d.attributes ?? []).map((a) => ({
    name: a.attributeTypeName ?? '',
    required: isReq(a.required),
    exposed: (a.exposed ?? '').toUpperCase() === 'EXPOSED',
    dataType: a.dataType ?? null,
    basicUnit: a.basicUnit ?? null,
  }));
  const requiredDocuments = (d.requiredDocumentNames ?? []).map((r) => ({
    name: r.templateName ?? '',
    required: isReq(r.required),
  }));
  // 必須の書類/認証があるカテゴリ＝加盟者が用意できない前提で admissible=false（受信〜プレビューで除外・警告）
  const admissible = !requiredDocuments.some((r) => r.required);

  return {
    displayCategoryCode,
    categoryName: d.name ?? null,
    notices,
    attributes,
    requiredDocuments,
    admissible,
    raw: json,
    source: 'coupang-api',
  };
}

export async function getCachedCategoryMeta(code: number): Promise<CoupangCategoryMeta | null> {
  const [row] = await db
    .select()
    .from(coupangCategoryMeta)
    .where(eq(coupangCategoryMeta.displayCategoryCode, code))
    .limit(1);
  return row ?? null;
}

export async function upsertCategoryMeta(meta: CoupangCategoryMetaData): Promise<void> {
  const values = {
    displayCategoryCode: meta.displayCategoryCode,
    categoryName: meta.categoryName,
    noticeCategories: meta.notices,
    attributes: meta.attributes,
    requiredDocuments: meta.requiredDocuments,
    admissible: meta.admissible,
    raw: meta.raw,
    fetchedAt: new Date(),
  };
  await db
    .insert(coupangCategoryMeta)
    .values(values)
    .onConflictDoUpdate({ target: coupangCategoryMeta.displayCategoryCode, set: values });
}

// キャッシュ優先で解決。鍵があり期限切れ/未取得ならAPIで取得してキャッシュ。
// 鍵が無ければ既存キャッシュ（無ければ null）を返す。
export async function resolveCategoryMeta(
  code: number,
  creds?: CoupangCredentials | null,
  opts?: { maxAgeMs?: number },
): Promise<CoupangCategoryMeta | null> {
  const cached = await getCachedCategoryMeta(code);
  const maxAge = opts?.maxAgeMs ?? META_MAX_AGE_MS;
  if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < maxAge) return cached;
  if (!creds) return cached;
  const fresh = await fetchCategoryMeta(code, creds);
  await upsertCategoryMeta(fresh);
  return getCachedCategoryMeta(code);
}
