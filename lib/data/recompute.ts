// 価格の再計算（Amazon再取得・翻訳なしで、設定＋個別上書きから売価/赤字下限を計算）と
// 損益内訳（販売価格・手数料・配送料・仕入を加味した利益）の算出。
import { and, eq, isNull } from 'drizzle-orm';
import { db, withTenant } from '@/lib/db';
import { channelListings, sourceProducts, tenantSettings, tenantChannelSettings, fxRates } from '@/lib/db/schema';
import { computeListingPricing } from './pricing';
import { resolveShippingFee } from '@/lib/shipping';
import { DEFAULTS } from '@/lib/constants';

const num = (v: unknown, d: number) => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : d;
};

async function getFx(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const [r] = await db.select().from(fxRates).where(eq(fxRates.date, today)).limit(1);
  return r?.jpyToKrw ? num(r.jpyToKrw, DEFAULTS.fxJpyToKrw) : DEFAULTS.fxJpyToKrw;
}

type Loaded = {
  row: {
    channel: string;
    listPrice: number | null;
    listCurrency: string;
    marginOverride: string | null;
    weightGOverride: number | null;
    sourcePriceJpyAtList: number | null;
    lastPriceJpy: number | null;
    raw: unknown;
  };
  ts: typeof tenantSettings.$inferSelect | undefined;
  cs: typeof tenantChannelSettings.$inferSelect | undefined;
};

async function load(tenantId: string, id: string): Promise<Loaded | null> {
  return withTenant(tenantId, async (tx) => {
    const [row] = await tx
      .select({
        channel: channelListings.channel,
        listPrice: channelListings.listPrice,
        listCurrency: channelListings.listCurrency,
        marginOverride: channelListings.marginOverride,
        weightGOverride: channelListings.weightGOverride,
        sourcePriceJpyAtList: channelListings.sourcePriceJpyAtList,
        lastPriceJpy: sourceProducts.lastPriceJpy,
        raw: sourceProducts.raw,
      })
      .from(channelListings)
      .innerJoin(sourceProducts, eq(channelListings.sourceProductId, sourceProducts.id))
      .where(and(eq(channelListings.id, id), eq(channelListings.tenantId, tenantId), isNull(channelListings.deletedAt)))
      .limit(1);
    if (!row) return null;
    const [ts] = await tx.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenantId)).limit(1);
    const [cs] = await tx
      .select()
      .from(tenantChannelSettings)
      .where(and(eq(tenantChannelSettings.tenantId, tenantId), eq(tenantChannelSettings.channel, row.channel)))
      .limit(1);
    return { row, ts, cs };
  });
}

function inputsOf(l: Loaded) {
  const { row, ts, cs } = l;
  const sourcePriceJpy = row.lastPriceJpy ?? row.sourcePriceJpyAtList ?? 0;
  const weightG = row.weightGOverride != null ? row.weightGOverride : (row.raw as { weightG?: number } | null)?.weightG ?? null;
  const fxBuffer = num(ts?.fxBuffer, DEFAULTS.fxBuffer);
  const sellFeeRate = num(cs?.sellFeeRate, DEFAULTS.sellFeeRate[row.channel as keyof typeof DEFAULTS.sellFeeRate] ?? 0.11);
  const marginRate = row.marginOverride != null ? num(row.marginOverride, DEFAULTS.marginRate) : num(ts?.marginRate, DEFAULTS.marginRate);
  const domesticShippingJpy = num(ts?.domesticShippingJpy, DEFAULTS.domesticShippingJpy);
  const intlShippingJpy = resolveShippingFee(weightG, (ts?.shippingRatesJson as unknown as []) ?? []);
  const priceRounding = num(cs?.priceRounding, DEFAULTS.priceRoundingKrw);
  return { sourcePriceJpy, weightG, fxBuffer, sellFeeRate, marginRate, domesticShippingJpy, intlShippingJpy, priceRounding, listCurrency: cs?.currency ?? row.listCurrency ?? 'KRW' };
}

// 再計算して売価/赤字下限を保存（Amazon再取得・翻訳はしない）。
export async function recomputeListing(tenantId: string, id: string) {
  const l = await load(tenantId, id);
  if (!l) throw new Error('NOT_FOUND');
  const inp = inputsOf(l);
  const fxRate = await getFx();
  const { listPrice, floorPriceJpy } = computeListingPricing(inp.sourcePriceJpy, {
    marginRate: inp.marginRate,
    fxBuffer: inp.fxBuffer,
    domesticShippingJpy: inp.domesticShippingJpy,
    intlShippingJpy: inp.intlShippingJpy,
    sellFeeRate: inp.sellFeeRate,
    priceRounding: inp.priceRounding,
    fxRate,
  });
  await withTenant(tenantId, (tx) =>
    tx
      .update(channelListings)
      .set({ listPrice, floorPriceJpy, listCurrency: inp.listCurrency })
      .where(and(eq(channelListings.id, id), eq(channelListings.tenantId, tenantId))),
  );
  return { listPrice, floorPriceJpy };
}

// 損益内訳：現在の売価(保存値)・手数料・配送料・仕入を加味した利益。
export async function profitBreakdown(tenantId: string, id: string) {
  const l = await load(tenantId, id);
  if (!l) throw new Error('NOT_FOUND');
  const inp = inputsOf(l);
  const fxRate = await getFx();
  const effFx = fxRate * (1 + inp.fxBuffer);
  const salePriceKrw = l.row.listPrice ?? 0;
  const feeKrw = Math.round(salePriceKrw * inp.sellFeeRate);
  const netRevenueJpy = Math.round((salePriceKrw * (1 - inp.sellFeeRate)) / effFx); // 手数料控除後・円換算（為替バッファ込み）
  const shippingJpy = inp.domesticShippingJpy + inp.intlShippingJpy;
  const costJpy = inp.sourcePriceJpy + shippingJpy;
  const profitJpy = netRevenueJpy - costJpy;
  const marginPct = netRevenueJpy > 0 ? Math.round((profitJpy / netRevenueJpy) * 1000) / 10 : 0;
  return {
    salePriceKrw,
    listCurrency: inp.listCurrency,
    fxRate,
    effFx: Math.round(effFx * 1000) / 1000,
    sellFeeRatePct: Math.round(inp.sellFeeRate * 1000) / 10,
    feeKrw,
    netRevenueJpy,
    sourcePriceJpy: inp.sourcePriceJpy,
    domesticShippingJpy: inp.domesticShippingJpy,
    intlShippingJpy: inp.intlShippingJpy,
    weightG: inp.weightG,
    costJpy,
    profitJpy,
    marginPct,
  };
}
