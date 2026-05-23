import { NextResponse } from 'next/server';
import {
  addDynamic,
  getAllDynamic,
  removeDynamicByCode,
  removeDynamicByCodes,
} from '@/lib/blacklist-store';
import { asinBlacklist, type BlacklistEntry, type SourcePlatform } from '@/lib/mock-data';

export function GET() {
  const seed = asinBlacklist;
  const dynamic = getAllDynamic();
  return NextResponse.json({
    seed,
    dynamic,
    all: [...dynamic, ...seed],
  });
}

export async function POST(req: Request) {
  let body: {
    entries?: Array<{
      source?: SourcePlatform;
      code?: string;
      title?: string;
      reason?: string;
    }>;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* allow empty */
  }
  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    return NextResponse.json({ error: 'entries[] is required' }, { status: 400 });
  }
  const now = new Date().toISOString().slice(0, 10);
  const entries: BlacklistEntry[] = body.entries
    .filter((e): e is typeof e & { code: string } => typeof e.code === 'string' && e.code.length > 0)
    .map((e, i) => ({
      id: `BL-DYN-${Date.now()}-${i}`,
      source: (e.source ?? 'amazon') as SourcePlatform,
      code: e.code,
      title: e.title ?? '（受信トレイから除外）',
      reason: e.reason ?? '受信トレイから除外操作',
      addedAt: now,
      addedBy: 'optimal_shop',
    }));
  const result = addDynamic(entries);
  return NextResponse.json({ added: result.added, total: result.total });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const codes = url.searchParams.get('codes');
  if (codes) {
    const removed = removeDynamicByCodes(codes.split(','));
    return NextResponse.json({ removed });
  }
  if (code) {
    const ok = removeDynamicByCode(code);
    return NextResponse.json({ removed: ok ? 1 : 0 });
  }
  return NextResponse.json({ error: 'code or codes query is required' }, { status: 400 });
}
