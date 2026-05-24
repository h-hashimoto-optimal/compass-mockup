// Coupang状態同期(reconcile)：送信済(submitted)の出品について、Coupangの承認/販売ステータスを取り込む。
// 実キーがあれば実API GET、無ければモック。読み取り専用（Coupangを変更しない）。
import { and, eq, isNull } from 'drizzle-orm';
import { withTenant } from '@/lib/db';
import { channelListings } from '@/lib/db/schema';
import { getIntegrationSecrets } from '@/lib/data/integrations';
import { fetchCoupangProductStatus } from '@/lib/channels/coupang/status';

async function coupangCreds(tenantId: string) {
  const s = await getIntegrationSecrets<Record<string, string>>(tenantId, 'coupang');
  if (!s || !s.vendorId || !s.accessKey || !s.secretKey) return null;
  return { vendorId: s.vendorId, accessKey: s.accessKey, secretKey: s.secretKey };
}

// 1件同期。submitted かつ sellerProductId(channelProductId) があるものだけ対象。
export async function reconcileListing(tenantId: string, listingId: string) {
  const [row] = await withTenant(tenantId, (tx) =>
    tx
      .select({
        id: channelListings.id,
        status: channelListings.status,
        channelProductId: channelListings.channelProductId,
      })
      .from(channelListings)
      .where(
        and(
          eq(channelListings.id, listingId),
          eq(channelListings.tenantId, tenantId),
          isNull(channelListings.deletedAt),
        ),
      )
      .limit(1),
  );
  if (!row) throw new Error('NOT_FOUND');
  if (row.status !== 'submitted' || !row.channelProductId) {
    return { ok: false as const, skipped: true, reason: '未送信（submittedかつsellerProductIdが必要）' };
  }

  const creds = await coupangCreds(tenantId);
  const st = await fetchCoupangProductStatus(row.channelProductId, creds);

  await withTenant(tenantId, (tx) =>
    tx
      .update(channelListings)
      .set({
        coupangApprovalStatus: st.approvalStatus,
        coupangSalesStatus: st.salesStatus,
        channelItemId: st.vendorItemId ?? undefined,
        rejectedReason: st.rejectedReason,
        lastSyncedAt: new Date(),
      })
      .where(and(eq(channelListings.id, listingId), eq(channelListings.tenantId, tenantId))),
  );
  return { ok: true as const, ...st };
}

// テナントの submitted 出品をまとめて同期。
export async function reconcileTenant(tenantId: string) {
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .select({ id: channelListings.id, channelProductId: channelListings.channelProductId })
      .from(channelListings)
      .where(
        and(
          eq(channelListings.tenantId, tenantId),
          eq(channelListings.status, 'submitted'),
          isNull(channelListings.deletedAt),
        ),
      ),
  );
  const targets = rows.filter((r) => r.channelProductId);
  let updated = 0;
  for (const r of targets) {
    const res = await reconcileListing(tenantId, r.id);
    if (res.ok) updated++;
  }
  return { scanned: targets.length, updated };
}
