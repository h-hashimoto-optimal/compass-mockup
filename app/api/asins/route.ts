import { NextResponse } from 'next/server';
import { appendUnique, clearAll, readAll, type CapturedAsin } from '@/lib/asin-store';
import { asinBlacklist } from '@/lib/mock-data';
import { getAllDynamic } from '@/lib/blacklist-store';
import { clearSubmitLog } from '@/lib/submit-log';

// ブラックリスト該当コード（mock-data のシード + 動的追加分）。
// 動的追加は受信トレイから「除外+BL追加」で増える。
function getCurrentBlacklist(): Set<string> {
  return new Set([
    ...asinBlacklist.map((b) => b.code),
    ...getAllDynamic().map((b) => b.code),
  ]);
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  const items = readAll();
  return NextResponse.json({ count: items.length, items }, { headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid JSON' },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const b = body as {
    source?: string;
    capturedAt?: string;
    url?: string;
    query?: string;
    items?: Array<{
      asin?: string;
      title?: string;
      brand?: string;
      priceJpy?: number | null;
      imageUrl?: string;
      url?: string;
    }>;
  };

  if (!Array.isArray(b.items) || b.items.length === 0) {
    return NextResponse.json(
      { error: 'items[] is required' },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const receivedAt = new Date().toISOString();
  const captured: CapturedAsin[] = b.items
    .filter((i): i is typeof i & { asin: string } => typeof i.asin === 'string' && i.asin.length === 10)
    .map((i) => ({
      asin: i.asin,
      title: i.title ?? '',
      brand: i.brand,
      priceJpy: typeof i.priceJpy === 'number' ? i.priceJpy : null,
      imageUrl: i.imageUrl ?? '',
      url: i.url ?? `https://www.amazon.co.jp/dp/${i.asin}`,
      source: b.source ?? 'amazon-jp',
      query: b.query ?? '',
      capturedAt: b.capturedAt ?? receivedAt,
      receivedAt,
    }));

  // ASINブラックリスト該当は取込時に自動除外
  const blacklist = getCurrentBlacklist();
  const blocked = captured.filter((c) => blacklist.has(c.asin));
  const accepted = captured.filter((c) => !blacklist.has(c.asin));

  const result = appendUnique(accepted);
  return NextResponse.json(
    {
      received: captured.length,
      added: result.added,
      blocked: blocked.length,
      blockedAsins: blocked.map((b) => b.asin),
      total: result.total,
    },
    { headers: CORS_HEADERS },
  );
}

export async function DELETE() {
  clearAll();
  clearSubmitLog();
  return NextResponse.json({ cleared: true }, { headers: CORS_HEADERS });
}
