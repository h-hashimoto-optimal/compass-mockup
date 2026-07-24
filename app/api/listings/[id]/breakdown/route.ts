import { NextResponse } from 'next/server';
import { currentTenantId } from '@/lib/tenant';
import { profitBreakdown } from '@/lib/data/recompute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 損益内訳（読み取り専用）。現在の売価・手数料・配送料・仕入から利益を算出。
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await currentTenantId();
  if (!t) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  try {
    return NextResponse.json(await profitBreakdown(t, (await params).id));
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json({ error: msg }, { status: msg === 'NOT_FOUND' ? 404 : 500 });
  }
}
