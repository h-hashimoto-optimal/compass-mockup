import { NextResponse } from 'next/server';
import { resolveTenantByToken } from '@/lib/tenant-token';
import { ingestListing } from '@/lib/data/listings';
import { createBatch } from '@/lib/data/batches';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 拡張からの取込（Cookieでなくテナントトークンで認証）。host_permissions運用ならCORSは不要だが念のため許可。
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Compass-Token',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function toInt(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  const token = req.headers.get('x-compass-token');
  const tenantId = await resolveTenantByToken(token);
  if (!tenantId) {
    return NextResponse.json({ error: 'invalid token' }, { status: 401, headers: CORS });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  // 単一 {asin,...} でも バッチ {items:[...]} でも受ける。チャネルは既定でcoupang（UIスコープ）。
  const items = (Array.isArray(body.items) ? body.items : body.asin ? [body] : []) as Array<
    Record<string, unknown>
  >;
  if (items.length === 0) {
    return NextResponse.json({ error: 'asin または items[] が必要です' }, { status: 400, headers: CORS });
  }

  // 取得グループ（拡張1回分）を作成。検索語/取得日時/取得元URLで束ねる。
  const validCount = items.filter((it) => String(it.asin ?? it.sourceProductId ?? '').trim().length === 10).length;
  const batch = await createBatch(tenantId, {
    source: 'amazon',
    query: body.query ? String(body.query) : null,
    url: body.url ? String(body.url) : null,
    capturedAt: body.capturedAt ? String(body.capturedAt) : null,
    itemCount: validCount,
  });

  let created = 0;
  let blocked = 0;
  const results: Array<{ asin: string; status: 'created' | 'exists' | 'blocked' }> = [];
  for (const it of items) {
    const sourceProductId = String(it.asin ?? it.sourceProductId ?? '').trim();
    if (sourceProductId.length !== 10) continue; // ASINは10桁
    const r = await ingestListing(tenantId, {
      source: 'amazon',
      channel: 'coupang',
      sourceProductId,
      url: it.url ? String(it.url) : null,
      titleJa: it.title ? String(it.title) : it.titleJa ? String(it.titleJa) : null,
      priceJpy: toInt(it.priceJpy ?? it.price),
      brand: it.brand ? String(it.brand) : null,
      imageUrl: it.imageUrl ? String(it.imageUrl) : it.image ? String(it.image) : null,
      ingestBatchId: batch.id,
    });
    if (r.blocked) {
      blocked++;
      results.push({ asin: sourceProductId, status: 'blocked' });
      continue;
    }
    if (r.created) created++;
    results.push({ asin: sourceProductId, status: r.created ? 'created' : 'exists' });
  }

  return NextResponse.json({ received: items.length, created, blocked, batchId: batch.id, results }, { status: 201, headers: CORS });
}
