import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tenants } from '@/lib/db/schema';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 加盟店の停止/再開（本部のみ）。停止中はその加盟店ユーザーのログイン・アクセスを遮断。
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (session?.role !== 'owner') {
    return NextResponse.json({ error: '権限がありません（本部のみ）' }, { status: 403 });
  }
  const { status } = (await req.json().catch(() => ({}))) as { status?: string };
  if (status !== 'active' && status !== 'suspended') {
    return NextResponse.json({ error: 'status は active / suspended のみ' }, { status: 400 });
  }
  await db.update(tenants).set({ status }).where(eq(tenants.id, params.id));
  return NextResponse.json({ ok: true, status });
}
