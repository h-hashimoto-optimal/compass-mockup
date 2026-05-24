// テナント別の価格設定（仕入側 tenant_settings ＋ 販売側 tenant_channel_settings[coupang]）。
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tenantSettings, tenantChannelSettings } from '@/lib/db/schema';

export async function getTenantSettings(tenantId: string) {
  const [settings] = await db
    .select()
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);
  const [coupang] = await db
    .select()
    .from(tenantChannelSettings)
    .where(and(eq(tenantChannelSettings.tenantId, tenantId), eq(tenantChannelSettings.channel, 'coupang')))
    .limit(1);
  return { settings: settings ?? null, coupang: coupang ?? null };
}

// 率は 0〜1 にクランプして4桁文字列（numeric列用）。
const rate = (v: unknown): string | undefined => {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(1, n)).toFixed(4);
};
const intOf = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : undefined;
};

type SaveBody = {
  settings?: { marginRate?: unknown; fxBuffer?: unknown; domesticShippingJpy?: unknown };
  coupang?: { sellFeeRate?: unknown; priceRounding?: unknown };
};

export async function saveTenantSettings(tenantId: string, body: SaveBody) {
  // 仕入側
  const s: Record<string, unknown> = { updatedAt: new Date() };
  const mr = rate(body.settings?.marginRate);
  if (mr !== undefined) s.marginRate = mr;
  const fb = rate(body.settings?.fxBuffer);
  if (fb !== undefined) s.fxBuffer = fb;
  const ds = intOf(body.settings?.domesticShippingJpy);
  if (ds !== undefined) s.domesticShippingJpy = ds;
  if (Object.keys(s).length > 1) {
    const upd = await db.update(tenantSettings).set(s).where(eq(tenantSettings.tenantId, tenantId)).returning();
    if (upd.length === 0) await db.insert(tenantSettings).values({ tenantId, ...s });
  }

  // 販売側（coupang）
  const c: Record<string, unknown> = { updatedAt: new Date() };
  const sf = rate(body.coupang?.sellFeeRate);
  if (sf !== undefined) c.sellFeeRate = sf;
  const pr = intOf(body.coupang?.priceRounding);
  if (pr !== undefined) c.priceRounding = pr;
  if (Object.keys(c).length > 1) {
    const upd = await db
      .update(tenantChannelSettings)
      .set(c)
      .where(and(eq(tenantChannelSettings.tenantId, tenantId), eq(tenantChannelSettings.channel, 'coupang')))
      .returning();
    if (upd.length === 0) await db.insert(tenantChannelSettings).values({ tenantId, channel: 'coupang', ...c });
  }

  return getTenantSettings(tenantId);
}
