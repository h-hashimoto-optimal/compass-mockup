// 重量別の国際配送料（日本→韓国）。既定はHANIRO LINE Economyの実重量料金（容積重量なし）。
// テナントが tenant_settings.shipping_rates_json で上書き可能。
export type ShippingTier = { maxG: number; feeJpy: number };

// 出典: https://haniro.jp/ （Economy・入出庫手数料込み、関税等は別）
export const DEFAULT_SHIPPING_TIERS: ShippingTier[] = [
  { maxG: 500, feeJpy: 900 },
  { maxG: 1000, feeJpy: 1000 },
  { maxG: 5000, feeJpy: 1800 },
  { maxG: 10000, feeJpy: 2800 },
  { maxG: 20000, feeJpy: 4800 },
  { maxG: 30000, feeJpy: 6800 },
];

export function normalizeTiers(raw: unknown): ShippingTier[] {
  if (!Array.isArray(raw)) return DEFAULT_SHIPPING_TIERS;
  const tiers = raw
    .map((t) => ({ maxG: Number((t as ShippingTier)?.maxG), feeJpy: Number((t as ShippingTier)?.feeJpy) }))
    .filter((t) => Number.isFinite(t.maxG) && t.maxG > 0 && Number.isFinite(t.feeJpy) && t.feeJpy >= 0)
    .sort((a, b) => a.maxG - b.maxG);
  return tiers.length ? tiers : DEFAULT_SHIPPING_TIERS;
}

// 重量(g)→配送料(円)。該当帯（weight<=maxG の最小帯）。超過は最上位帯の料金。
export function shippingFeeForWeight(weightG: number | null | undefined, tiers: ShippingTier[]): number {
  if (!weightG || weightG <= 0) return 0;
  const sorted = normalizeTiers(tiers);
  for (const t of sorted) if (weightG <= t.maxG) return t.feeJpy;
  return sorted[sorted.length - 1]?.feeJpy ?? 0;
}
