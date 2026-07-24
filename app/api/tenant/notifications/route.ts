import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withTenant } from '@/lib/db';
import { alerts } from '@/lib/db/schema';
import { currentTenantId } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// アプリ内通知センター：未読(open)アラートの件数＋一覧（ベル/未読バッジ用）。
export async function GET() {
  const t = await currentTenantId();
  if (!t) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  const items = await withTenant(t, (tx) =>
    tx
      .select({
        id: alerts.id,
        type: alerts.type,
        detail: alerts.detail,
        createdAt: alerts.createdAt,
        channelListingId: alerts.channelListingId,
      })
      .from(alerts)
      .where(and(eq(alerts.tenantId, t), eq(alerts.status, 'open')))
      .orderBy(alerts.createdAt),
  );
  return NextResponse.json({ unread: items.length, items });
}
