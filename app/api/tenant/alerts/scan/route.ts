import { NextResponse } from 'next/server';
import { currentTenantId } from '@/lib/tenant';
import { scanAlerts } from '@/lib/data/alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 自店舗の有効出品を走査して赤字/欠品アラートを更新（冪等）。
export async function POST() {
  const t = await currentTenantId();
  if (!t) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  return NextResponse.json(await scanAlerts(t));
}
