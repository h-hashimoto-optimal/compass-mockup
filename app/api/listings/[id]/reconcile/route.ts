import { NextResponse } from 'next/server';
import { currentTenantId } from '@/lib/tenant';
import { reconcileListing } from '@/lib/data/reconcile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 出品1件をCoupangと状態同期。
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const t = await currentTenantId();
  if (!t) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  try {
    return NextResponse.json(await reconcileListing(t, params.id));
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json({ error: msg }, { status: msg === 'NOT_FOUND' ? 404 : 500 });
  }
}
