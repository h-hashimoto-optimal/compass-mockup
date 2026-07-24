import { NextResponse } from 'next/server';
import { currentTenantId } from '@/lib/tenant';
import { processListing } from '@/lib/data/process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 出品1件をパイプライン処理（mock/dry-run）：取得→翻訳→価格/floor→保存
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await currentTenantId();
  if (!tenantId) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  try {
    const listing = await processListing(tenantId, (await params).id);
    return NextResponse.json({ ok: true, listing });
  } catch (e) {
    const msg = (e as Error).message;
    const status =
      msg === 'NOT_FOUND' ? 404 : msg === 'NOT_PROCESSABLE' ? 409 : msg === 'UNSUPPORTED_SOURCE' ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
