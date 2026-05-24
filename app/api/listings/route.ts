import { NextResponse } from 'next/server';
import { currentTenantId } from '@/lib/tenant';
import { ingestListing, listTenantListings } from '@/lib/data/listings';
import { SOURCES, CHANNELS } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toInt(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  const tenantId = await currentTenantId();
  if (!tenantId) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  return NextResponse.json({ listings: await listTenantListings(tenantId) });
}

export async function POST(req: Request) {
  const tenantId = await currentTenantId();
  if (!tenantId) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const source = String(body.source ?? '');
  const sourceProductId = String(body.sourceProductId ?? '').trim();
  const channel = String(body.channel ?? 'coupang');
  if (!(SOURCES as readonly string[]).includes(source)) {
    return NextResponse.json({ error: `source は ${SOURCES.join('/')} のいずれか` }, { status: 400 });
  }
  if (!(CHANNELS as readonly string[]).includes(channel)) {
    return NextResponse.json({ error: `channel は ${CHANNELS.join('/')} のいずれか` }, { status: 400 });
  }
  if (!sourceProductId) {
    return NextResponse.json({ error: 'sourceProductId は必須です' }, { status: 400 });
  }

  const res = await ingestListing(tenantId, {
    source,
    sourceProductId,
    channel,
    url: body.url ? String(body.url) : null,
    titleJa: body.titleJa ? String(body.titleJa) : null,
    priceJpy: toInt(body.priceJpy),
    brand: body.brand ? String(body.brand) : null,
    imageUrl: body.imageUrl ? String(body.imageUrl) : null,
  });
  if (res.blocked) {
    return NextResponse.json(
      { status: 'blocked', error: 'この商品は仕入ブラックリストに登録されています' },
      { status: 422 },
    );
  }
  return NextResponse.json(
    { status: res.created ? 'created' : 'exists', listing: res.listing },
    { status: res.created ? 201 : 200 },
  );
}
