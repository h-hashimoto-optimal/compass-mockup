import { NextResponse } from 'next/server';
import { currentTenantId } from '@/lib/tenant';
import { getMonitoringSettings, saveMonitoringSettings } from '@/lib/data/monitoring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const t = await currentTenantId();
  if (!t) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  return NextResponse.json(await getMonitoringSettings(t));
}

export async function PUT(req: Request) {
  const t = await currentTenantId();
  if (!t) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(
    await saveMonitoringSettings(t, {
      detectLoss: b.detectLoss === undefined ? undefined : !!b.detectLoss,
      detectOos: b.detectOos === undefined ? undefined : !!b.detectOos,
      lossBufferPct: b.lossBufferPct === undefined ? undefined : Number(b.lossBufferPct),
      notifyEmail: b.notifyEmail === undefined ? undefined : !!b.notifyEmail,
      notifyChatwork: b.notifyChatwork === undefined ? undefined : !!b.notifyChatwork,
    }),
  );
}
