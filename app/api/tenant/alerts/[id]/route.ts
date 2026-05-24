import { NextResponse } from 'next/server';
import { currentTenantId } from '@/lib/tenant';
import { setAlertStatus } from '@/lib/data/alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// アラートの状態更新（ack/resolved）。テナント・スコープ。
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const t = await currentTenantId();
  if (!t) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { status?: string };
  if (!b.status) return NextResponse.json({ error: 'status が必要です' }, { status: 400 });
  const r = await setAlertStatus(t, params.id, b.status);
  if (!r) return NextResponse.json({ error: '更新できませんでした' }, { status: 400 });
  return NextResponse.json({ item: r });
}
