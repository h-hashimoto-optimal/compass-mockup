// sync_cs ジョブ本体：テナントのCoupang鍵でCS問い合わせを取得し cs_inquiries へ冪等 upsert。
import { withTenant } from '@/lib/db';
import { csInquiries } from '@/lib/db/schema';
import { getIntegrationSecrets } from '@/lib/data/integrations';
import { fetchCoupangInquiries } from '@/lib/channels/coupang/cs';

export async function syncTenantCs(tenantId: string): Promise<{ fetched: number; upserted: number }> {
  const s = await getIntegrationSecrets<Record<string, string>>(tenantId, 'coupang');
  if (!s?.vendorId || !s?.accessKey || !s?.secretKey) return { fetched: 0, upserted: 0 };
  const creds = { vendorId: s.vendorId, accessKey: s.accessKey, secretKey: s.secretKey };

  const to = new Date();
  const from = new Date(to.getTime() - 3 * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const list = await fetchCoupangInquiries(creds, { inquiryStartAt: fmt(from), inquiryEndAt: fmt(to) });

  let upserted = 0;
  for (const q of list) {
    if (!q.channelInquiryId) continue;
    await withTenant(tenantId, (tx) =>
      tx
        .insert(csInquiries)
        .values({
          tenantId,
          channel: 'coupang',
          channelInquiryId: q.channelInquiryId,
          type: q.type,
          content: q.content,
          status: q.status,
          receivedAt: q.receivedAt ? new Date(q.receivedAt) : null,
          raw: q.raw,
        })
        .onConflictDoUpdate({
          target: [csInquiries.tenantId, csInquiries.channel, csInquiries.channelInquiryId],
          set: { status: q.status, raw: q.raw },
        }),
    );
    upserted++;
  }
  return { fetched: list.length, upserted };
}
