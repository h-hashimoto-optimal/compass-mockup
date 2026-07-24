import { NextResponse } from 'next/server';
import { currentTenantId } from '@/lib/tenant';
import { previewListing } from '@/lib/data/preview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 出品プレビュー＋Coupang dry-run（実送信なし）。プレビュー画面が叩く。
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await currentTenantId();
  if (!tenantId) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  try {
    const result = await previewListing(tenantId, (await params).id);
    return NextResponse.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    const status = msg === 'NOT_FOUND' ? 404 : msg === 'UNSUPPORTED_CHANNEL' ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
