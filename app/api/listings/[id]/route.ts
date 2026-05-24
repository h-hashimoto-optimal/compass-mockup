import { NextResponse } from 'next/server';
import { currentTenantId } from '@/lib/tenant';
import { getTenantListing, updateListing, softDeleteListing } from '@/lib/data/listings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 出品1件の取得（テナント・スコープ）
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const tenantId = await currentTenantId();
  if (!tenantId) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  const listing = await getTenantListing(tenantId, params.id);
  if (!listing) return NextResponse.json({ error: '対象なし' }, { status: 404 });
  return NextResponse.json({ listing });
}

// 出品の個別編集（タイトル/翻訳/売価/赤字下限）
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const tenantId = await currentTenantId();
  if (!tenantId) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const updated = await updateListing(tenantId, params.id, body);
  if (!updated) return NextResponse.json({ error: '対象なし／更新項目なし' }, { status: 404 });
  return NextResponse.json({ listing: updated });
}

// 出品の論理削除
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const tenantId = await currentTenantId();
  if (!tenantId) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  const ok = await softDeleteListing(tenantId, params.id);
  if (!ok) return NextResponse.json({ error: '対象なし' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
