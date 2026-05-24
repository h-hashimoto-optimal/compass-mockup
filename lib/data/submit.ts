// 単一商品をCoupangへ送る（送信アクション）。
// 認証情報が無い／本送信未有効化なら dry-run（実送信せず）。鍵が揃い COUPANG_LIVE_SEND=1 のときだけ本送信。
import { and, eq, isNull } from 'drizzle-orm';
import { withTenant } from '@/lib/db';
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
  // 既に審査中/承認済み/販売中（却下以外のsubmitted）は再送しない
  const [cur] = await withTenant(tenantId, (tx) =>
    tx
      .select({ status: channelListings.status, coupangApprovalStatus: channelListings.coupangApprovalStatus })
      .from(channelListings)
      .where(and(eq(channelListings.id, listingId), eq(channelListings.tenantId, tenantId), isNull(channelListings.deletedAt)))
      .limit(1),
  );
  if (cur && cur.status === 'submitted' && cur.coupangApprovalStatus !== 'rejected') {
    return { mode: 'already_submitted' as const, reason: '既に送信済み（審査中／販売中）です' };
  }

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
    // 開発用 擬似送信：実送信せずに「審査中(submitted)」へ進める（COUPANG_MOCK_SEND=1）。本番は使わない。
    if (process.env.COUPANG_MOCK_SEND === '1') {
      const fakeSpid = 'MOCK-' + listingId.slice(0, 8);
      await withTenant(tenantId, (tx) =>
        tx
          .update(channelListings)
          .set({
            status: 'submitted',
            coupangApprovalStatus: 'requested',
            channelProductId: fakeSpid,
            rejectedReason: null,
            lastSyncedAt: new Date(),
          })
          .where(and(eq(channelListings.id, listingId), eq(channelListings.tenantId, tenantId))),
      );
      return { mode: 'mock' as const, reason: '擬似送信（開発用）：審査中にしました', sellerProductId: fakeSpid };
    }
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
  // Coupangが返す sellerProductId（あれば保持）。後続の状態同期(reconcile)で承認/販売を更新する。
  const sellerProductId =
    json && typeof json === 'object'
      ? String((json as Record<string, unknown>).data ?? '') || null
      : null;
  await withTenant(tenantId, (tx) =>
    tx
      .update(channelListings)
      .set(
        ok
          ? {
              status: 'submitted', // Coupang登録要求を送信
              coupangApprovalStatus: 'requested', // = 審査中（승인대기）。承認/販売は状態同期で反映
              channelProductId: sellerProductId,
              lastSyncedAt: new Date(),
              rejectedReason: null,
            }
          : { status: 'error', lastSyncedAt: new Date(), rejectedReason: text.slice(0, 500) },
      )
      .where(and(eq(channelListings.id, listingId), eq(channelListings.tenantId, tenantId))),
  );

  return { mode: 'live' as const, status: res.status, ok, response: json ?? text };
}
