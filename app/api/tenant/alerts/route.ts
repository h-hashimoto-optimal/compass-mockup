import { NextResponse } from 'next/server';
import { currentTenantId } from '@/lib/tenant';
import { listAlerts } from '@/lib/data/alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const t = await currentTenantId();
  if (!t) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  const status = new URL(req.url).searchParams.get('status') || undefined;
  return NextResponse.json({ items: await listAlerts(t, status) });
}
