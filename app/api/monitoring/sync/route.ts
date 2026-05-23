import { NextResponse } from 'next/server';
import {
  simulateSourceRefresh,
  evaluate,
  getMonitorConfig,
} from '@/lib/monitoring';
import {
  replaceAlerts,
  getAlerts,
  getLastSyncAt,
  markNotified,
} from '@/lib/alert-store';
import { sendAlertNotifications, getNotifyLog } from '@/lib/notify';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    lastSyncAt: getLastSyncAt(),
    config: getMonitorConfig(),
    alerts: getAlerts(),
    notifyLog: getNotifyLog(),
  });
}

// 在庫同期ジョブ：仕入元再取得 → 赤字/在庫切れ/低マージン検知 → 保存 → 通知
export function POST() {
  const at = new Date().toISOString();
  const snapshots = simulateSourceRefresh(at);
  const cfg = getMonitorConfig();
  const detected = evaluate(snapshots, cfg);
  const stored = replaceAlerts(detected, at);
  const sent = sendAlertNotifications(stored, cfg);
  markNotified(sent.notifiedIds);

  return NextResponse.json({
    syncedAt: at,
    scanned: snapshots.length,
    detected: stored.length,
    bySeverity: {
      critical: stored.filter((a) => a.severity === 'critical').length,
      warning: stored.filter((a) => a.severity === 'warning').length,
    },
    notified: sent.notifiedIds.length,
    channels: sent.channels,
    alerts: getAlerts(),
  });
}
