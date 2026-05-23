import { NextResponse } from 'next/server';
import { removeMany } from '@/lib/asin-store';
import { addDynamic } from '@/lib/blacklist-store';
import type { BlacklistEntry } from '@/lib/mock-data';

// 受信トレイから複数件を削除する。addToBlacklist=true なら同時にBLにも入れる。
// レスポンスには削除した CapturedAsin と、BLに追加した entry を含める（undo用）。
export async function POST(req: Request) {
  let body: { asins?: string[]; addToBlacklist?: boolean; reason?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* allow empty */
  }
  if (!Array.isArray(body.asins) || body.asins.length === 0) {
    return NextResponse.json({ error: 'asins[] is required' }, { status: 400 });
  }

  const result = removeMany(body.asins);

  let addedToBlacklist: BlacklistEntry[] = [];
  if (body.addToBlacklist && result.removed.length > 0) {
    const now = new Date().toISOString().slice(0, 10);
    const entries: BlacklistEntry[] = result.removed.map((c, i) => ({
      id: `BL-DYN-${Date.now()}-${i}`,
      source: 'amazon',
      code: c.asin,
      title: c.title || '（商品名未取得）',
      reason: body.reason ?? '受信トレイから除外操作',
      addedAt: now,
      addedBy: 'optimal_shop',
    }));
    addDynamic(entries);
    addedToBlacklist = entries;
  }

  return NextResponse.json({
    removed: result.removed,
    inboxTotal: result.total,
    addedToBlacklist,
  });
}
