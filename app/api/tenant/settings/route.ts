import { NextResponse } from 'next/server';
import { currentTenantId } from '@/lib/tenant';
import { getTenantSettings, saveTenantSettings } from '@/lib/data/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const tenantId = await currentTenantId();
  if (!tenantId) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  return NextResponse.json(await getTenantSettings(tenantId));
}

export async function PUT(req: Request) {
  const tenantId = await currentTenantId();
  if (!tenantId) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  return NextResponse.json(await saveTenantSettings(tenantId, body));
}
