// 定期ジョブの投入。重複を避けるため「同種の queued/running が無いときだけ」入れる簡易版。
// 将来: 優先度ティア(hot/warm/cold)や実行間隔をここで制御する。
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { jobs, tenants } from '@/lib/db/schema';
import { enqueue } from './queue';

async function hasPending(type: string, tenantId?: string): Promise<boolean> {
  const rows = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        eq(jobs.type, type),
        inArray(jobs.status, ['queued', 'running']),
        tenantId ? eq(jobs.tenantId, tenantId) : isNull(jobs.tenantId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function enqueueDue(): Promise<{ enqueued: number }> {
  let n = 0;
  // ① crawl_source は全社共通で1本だけ（due な source を内部で拾う）
  if (!(await hasPending('crawl_source'))) {
    await enqueue('crawl_source', { payload: { limit: 100 } });
    n++;
  }
  // 為替日次（全社共通・1本）
  if (!(await hasPending('fetch_fx'))) {
    await enqueue('fetch_fx');
    n++;
  }
  // ②③ テナントごとに scan_alerts / sync_orders
  const active = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.status, 'active'));
  for (const t of active) {
    if (!(await hasPending('scan_alerts', t.id))) {
      await enqueue('scan_alerts', { tenantId: t.id });
      n++;
    }
    if (!(await hasPending('sync_orders', t.id))) {
      await enqueue('sync_orders', { tenantId: t.id });
      n++;
    }
    if (!(await hasPending('auto_stop', t.id))) {
      await enqueue('auto_stop', { tenantId: t.id });
      n++;
    }
    if (!(await hasPending('sync_cs', t.id))) {
      await enqueue('sync_cs', { tenantId: t.id });
      n++;
    }
    if (!(await hasPending('sync_returns', t.id))) {
      await enqueue('sync_returns', { tenantId: t.id });
      n++;
    }
    if (!(await hasPending('reconcile_status', t.id))) {
      await enqueue('reconcile_status', { tenantId: t.id });
      n++;
    }
    if (!(await hasPending('notify', t.id))) {
      await enqueue('notify', { tenantId: t.id });
      n++;
    }
  }
  return { enqueued: n };
}
