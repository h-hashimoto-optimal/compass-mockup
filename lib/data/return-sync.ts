// sync_returns ジョブ本体：テナントのCoupang鍵で返品リクエストを取得し return_requests へ冪等 upsert。
import { withTenant } from '@/lib/db';
import { returnRequests } from '@/lib/db/schema';
import { getIntegrationSecrets } from '@/lib/data/integrations';
import { fetchCoupangReturns } from '@/lib/channels/coupang/returns';

export async function syncTenantReturns(tenantId: string): Promise<{ fetched: number; upserted: number }> {
  const s = await getIntegrationSecrets<Record<string, string>>(tenantId, 'coupang');
  if (!s?.vendorId || !s?.accessKey || !s?.secretKey) return { fetched: 0, upserted: 0 };
  const creds = { vendorId: s.vendorId, accessKey: s.accessKey, secretKey: s.secretKey };

  const to = new Date();
  const from = new Date(to.getTime() - 3 * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const list = await fetchCoupangReturns(creds, { createdAtFrom: fmt(from), createdAtTo: fmt(to) });

  let upserted = 0;
  for (const r of list) {
    if (!r.receiptId) continue;
    await withTenant(tenantId, (tx) =>
      tx
        .insert(returnRequests)
        .values({
          tenantId,
          channel: 'coupang',
          receiptId: r.receiptId,
          channelOrderId: r.channelOrderId,
          reason: r.reason,
          status: r.status,
          requestedAt: r.requestedAt ? new Date(r.requestedAt) : null,
          raw: r.raw,
        })
        .onConflictDoUpdate({
          target: [returnRequests.tenantId, returnRequests.channel, returnRequests.receiptId],
          set: { status: r.status, raw: r.raw },
        }),
    );
    upserted++;
  }
  return { fetched: list.length, upserted };
}
