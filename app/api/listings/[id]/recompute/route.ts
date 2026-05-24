import { NextResponse } from 'next/server';
import { currentTenantId } from '@/lib/tenant';
import { recomputeListing, profitBreakdown } from '@/lib/data/recompute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 価格の再計算（設定＋個別上書きから売価/赤字下限を再計算して保存）。損益内訳も返す。
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const t = await currentTenantId();
  if (!t) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  try {
    const r = await recomputeListing(t, params.id);
    const breakdown = await profitBreakdown(t, params.id);
    return NextResponse.json({ ...r, breakdown });
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json({ error: msg }, { status: msg === 'NOT_FOUND' ? 404 : 500 });
  }
}
