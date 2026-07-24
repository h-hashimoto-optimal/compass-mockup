// notify ジョブ本体：未通知(open かつ notified_at NULL)のアラートを加盟者にメールダイジェスト送信。
// アプリ内通知センターは alerts(open) をそのまま読む（/api/tenant/notifications）。メールは配信経路。
// ※ 日次1通の厳密なダイジェストはスケジューラ側で頻度制御して拡張（現状は新規アラートをまとめて1通）。
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { withTenant } from '@/lib/db';
import { alerts, users, tenantMonitoringSettings } from '@/lib/db/schema';
import { sendEmail } from '@/lib/notify/email';

export async function notifyTenant(tenantId: string): Promise<{ notified: number; emailed: boolean }> {
  const open = await withTenant(tenantId, (tx) =>
    tx
      .select({ id: alerts.id, type: alerts.type })
      .from(alerts)
      .where(and(eq(alerts.tenantId, tenantId), eq(alerts.status, 'open'), isNull(alerts.notifiedAt))),
  );
  if (open.length === 0) return { notified: 0, emailed: false };

  const [ms] = await withTenant(tenantId, (tx) =>
    tx
      .select()
      .from(tenantMonitoringSettings)
      .where(eq(tenantMonitoringSettings.tenantId, tenantId))
      .limit(1),
  );

  let emailed = false;
  if (ms?.notifyEmail) {
    const [u] = await withTenant(tenantId, (tx) =>
      tx
        .select({ email: users.email })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.status, 'active')))
        .limit(1),
    );
    if (u?.email) {
      const loss = open.filter((a) => a.type === 'price_up_loss').length;
      const oos = open.filter((a) => a.type === 'out_of_stock').length;
      const html =
        `<p>Compass アラート通知</p>` +
        `<ul><li>赤字(価格逆転): ${loss}件</li><li>在庫切れ: ${oos}件</li></ul>` +
        `<p>詳細はCompassのアラート画面をご確認ください。</p>`;
      const r = await sendEmail(u.email, `[Compass] 新規アラート ${open.length}件`, html);
      emailed = r.sent;
    }
  }

  // メール送信できた時だけ notified_at をセット（送れない時は在庫として残し、次回配信可能に）
  if (emailed) {
    const ids = open.map((a) => a.id);
    await withTenant(tenantId, (tx) =>
      tx
        .update(alerts)
        .set({ notifiedAt: new Date() })
        .where(and(eq(alerts.tenantId, tenantId), inArray(alerts.id, ids))),
    );
  }
  return { notified: open.length, emailed };
}
