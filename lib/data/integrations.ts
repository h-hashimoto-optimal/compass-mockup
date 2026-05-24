// テナント連携（API鍵等）の保存・取得。シークレットは暗号化してDBに保存し、クライアントには返さない。
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tenantIntegrations } from '@/lib/db/schema';
import { encryptJSON, decryptJSON } from '@/lib/crypto';

export const INTEGRATION_KINDS = ['amazon_spapi', 'coupang'] as const;
export type IntegrationKind = (typeof INTEGRATION_KINDS)[number];

// 連携状態（接続済みか・更新日時・設定済みフィールド名のみ。値そのものは返さない）
export async function getIntegrationStatus(tenantId: string, kind: string) {
  const [r] = await db
    .select()
    .from(tenantIntegrations)
    .where(and(eq(tenantIntegrations.tenantId, tenantId), eq(tenantIntegrations.kind, kind)))
    .limit(1);
  if (!r || !r.secretsEnc) return { kind, connected: false, fields: [] as string[], updatedAt: null };
  let fields: string[] = [];
  try {
    fields = Object.keys(decryptJSON<Record<string, unknown>>(r.secretsEnc));
  } catch {
    fields = [];
  }
  return { kind, connected: true, status: r.status, label: r.label, fields, updatedAt: r.updatedAt };
}

// シークレットを暗号化して保存（upsert）。空文字は無視し、既存とマージ（部分更新可）。
export async function saveIntegration(
  tenantId: string,
  kind: string,
  incoming: Record<string, string>,
  label?: string,
) {
  const [existing] = await db
    .select()
    .from(tenantIntegrations)
    .where(and(eq(tenantIntegrations.tenantId, tenantId), eq(tenantIntegrations.kind, kind)))
    .limit(1);

  let merged: Record<string, string> = {};
  if (existing?.secretsEnc) {
    try {
      merged = decryptJSON<Record<string, string>>(existing.secretsEnc);
    } catch {
      merged = {};
    }
  }
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== '' && v != null) merged[k] = String(v);
  }
  const enc = encryptJSON(merged);

  await db
    .insert(tenantIntegrations)
    .values({ tenantId, kind, label: label ?? kind, secretsEnc: enc, status: 'active' })
    .onConflictDoUpdate({
      target: [tenantIntegrations.tenantId, tenantIntegrations.kind],
      set: { secretsEnc: enc, status: 'active', label: label ?? kind, updatedAt: new Date() },
    });
  return getIntegrationStatus(tenantId, kind);
}

export async function disconnectIntegration(tenantId: string, kind: string) {
  const [r] = await db
    .delete(tenantIntegrations)
    .where(and(eq(tenantIntegrations.tenantId, tenantId), eq(tenantIntegrations.kind, kind)))
    .returning();
  return !!r;
}

// サーバ内部用（送信処理などで復号して使う）。クライアントには絶対返さない。
export async function getIntegrationSecrets<T = Record<string, string>>(
  tenantId: string,
  kind: string,
): Promise<T | null> {
  const [r] = await db
    .select()
    .from(tenantIntegrations)
    .where(and(eq(tenantIntegrations.tenantId, tenantId), eq(tenantIntegrations.kind, kind)))
    .limit(1);
  if (!r?.secretsEnc) return null;
  try {
    return decryptJSON<T>(r.secretsEnc);
  } catch {
    return null;
  }
}
