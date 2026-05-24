// Chrome拡張用テナントトークンの発行・解決。生トークンはハッシュ保存。
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tenantTokens } from '@/lib/db/schema';
import { generateToken, hashToken } from '@/lib/auth';

// 発行：生トークンを返す（一度だけ表示）。
export async function createTenantToken(tenantId: string, label?: string): Promise<string> {
  const raw = generateToken();
  await db.insert(tenantTokens).values({ tenantId, tokenHash: hashToken(raw), label: label ?? null });
  return raw;
}

// 解決：トークン → tenant_id（失効は除外）。最終使用時刻を更新。
export async function resolveTenantByToken(raw: string | null): Promise<string | null> {
  if (!raw) return null;
  const [row] = await db
    .select()
    .from(tenantTokens)
    .where(and(eq(tenantTokens.tokenHash, hashToken(raw)), isNull(tenantTokens.revokedAt)))
    .limit(1);
  if (!row) return null;
  db.update(tenantTokens).set({ lastUsedAt: new Date() }).where(eq(tenantTokens.id, row.id)).catch(() => {});
  return row.tenantId;
}
