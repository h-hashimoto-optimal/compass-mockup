import { NextResponse } from 'next/server';
import { currentTenantId } from '@/lib/tenant';
import { listBlacklist, addBlacklist, deleteBlacklist } from '@/lib/data/lists';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const t = await currentTenantId();
  if (!t) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  return NextResponse.json({ items: await listBlacklist(t) });
}
export async function POST(req: Request) {
  const t = await currentTenantId();
  if (!t) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { source?: string; sourceProductId?: string; asin?: string; reason?: string };
  const source = b.source ?? 'amazon';
  const spid = (b.sourceProductId ?? b.asin ?? '').trim();
  if (!spid) return NextResponse.json({ error: 'ASIN/商品コードは必須です' }, { status: 400 });
  const r = await addBlacklist(t, source, spid, b.reason);
  return NextResponse.json({ item: r }, { status: r ? 201 : 200 });
}
export async function DELETE(req: Request) {
  const t = await currentTenantId();
  if (!t) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 });
  return NextResponse.json({ ok: await deleteBlacklist(t, id) });
}
