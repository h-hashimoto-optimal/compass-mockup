// sync_orders ジョブ本体：テナントのCoupang鍵で注文を取得し orders 表へ冪等 upsert。
// orders は RLS 対象なので withTenant 経由。鍵が無ければ何もしない。
import { withTenant } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { getIntegrationSecrets } from '@/lib/data/integrations';
import { fetchCoupangOrders } from '@/lib/channels/coupang/orders';

export async function syncTenantOrders(tenantId: string): Promise<{ fetched: number; upserted: number }> {
  const s = await getIntegrationSecrets<Record<string, string>>(tenantId, 'coupang');
  if (!s?.vendorId || !s?.accessKey || !s?.secretKey) return { fetched: 0, upserted: 0 };
  const creds = { vendorId: s.vendorId, accessKey: s.accessKey, secretKey: s.secretKey };

  // 直近3日（Coupangの照会窓は最大31日）
  const to = new Date();
  const from = new Date(to.getTime() - 3 * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD（実キーで書式要確認）

  const list = await fetchCoupangOrders(creds, { createdAtFrom: fmt(from), createdAtTo: fmt(to) });

  let upserted = 0;
  for (const o of list) {
    if (!o.channelOrderId) continue;
    await withTenant(tenantId, (tx) =>
      tx
        .insert(orders)
        .values({
          tenantId,
          channel: 'coupang',
          channelOrderId: o.channelOrderId,
          status: o.status,
          buyerName: o.buyerName,
          totalAmount: o.totalAmount,
          currency: 'KRW',
          orderedAt: o.orderedAt ? new Date(o.orderedAt) : null,
          raw: o.raw,
        })
        .onConflictDoUpdate({
          target: [orders.tenantId, orders.channel, orders.channelOrderId],
          set: { status: o.status, raw: o.raw },
        }),
    );
    // ★受注時のAmazon在庫/価格の最終確認（無在庫の肝, §B ケース9）はここにフック予定（I-4後続）
    upserted++;
  }
  return { fetched: list.length, upserted };
}
