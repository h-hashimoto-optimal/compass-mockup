// Coupang 返品リクエスト取得。テナント鍵で署名GET。
// 公式: GET /v2/providers/openapi/apis/api/v6/vendors/{vendorId}/returnRequests
// ⚠️ 期間書式/検索条件/レスポンス構造は実キーで要検証。
import { signRequest, type CoupangCredentials } from './hmac';

export type CoupangReturn = {
  receiptId: string;
  channelOrderId: string | null;
  reason: string | null;
  status: string;
  requestedAt: string | null;
  raw: unknown;
};

export async function fetchCoupangReturns(
  creds: CoupangCredentials,
  opts: { createdAtFrom: string; createdAtTo: string; status?: string },
): Promise<CoupangReturn[]> {
  const q = new URLSearchParams({
    createdAtFrom: opts.createdAtFrom,
    createdAtTo: opts.createdAtTo,
    ...(opts.status ? { status: opts.status } : {}),
  });
  const path = `/v2/providers/openapi/apis/api/v6/vendors/${creds.vendorId}/returnRequests?${q.toString()}`;
  const signed = signRequest({ method: 'GET', pathWithQuery: path, credentials: creds });
  const res = await fetch(signed.url, { method: signed.method, headers: signed.headers });
  if (!res.ok) {
    throw new Error(`Coupang returnRequests ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const j = (await res.json()) as { data?: Array<Record<string, unknown>> };
  return (j.data ?? []).map((o) => ({
    receiptId: String(o.receiptId ?? o.returnDeliveryId ?? ''),
    channelOrderId: o.orderId != null ? String(o.orderId) : null,
    reason:
      o.reason != null
        ? String(o.reason)
        : o.cancelReasonCategory1 != null
          ? String(o.cancelReasonCategory1)
          : null,
    status: String(o.receiptStatus ?? o.status ?? 'requested'),
    requestedAt: o.createdAt ? String(o.createdAt) : o.requestDate ? String(o.requestDate) : null,
    raw: o,
  }));
}
