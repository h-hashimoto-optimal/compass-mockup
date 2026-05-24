import { NextResponse } from 'next/server';
import { currentTenantId } from '@/lib/tenant';
import { listIpBrands, addIpBrand, deleteIpBrand } from '@/lib/data/lists';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const t = await currentTenantId();
  if (!t) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  const items = await listIpBrands(t);
  // 本部共有(tenant_id NULL)か自社かを判別できるよう own フラグを付ける
  return NextResponse.json({ items: items.map((r) => ({ ...r, own: r.tenantId === t })) });
}
export async function POST(req: Request) {
  const t = await currentTenantId();
  if (!t) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { brand?: string; level?: string };
  if (!b.brand?.trim()) return NextResponse.json({ error: 'brand は必須です' }, { status: 400 });
  const r = await addIpBrand(t, b.brand.trim(), b.level ?? 'warn');
  return NextResponse.json({ item: r }, { status: 201 });
}
export async function DELETE(req: Request) {
  const t = await currentTenantId();
  if (!t) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 });
  // 本部共有は削除不可（自社のみ）
  return NextResponse.json({ ok: await deleteIpBrand(t, id) });
}
