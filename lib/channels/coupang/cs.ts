// Coupang CS（コールセンター問い合わせ）取得。テナント鍵で署名GET。
// 公式: GET /v2/providers/openapi/apis/api/v5/vendors/{vendorId}/callCenterInquiries
// ⚠️ 期間書式(inquiryStartAt/EndAt)・レスポンス構造は実キーで要検証。
import { signRequest, type CoupangCredentials } from './hmac';

export type CoupangInquiry = {
  channelInquiryId: string;
  type: string;
  content: string | null;
  status: string;
  receivedAt: string | null;
  raw: unknown;
};

export async function fetchCoupangInquiries(
  creds: CoupangCredentials,
  opts: { inquiryStartAt: string; inquiryEndAt: string },
): Promise<CoupangInquiry[]> {
  const q = new URLSearchParams({
    vendorId: creds.vendorId,
    inquiryStartAt: opts.inquiryStartAt,
    inquiryEndAt: opts.inquiryEndAt,
    answeredType: 'ALL',
  });
  const path = `/v2/providers/openapi/apis/api/v5/vendors/${creds.vendorId}/callCenterInquiries?${q.toString()}`;
  const signed = signRequest({ method: 'GET', pathWithQuery: path, credentials: creds });
  const res = await fetch(signed.url, { method: signed.method, headers: signed.headers });
  if (!res.ok) {
    throw new Error(`Coupang callCenterInquiries ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const j = (await res.json()) as {
    data?: { content?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
  };
  const arr = Array.isArray(j.data) ? j.data : (j.data?.content ?? []);
  return arr.map((o) => ({
    channelInquiryId: String(o.inquiryId ?? o.id ?? ''),
    type: 'callCenter',
    content:
      o.content != null ? String(o.content) : o.inquiryContent != null ? String(o.inquiryContent) : null,
    status: o.answered === true || o.answeredAt ? 'answered' : 'open',
    receivedAt: o.inquiryAt ? String(o.inquiryAt) : o.createdAt ? String(o.createdAt) : null,
    raw: o,
  }));
}
