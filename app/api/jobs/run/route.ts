import { NextResponse } from 'next/server';
import { enqueueDue } from '@/lib/jobs/scheduler';
import { runDueBatch } from '@/lib/jobs/runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // self-host/VPS前提。serverlessなら短めに＆バッチ件数を絞る

// バッチワーカーが叩く実行口。X-Worker-Token で保護。scripts/worker.mjs から定期POST。
export async function POST(req: Request) {
  const token = req.headers.get('x-worker-token');
  if (!process.env.WORKER_TOKEN || token !== process.env.WORKER_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const scheduled = await enqueueDue();
  const result = await runDueBatch(10);
  return NextResponse.json({ scheduled, ...result });
}
