import { NextResponse } from 'next/server';
import { currentTenantId } from '@/lib/tenant';
import { reconcileTenant } from '@/lib/data/reconcile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 自店舗の送信済み出品をCoupangと状態同期（承認/販売を取り込む）。
export async function POST() {
  const t = await currentTenantId();
  if (!t) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  return NextResponse.json(await reconcileTenant(t));
}
