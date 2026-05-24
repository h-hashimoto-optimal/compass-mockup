// 単一商品をCoupangへ送る（送信アクション）。
// 認証情報が無ければ dry-run（実送信せず）、有れば本送信（将来：キー＋固定IP投入後に有効）。
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tenantIntegrations, channelListings } from '@/lib/db/schema';
import { signRequest } from '@/lib/channels/coupang/hmac';
import { previewListing } from './preview';

// tenant_integrations から Coupang 認証情報を取得（復号）。現状は暗号化/復号未実装＝null。
async function getCoupangCreds(tenantId: string): Promise<{ vendorId: string; accessKey: string; secretKey: string } | null> {
  const [row] = await db
    .select()
    .from(tenantIntegrations)
    .where(and(eq(tenantIntegrations.tenantId, tenantId), eq(tenantIntegrations.kind, 'coupang')))
    .limit(1);
  if (!row?.secretsEnc) return null; // 鍵未設定
  // TODO: secrets_enc を復号して {vendorId, accessKey, secretKey} を返す（暗号化実装後）
  return null;
}

export async function submitListing(tenantId: string, listingId: string) {
  const pv = await previewListing(tenantId, listingId);

  // 必須項目に欠落（block）があれば送らない
  if (!pv.validation.ready) {
    return {
      mode: 'blocked' as const,
      warnings: pv.validation.warnings.filter((w) => w.level === 'block').map((w) => w.msg),
    };
  }

  const creds = await getCoupangCreds(tenantId);
  if (!creds) {
    // 認証情報なし → dry-run（実送信しない）。ステータスは変えない。
    return {
      mode: 'dry-run' as const,
      reason: 'Coupang認証情報が未設定（キー＋固定IP投入で本送信に切替）',
      payload: pv.payload,
    };
  }

  // ── 本送信（creds が揃った将来に有効） ──
  const signed = signRequest({
    method: 'POST',
    pathWithQuery: '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products',
    body: pv.payload,
    credentials: creds,
  });
  const res = await fetch(signed.url, { method: signed.method, headers: signed.headers, body: signed.body });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* keep */
  }
  const ok = res.ok;
  await db
    .update(channelListings)
    .set({
      status: ok ? 'pending' : 'error', // 受付＝審査中。却下/エラーは後続の状態同期で更新
      lastSyncedAt: new Date(),
      rejectedReason: ok ? null : text.slice(0, 500),
    })
    .where(and(eq(channelListings.id, listingId), eq(channelListings.tenantId, tenantId)));

  return { mode: 'live' as const, status: res.status, ok, response: json ?? text };
}
