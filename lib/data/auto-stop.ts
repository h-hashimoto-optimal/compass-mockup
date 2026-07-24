// auto_stop ジョブ本体（③）：赤字/欠品が一定時間継続した「販売中」の出品を Coupang で停止する。
// 既定OFF（§B: 通知のみ）。テナント設定で ON のときだけ動く。誤停止防止に時間ヒステリシス。
import { and, eq, inArray, isNull, lte } from 'drizzle-orm';
import { withTenant } from '@/lib/db';
import { alerts, channelListings, tenantMonitoringSettings } from '@/lib/db/schema';
import { getIntegrationSecrets } from '@/lib/data/integrations';
import { stopSale } from '@/lib/channels/coupang/sales';

async function coupangCreds(tenantId: string) {
  const s = await getIntegrationSecrets<Record<string, string>>(tenantId, 'coupang');
  if (!s?.vendorId || !s?.accessKey || !s?.secretKey) return null;
  return { vendorId: s.vendorId, accessKey: s.accessKey, secretKey: s.secretKey };
}

export async function autoStopTenant(tenantId: string): Promise<{ stopped: number; skipped: number }> {
  // 監視設定（行が無ければ既定OFF）
  const [ms] = await withTenant(tenantId, (tx) =>
    tx
      .select()
      .from(tenantMonitoringSettings)
      .where(eq(tenantMonitoringSettings.tenantId, tenantId))
      .limit(1),
  );
  const onLoss = ms?.autoStopOnLoss ?? false;
  const onOos = ms?.autoStopOnOos ?? false;
  if (!onLoss && !onOos) return { stopped: 0, skipped: 0 };

  const creds = await coupangCreds(tenantId);
  if (!creds) return { stopped: 0, skipped: 0 };

  const minAgeMin = ms?.autoStopMinAgeMin ?? 30;
  const cutoff = new Date(Date.now() - minAgeMin * 60_000);
  const types: string[] = [];
  if (onLoss) types.push('price_up_loss');
  if (onOos) types.push('out_of_stock');

  // 対象: open アラート(有効type) × 販売中(on_sale) × vendorItemId あり × 一定時間継続(ヒステリシス)
  const targets = await withTenant(tenantId, (tx) =>
    tx
      .select({
        alertId: alerts.id,
        listingId: channelListings.id,
        vendorItemId: channelListings.channelItemId,
      })
      .from(alerts)
      .innerJoin(channelListings, eq(alerts.channelListingId, channelListings.id))
      .where(
        and(
          eq(alerts.tenantId, tenantId),
          eq(alerts.status, 'open'),
          inArray(alerts.type, types),
          lte(alerts.createdAt, cutoff),
          eq(channelListings.coupangSalesStatus, 'on_sale'),
          isNull(channelListings.deletedAt),
        ),
      ),
  );

  let stopped = 0;
  let skipped = 0;
  for (const t of targets) {
    if (!t.vendorItemId) {
      skipped++;
      continue;
    }
    // TODO(裏取り): 停止前に SP-API/Keepa で赤字/欠品を再確認して誤停止をさらに減らす。
    const r = await stopSale(creds, t.vendorItemId);
    if (!r.ok) {
      skipped++;
      continue;
    }
    await withTenant(tenantId, (tx) =>
      tx
        .update(channelListings)
        .set({ coupangSalesStatus: 'suspended', lastSyncedAt: new Date() })
        .where(and(eq(channelListings.id, t.listingId), eq(channelListings.tenantId, tenantId))),
    );
    // 停止済みは alert を ack（再停止ループ防止・履歴は残す）
    await withTenant(tenantId, (tx) =>
      tx
        .update(alerts)
        .set({ status: 'ack' })
        .where(and(eq(alerts.id, t.alertId), eq(alerts.tenantId, tenantId))),
    );
    stopped++;
  }
  return { stopped, skipped };
}
