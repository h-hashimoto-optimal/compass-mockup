import { NextResponse } from 'next/server';
import { currentTenantId } from '@/lib/tenant';
import { listBatchItems } from '@/lib/data/batches';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await currentTenantId();
  if (!t) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  return NextResponse.json({ items: await listBatchItems(t, (await params).id) });
}
