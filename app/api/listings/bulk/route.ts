import { NextResponse } from 'next/server';
import { currentTenantId } from '@/lib/tenant';
import { processListing } from '@/lib/data/process';
import { submitListing } from '@/lib/data/submit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 一括処理／一括送信。ids を順に処理して結果配列を返す。
export async function POST(req: Request) {
  const tenantId = await currentTenantId();
  if (!tenantId) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });

  const { ids, action } = (await req.json().catch(() => ({}))) as {
    ids?: string[];
    action?: 'process' | 'submit';
  };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids が必要です' }, { status: 400 });
  }
  if (action !== 'process' && action !== 'submit') {
    return NextResponse.json({ error: "action は process / submit" }, { status: 400 });
  }

  const results: Array<{ id: string; ok: boolean; mode?: string; error?: string }> = [];
  for (const id of ids) {
    try {
      if (action === 'process') {
        await processListing(tenantId, id);
        results.push({ id, ok: true });
      } else {
        const r = await submitListing(tenantId, id);
        results.push({ id, ok: r.mode !== 'blocked', mode: r.mode });
      }
    } catch (e) {
      results.push({ id, ok: false, error: (e as Error).message });
    }
  }
  return NextResponse.json({ results });
}
