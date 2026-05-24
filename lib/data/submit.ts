// 単一商品をCoupangへ送る（送信アクション）。
// 認証情報が無い／本送信未有効化なら dry-run（実送信せず）。鍵が揃い COUPANG_LIVE_SEND=1 のときだけ本送信。
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { channelListings } from '@/lib/db/schema';
import { signRequest } from '@/lib/channels/coupang/hmac';
import { getIntegrationSecrets } from '@/lib/data/integrations';
import { previewListing } from './preview';

// tenant_integrations(coupang) を復号して認証情報を取得。鍵が揃っていなければ null。
async function getCoupangCreds(tenantId: string): Promise<{ vendorId: string; accessKey: string; secretKey: string } | null> {
  const s = await getIntegrationSecrets<Record<string, string>>(tenantId, 'coupang');
  if (!s || !s.vendorId || !s.accessKey || !s.secretKey) return null;
  return { vendorId: s.vendorId, accessKey: s.accessKey, secretKey: s.secretKey };
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
  const liveEnabled = process.env.COUPANG_LIVE_SEND === '1';
  if (!creds || !liveEnabled) {
    // 認証情報なし or 本送信未有効化 → dry-run（実送信しない）。ステータスは変えない。
    return {
      mode: 'dry-run' as const,
      reason: !creds
        ? 'Coupang認証情報が未設定（「販売先（Coupang）」で登録）'
        : '本送信は未有効化（固定IP確保後、サーバに COUPANG_LIVE_SEND=1 を設定で有効化）',
      payload: pv.payload,
    };
  }

  // ── 本送信（creds が揃い、COUPANG_LIVE_SEND=1 のときのみ） ──
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
