import { NextResponse } from 'next/server';
import { currentTenantId } from '@/lib/tenant';
import { listOrders } from '@/lib/data/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const t = await currentTenantId();
  if (!t) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  return NextResponse.json({ items: await listOrders(t) });
}
