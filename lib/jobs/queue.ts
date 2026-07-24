// ジョブキュー（Postgres jobs表）。複数ワーカーで安全に取り出すため FOR UPDATE SKIP LOCKED を使う。
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { jobs } from '@/lib/db/schema';

export type JobType = 'scan_alerts' | 'crawl_source' | 'sync_orders';

export type ClaimedJob = {
  id: number;
  type: string;
  tenantId: string | null;
  payload: unknown;
  attempts: number;
};

const MAX_ATTEMPTS = 5;

export async function enqueue(
  type: JobType,
  opts?: { tenantId?: string | null; payload?: unknown; runAt?: Date },
): Promise<void> {
  await db.insert(jobs).values({
    type,
    tenantId: opts?.tenantId ?? null,
    payload: opts?.payload ?? null,
    runAt: opts?.runAt ?? new Date(),
  });
}

// due な queued を最大 limit 件 running に遷移させて取り出す（他ワーカーが掴んだ行はSKIP）。
export async function claimJobs(limit: number): Promise<ClaimedJob[]> {
  const res = (await db.execute(sql`
    UPDATE jobs SET status = 'running', locked_at = now()
    WHERE id IN (
      SELECT id FROM jobs
      WHERE status = 'queued' AND run_at <= now()
      ORDER BY run_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, type, tenant_id AS "tenantId", payload, attempts
  `)) as unknown as {
    rows: Array<{ id: string | number; type: string; tenantId: string | null; payload: unknown; attempts: string | number }>;
  };
  return (res.rows ?? []).map((r) => ({
    id: Number(r.id),
    type: r.type,
    tenantId: r.tenantId,
    payload: r.payload,
    attempts: Number(r.attempts),
  }));
}

export async function completeJob(id: number): Promise<void> {
  await db.update(jobs).set({ status: 'done', lockedAt: null }).where(eq(jobs.id, id));
}

// 失敗：MAX未満なら指数バックオフで再投入、超えたら failed。
export async function failJob(id: number, attempts: number, err: string): Promise<void> {
  const next = attempts + 1;
  if (next >= MAX_ATTEMPTS) {
    await db
      .update(jobs)
      .set({ status: 'failed', attempts: next, lastError: err.slice(0, 500), lockedAt: null })
      .where(eq(jobs.id, id));
    return;
  }
  const backoffSec = Math.min(3600, 30 * 2 ** attempts); // 30s,60,120,... 最大1h
  await db
    .update(jobs)
    .set({
      status: 'queued',
      attempts: next,
      lastError: err.slice(0, 500),
      lockedAt: null,
      runAt: new Date(Date.now() + backoffSec * 1000),
    })
    .where(eq(jobs.id, id));
}
