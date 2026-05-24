import { NextResponse } from 'next/server';
import { currentTenantId } from '@/lib/tenant';
import { submitListing } from '@/lib/data/submit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 単一商品をCoupangへ送る。認証情報が無ければ dry-run、必須欠落なら blocked。
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const tenantId = await currentTenantId();
  if (!tenantId) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  try {
    const result = await submitListing(tenantId, params.id);
    const status = result.mode === 'blocked' ? 422 : 200;
    return NextResponse.json(result, { status });
  } catch (e) {
    const msg = (e as Error).message;
    const status = msg === 'NOT_FOUND' ? 404 : msg === 'UNSUPPORTED_CHANNEL' ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
