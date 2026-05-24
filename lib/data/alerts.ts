// テナント別アラート：赤字(price_up_loss)＝出品単位 / 欠品(out_of_stock)＝仕入元在庫。
// scanAlerts は冪等：条件成立で open を作成、解消で open を resolved に。
import { and, eq, desc, isNull, count } from 'drizzle-orm';
import { db } from '@/lib/db';
import { alerts, channelListings, sourceProducts } from '@/lib/db/schema';
import { getMonitoringSettings } from '@/lib/data/monitoring';

export async function listAlerts(tenantId: string, status?: string) {
  const where = status
    ? and(eq(alerts.tenantId, tenantId), eq(alerts.status, status))
    : eq(alerts.tenantId, tenantId);
  return db
    .select({
      id: alerts.id,
      type: alerts.type,
      status: alerts.status,
      detail: alerts.detail,
      createdAt: alerts.createdAt,
      channelListingId: alerts.channelListingId,
      titleJa: channelListings.titleJa,
      titleTranslated: channelListings.titleTranslated,
      listPrice: channelListings.listPrice,
      floorPriceJpy: channelListings.floorPriceJpy,
      source: sourceProducts.source,
      sourceProductId: sourceProducts.sourceProductId,
      sourcePriceJpy: sourceProducts.lastPriceJpy,
      sourceInStock: sourceProducts.lastInStock,
    })
    .from(alerts)
    .leftJoin(channelListings, eq(alerts.channelListingId, channelListings.id))
    .leftJoin(sourceProducts, eq(channelListings.sourceProductId, sourceProducts.id))
    .where(where)
    .orderBy(desc(alerts.createdAt));
}

// テナントの有効出品を走査し、赤字/欠品を検知（冪等）。
export async function scanAlerts(tenantId: string) {
  const rows = await db
    .select({
      listingId: channelListings.id,
      floorPriceJpy: channelListings.floorPriceJpy,
      sourceRowId: sourceProducts.id,
      lastPriceJpy: sourceProducts.lastPriceJpy,
      lastInStock: sourceProducts.lastInStock,
    })
    .from(channelListings)
    .innerJoin(sourceProducts, eq(channelListings.sourceProductId, sourceProducts.id))
    .where(and(eq(channelListings.tenantId, tenantId), isNull(channelListings.deletedAt)));

  const openRows = await db
    .select({ id: alerts.id, type: alerts.type, channelListingId: alerts.channelListingId })
    .from(alerts)
    .where(and(eq(alerts.tenantId, tenantId), eq(alerts.status, 'open')));
  const openKey = new Set(openRows.map((a) => `${a.channelListingId}:${a.type}`));

  const mon = await getMonitoringSettings(tenantId);

  let created = 0;
  let resolved = 0;
  const toCreate: typeof alerts.$inferInsert[] = [];
  const stillActive = new Set<string>();

  for (const r of rows) {
    // 監視設定: 赤字は floor*(1-buffer) を超えたら検知（buffer=0なら実赤字のみ）。検知ON/OFFも反映。
    const lossThreshold =
      r.floorPriceJpy != null ? Math.floor(r.floorPriceJpy * (1 - mon.lossBufferPct)) : null;
    const loss =
      mon.detectLoss &&
      lossThreshold != null &&
      r.lastPriceJpy != null &&
      r.lastPriceJpy > lossThreshold;
    const oos = mon.detectOos && r.lastInStock === false;
    const cases: Array<{ type: string; on: boolean; detail: Record<string, unknown> }> = [
      { type: 'price_up_loss', on: loss, detail: { floorPriceJpy: r.floorPriceJpy, lastPriceJpy: r.lastPriceJpy } },
      { type: 'out_of_stock', on: oos, detail: { inStock: false } },
    ];
    for (const c of cases) {
      const key = `${r.listingId}:${c.type}`;
      if (c.on) {
        stillActive.add(key);
        if (!openKey.has(key)) {
          toCreate.push({
            tenantId,
            channelListingId: r.listingId,
            sourceProductId: r.sourceRowId,
            type: c.type,
            detail: c.detail,
            status: 'open',
          });
        }
      }
    }
  }

  if (toCreate.length) {
    await db.insert(alerts).values(toCreate);
    created = toCreate.length;
  }
  // 解消したopenをresolvedに
  for (const a of openRows) {
    const key = `${a.channelListingId}:${a.type}`;
    if (!stillActive.has(key)) {
      await db.update(alerts).set({ status: 'resolved' }).where(eq(alerts.id, a.id));
      resolved++;
    }
  }

  const [openNow] = await db
    .select({ n: count() })
    .from(alerts)
    .where(and(eq(alerts.tenantId, tenantId), eq(alerts.status, 'open')));

  return { scanned: rows.length, created, resolved, open: openNow?.n ?? 0 };
}

export async function setAlertStatus(tenantId: string, id: string, status: string) {
  if (!['open', 'ack', 'resolved'].includes(status)) return null;
  const [r] = await db
    .update(alerts)
    .set({ status })
    .where(and(eq(alerts.id, id), eq(alerts.tenantId, tenantId)))
    .returning();
  return r ?? null;
}
