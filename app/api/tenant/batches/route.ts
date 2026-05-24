import { NextResponse } from 'next/server';
import { currentTenantId } from '@/lib/tenant';
import { listBatches } from '@/lib/data/batches';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const t = await currentTenantId();
  if (!t) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  return NextResponse.json({ items: await listBatches(t) });
}
