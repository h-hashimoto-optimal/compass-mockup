// Coupang 販売の停止/再開。承認後の vendorItem（channelItemId）に対して実行する。
// 停止: PUT .../marketplace/vendor-items/{vendorItemId}/sales/stop
// 再開: PUT .../marketplace/vendor-items/{vendorItemId}/sales/resume
// ⚠️ パス/レスポンスは実キーで要検証。
import { signRequest, type CoupangCredentials } from './hmac';

async function salesAction(
  creds: CoupangCredentials,
  vendorItemId: string,
  action: 'stop' | 'resume',
): Promise<{ ok: boolean; status: number; body: string }> {
  const path = `/v2/providers/openapi/apis/api/v1/marketplace/vendor-items/${vendorItemId}/sales/${action}`;
  const signed = signRequest({ method: 'PUT', pathWithQuery: path, credentials: creds });
  const res = await fetch(signed.url, { method: signed.method, headers: signed.headers });
  const body = (await res.text()).slice(0, 200);
  return { ok: res.ok, status: res.status, body };
}

export function stopSale(creds: CoupangCredentials, vendorItemId: string) {
  return salesAction(creds, vendorItemId, 'stop');
}

export function resumeSale(creds: CoupangCredentials, vendorItemId: string) {
  return salesAction(creds, vendorItemId, 'resume');
}
