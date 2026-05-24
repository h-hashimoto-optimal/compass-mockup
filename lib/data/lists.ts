// テナント別リスト：禁止ワード / 仕入ブラックリスト / 知財ブランド（本部共有＋自社）。
import { and, eq, isNull, or, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { ngWords, sourceBlacklist, ipBrands } from '@/lib/db/schema';

// ── 禁止ワード ──
export async function listNgWords(tenantId: string) {
  return db.select().from(ngWords).where(eq(ngWords.tenantId, tenantId)).orderBy(desc(ngWords.createdAt));
}
export async function addNgWord(tenantId: string, word: string, mode: string, replacement?: string | null) {
  const [r] = await db
    .insert(ngWords)
    .values({ tenantId, word, mode: mode === 'replace' ? 'replace' : 'block', replacement: replacement ?? null })
    .onConflictDoNothing({ target: [ngWords.tenantId, ngWords.word] })
    .returning();
  return r ?? null;
}
export async function deleteNgWord(tenantId: string, id: string) {
  const [r] = await db.delete(ngWords).where(and(eq(ngWords.id, id), eq(ngWords.tenantId, tenantId))).returning();
  return !!r;
}
// 翻訳後タイトル等に適用：block=除去 / replace=置換。ヒット語を返す。
export function applyNgWords(text: string, words: { word: string; mode: string; replacement: string | null; enabled: boolean }[]) {
  let out = text || '';
  const hits: string[] = [];
  for (const w of words) {
    if (!w.enabled || !w.word) continue;
    if (!out.includes(w.word)) continue;
    out = out.split(w.word).join(w.mode === 'replace' ? w.replacement ?? '' : '');
    hits.push(w.word);
  }
  return { text: out.replace(/\s{2,}/g, ' ').trim(), hits };
}

// ── 仕入ブラックリスト ──
export async function listBlacklist(tenantId: string) {
  return db.select().from(sourceBlacklist).where(eq(sourceBlacklist.tenantId, tenantId)).orderBy(desc(sourceBlacklist.createdAt));
}
export async function addBlacklist(tenantId: string, source: string, sourceProductId: string, reason?: string | null) {
  const [r] = await db
    .insert(sourceBlacklist)
    .values({ tenantId, source, sourceProductId, reason: reason ?? null })
    .onConflictDoNothing({ target: [sourceBlacklist.tenantId, sourceBlacklist.source, sourceBlacklist.sourceProductId] })
    .returning();
  return r ?? null;
}
export async function deleteBlacklist(tenantId: string, id: string) {
  const [r] = await db.delete(sourceBlacklist).where(and(eq(sourceBlacklist.id, id), eq(sourceBlacklist.tenantId, tenantId))).returning();
  return !!r;
}
export async function isBlacklisted(tenantId: string, source: string, sourceProductId: string) {
  const [r] = await db
    .select({ id: sourceBlacklist.id })
    .from(sourceBlacklist)
    .where(and(eq(sourceBlacklist.tenantId, tenantId), eq(sourceBlacklist.source, source), eq(sourceBlacklist.sourceProductId, sourceProductId)))
    .limit(1);
  return !!r;
}

// ── 知財ブランド（tenant_id NULL=本部共有 ＋ 自社追加） ──
export async function listIpBrands(tenantId: string) {
  return db
    .select()
    .from(ipBrands)
    .where(or(isNull(ipBrands.tenantId), eq(ipBrands.tenantId, tenantId)))
    .orderBy(desc(ipBrands.createdAt));
}
export async function addIpBrand(tenantId: string, brand: string, level: string) {
  const [r] = await db.insert(ipBrands).values({ tenantId, brand, level: level === 'block' ? 'block' : 'warn' }).returning();
  return r;
}
// 自社追加のみ削除可（本部共有=tenant_id NULL は消せない）
export async function deleteIpBrand(tenantId: string, id: string) {
  const [r] = await db.delete(ipBrands).where(and(eq(ipBrands.id, id), eq(ipBrands.tenantId, tenantId))).returning();
  return !!r;
}
// ブランド名が知財リスト（共有＋自社）に該当するか（部分一致・大文字小文字無視）
export async function matchIpBrand(tenantId: string, brand: string | null): Promise<{ brand: string; level: string } | null> {
  if (!brand) return null;
  const rows = await listIpBrands(tenantId);
  const b = brand.toLowerCase();
  for (const r of rows) {
    if (b.includes(r.brand.toLowerCase())) return { brand: r.brand, level: r.level };
  }
  return null;
}
