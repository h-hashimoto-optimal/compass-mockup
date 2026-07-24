// Coupang 注文(ordersheets)取得。テナントの鍵で署名して GET。無ければ呼ばない。
// 公式: GET /v2/providers/openapi/apis/api/v5/vendors/{vendorId}/ordersheets
// ⚠️ 期間フォーマット/ステータス値/レスポンス構造は実キーで要検証。
import { signRequest, type CoupangCredentials } from './hmac';

export type CoupangOrder = {
  channelOrderId: string;
  status: string;
  buyerName: string | null;
  totalAmount: number | null;
  orderedAt: string | null;
  raw: unknown;
};

export async function fetchCoupangOrders(
  creds: CoupangCredentials,
  opts: { createdAtFrom: string; createdAtTo: string; status?: string },
): Promise<CoupangOrder[]> {
  const q = new URLSearchParams({
    createdAtFrom: opts.createdAtFrom,
    createdAtTo: opts.createdAtTo,
    ...(opts.status ? { status: opts.status } : {}),
  });
  const path = `/v2/providers/openapi/apis/api/v5/vendors/${creds.vendorId}/ordersheets?${q.toString()}`;
  const signed = signRequest({ method: 'GET', pathWithQuery: path, credentials: creds });
  const res = await fetch(signed.url, { method: signed.method, headers: signed.headers });
  if (!res.ok) {
    throw new Error(`Coupang ordersheets ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const j = (await res.json()) as { data?: Array<Record<string, unknown>> };
  return (j.data ?? []).map((o) => {
    const orderer = (o.orderer ?? null) as { name?: string } | null;
    return {
      channelOrderId: String(o.orderId ?? o.shipmentBoxId ?? ''),
      status: String(o.status ?? 'new'),
      buyerName: orderer?.name ? String(orderer.name) : null,
      totalAmount: typeof o.totalPaidAmount === 'number' ? Math.round(o.totalPaidAmount) : null,
      orderedAt: o.orderedAt ? String(o.orderedAt) : null,
      raw: o,
    };
  });
}
