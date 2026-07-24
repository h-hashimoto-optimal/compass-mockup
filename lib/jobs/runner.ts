// ジョブ実行本体。claim → type別ハンドラへ dispatch → 完了/失敗。
import { claimJobs, completeJob, failJob, type ClaimedJob } from './queue';
import { scanAlerts } from '@/lib/data/alerts';
import { crawlSourceBatch } from '@/lib/data/crawl';
import { syncTenantOrders } from '@/lib/data/order-sync';
import { autoStopTenant } from '@/lib/data/auto-stop';
import { syncTenantCs } from '@/lib/data/cs-sync';
import { syncTenantReturns } from '@/lib/data/return-sync';
import { reconcileTenant } from '@/lib/data/reconcile';
import { fetchAndStoreFx } from '@/lib/data/fx';
import { notifyTenant } from '@/lib/data/notify';

type Handler = (job: ClaimedJob) => Promise<void>;

const HANDLERS: Record<string, Handler> = {
  // ① 赤字/欠品の判定（既存ロジックをジョブ化）
  scan_alerts: async (job) => {
    if (!job.tenantId) throw new Error('scan_alerts: tenantId 必須');
    await scanAlerts(job.tenantId);
  },
  // ② 仕入元(Amazon)の価格/在庫を最新化（全社共通・Keepa主）
  crawl_source: async (job) => {
    const p = job.payload as { limit?: number } | null;
    await crawlSourceBatch(typeof p?.limit === 'number' ? p.limit : 100);
  },
  // ③ Coupang注文の取り込み（テナント別）
  sync_orders: async (job) => {
    if (!job.tenantId) throw new Error('sync_orders: tenantId 必須');
    await syncTenantOrders(job.tenantId);
  },
  // ③ 赤字/欠品が継続した販売中出品を停止（既定OFF・テナント設定次第）
  auto_stop: async (job) => {
    if (!job.tenantId) throw new Error('auto_stop: tenantId 必須');
    await autoStopTenant(job.tenantId);
  },
  // ② CS問い合わせ取り込み
  sync_cs: async (job) => {
    if (!job.tenantId) throw new Error('sync_cs: tenantId 必須');
    await syncTenantCs(job.tenantId);
  },
  // ② 返品リクエスト取り込み
  sync_returns: async (job) => {
    if (!job.tenantId) throw new Error('sync_returns: tenantId 必須');
    await syncTenantReturns(job.tenantId);
  },
  // Coupang承認/販売ステータスの取込（既存reconcileをジョブ化）
  reconcile_status: async (job) => {
    if (!job.tenantId) throw new Error('reconcile_status: tenantId 必須');
    await reconcileTenant(job.tenantId);
  },
  // 為替(JPY→KRW)日次取得（全社共通）
  fetch_fx: async () => {
    await fetchAndStoreFx();
  },
  // 未通知アラートを加盟者にメール配信（アプリ内センターは alerts をそのまま参照）
  notify: async (job) => {
    if (!job.tenantId) throw new Error('notify: tenantId 必須');
    await notifyTenant(job.tenantId);
  },
};

export async function runDueBatch(limit = 10): Promise<{ processed: number; ok: number; failed: number }> {
  const claimed = await claimJobs(limit);
  let ok = 0;
  let failed = 0;
  for (const job of claimed) {
    try {
      const handler = HANDLERS[job.type];
      if (!handler) throw new Error(`未知のジョブ種別: ${job.type}`);
      await handler(job);
      await completeJob(job.id);
      ok++;
    } catch (e) {
      await failJob(job.id, job.attempts, e instanceof Error ? e.message : String(e));
      failed++;
    }
  }
  return { processed: claimed.length, ok, failed };
}
