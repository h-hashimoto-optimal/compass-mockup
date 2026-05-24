import { NextResponse } from 'next/server';
import { currentTenantId } from '@/lib/tenant';
import { listNgWords, addNgWord, deleteNgWord } from '@/lib/data/lists';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const t = await currentTenantId();
  if (!t) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  return NextResponse.json({ items: await listNgWords(t) });
}
export async function POST(req: Request) {
  const t = await currentTenantId();
  if (!t) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { word?: string; mode?: string; replacement?: string };
  if (!b.word?.trim()) return NextResponse.json({ error: 'word は必須です' }, { status: 400 });
  const r = await addNgWord(t, b.word.trim(), b.mode ?? 'block', b.replacement);
  return NextResponse.json({ item: r }, { status: r ? 201 : 200 });
}
export async function DELETE(req: Request) {
  const t = await currentTenantId();
  if (!t) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 });
  return NextResponse.json({ ok: await deleteNgWord(t, id) });
}
