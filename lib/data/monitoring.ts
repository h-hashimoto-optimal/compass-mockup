// テナント別 監視設定（scanAlertsのしきい値・通知先）。
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tenantMonitoringSettings } from '@/lib/db/schema';

export type MonitoringSettings = {
  detectLoss: boolean;
  detectOos: boolean;
  lossBufferPct: number; // 0=実赤字のみ / 0.1=floorの10%手前から警告
  notifyEmail: boolean;
  notifyChatwork: boolean;
};

const DEFAULTS: MonitoringSettings = {
  detectLoss: true,
  detectOos: true,
  lossBufferPct: 0,
  notifyEmail: false,
  notifyChatwork: false,
};

export async function getMonitoringSettings(tenantId: string): Promise<MonitoringSettings> {
  const [r] = await db
    .select()
    .from(tenantMonitoringSettings)
    .where(eq(tenantMonitoringSettings.tenantId, tenantId))
    .limit(1);
  if (!r) return { ...DEFAULTS };
  return {
    detectLoss: r.detectLoss,
    detectOos: r.detectOos,
    lossBufferPct: Number(r.lossBufferPct) || 0,
    notifyEmail: r.notifyEmail,
    notifyChatwork: r.notifyChatwork,
  };
}

export async function saveMonitoringSettings(tenantId: string, s: Partial<MonitoringSettings>) {
  const clamp = (n: unknown) => {
    const v = Number(n);
    return Number.isFinite(v) ? Math.min(Math.max(v, 0), 0.9).toFixed(4) : '0';
  };
  const set = {
    detectLoss: s.detectLoss ?? true,
    detectOos: s.detectOos ?? true,
    lossBufferPct: clamp(s.lossBufferPct),
    notifyEmail: s.notifyEmail ?? false,
    notifyChatwork: s.notifyChatwork ?? false,
    updatedAt: new Date(),
  };
  await db
    .insert(tenantMonitoringSettings)
    .values({ tenantId, ...set })
    .onConflictDoUpdate({ target: tenantMonitoringSettings.tenantId, set });
  return getMonitoringSettings(tenantId);
}
