// 価格計算の単一ソース（Compass コアA：利益率管理の中核）。
//
// - pure `computePricing`：原価＋利益率設定 → 販売価格の内訳。サーバ/クライアント両用。
// - `getMarginConfig/setMarginConfig`：モック用の在メモリ設定ストア（サーバ再起動でリセット）。
//   DBは未導入のため process メモリで保持。将来 Supabase の tenant_settings に置換。
// - `calcPrice`：サーバ側で現行設定を読んで計算する薄いラッパ（pipeline から使用）。

import { marginSettings, fxRate } from './mock-data';

export type Rounding =
  | 'ceil'
  | 'floor'
  | 'round_up_100_krw'
  | 'round_up_1000_krw';

export type CategoryOverride = { category: string; rate: number };

export type MarginConfig = {
  defaultRate: number; // 既定利益率(%)
  fxBase: number; // 基準レート JPY→KRW（1円あたりKRW）
  fxBuffer: number; // 為替安全マージン(%)
  fxSource: string;
  rounding: Rounding;
  intlShipping: number; // 国際送料(JPY) 固定
  dutyRate: number; // 関税率
  vatRate: number; // VAT率
  categoryOverrides: CategoryOverride[];
};

export const DEFAULT_MARGIN: MarginConfig = {
  defaultRate: marginSettings.defaultRate,
  fxBase: fxRate.rate,
  fxBuffer: marginSettings.fxBuffer,
  fxSource: marginSettings.fxSource,
  rounding: marginSettings.rounding,
  intlShipping: 200,
  dutyRate: 0.05,
  vatRate: 0.1,
  categoryOverrides: marginSettings.categoryOverrides.map((c) => ({
    category: c.category,
    rate: c.rate,
  })),
};

export type PricingBreakdown = {
  costJpy: number;
  intlShipping: number;
  duty: number;
  vat: number;
  marginRate: number; // 適用された利益率(%)
  marginSource: 'category' | 'default';
  profit: number; // 利益(JPY)
  jpyTotal: number;
  fxRate: number; // バッファ込み実効レート
  krwRaw: number;
  krwFinal: number; // 丸め後の販売価格(KRW)
  breakEvenKrw: number; // 損益分岐の販売価格(KRW・利益0)
};

function applyRounding(x: number, r: Rounding): number {
  switch (r) {
    case 'ceil':
      return Math.ceil(x);
    case 'floor':
      return Math.floor(x);
    case 'round_up_100_krw':
      return Math.ceil(x / 100) * 100;
    case 'round_up_1000_krw':
      return Math.ceil(x / 1000) * 1000;
  }
}

function resolveMargin(
  cfg: MarginConfig,
  category?: string,
): { rate: number; source: 'category' | 'default' } {
  if (category) {
    const hit = cfg.categoryOverrides.find(
      (c) => c.category === category || category.startsWith(c.category),
    );
    if (hit) return { rate: hit.rate, source: 'category' };
  }
  return { rate: cfg.defaultRate, source: 'default' };
}

/** 原価(JPY)＋設定 → 販売価格内訳。副作用なし。 */
export function computePricing(
  costJpy: number,
  cfg: MarginConfig = DEFAULT_MARGIN,
  category?: string,
): PricingBreakdown {
  const cost = Math.max(0, Math.round(costJpy));
  const { rate: marginRate, source: marginSource } = resolveMargin(
    cfg,
    category,
  );
  const duty = Math.round(cost * cfg.dutyRate);
  const vat = Math.round((cost + duty) * cfg.vatRate);
  const profit = Math.round(cost * (marginRate / 100));
  const baseCostJpy = cost + cfg.intlShipping + duty + vat;
  const jpyTotal = baseCostJpy + profit;
  const effFx = cfg.fxBase * (1 + cfg.fxBuffer / 100);
  const krwRaw = Math.round(jpyTotal * effFx);
  const krwFinal = applyRounding(krwRaw, cfg.rounding);
  const breakEvenKrw = applyRounding(
    Math.round(baseCostJpy * effFx),
    cfg.rounding,
  );
  return {
    costJpy: cost,
    intlShipping: cfg.intlShipping,
    duty,
    vat,
    marginRate,
    marginSource,
    profit,
    jpyTotal,
    fxRate: Math.round(effFx * 100) / 100,
    krwRaw,
    krwFinal,
    breakEvenKrw,
  };
}

/** 既存の販売価格が損益分岐を割っていれば赤字。 */
export function isLoss(
  costJpy: number,
  salePriceKrw: number,
  cfg: MarginConfig = DEFAULT_MARGIN,
  category?: string,
): boolean {
  return salePriceKrw < computePricing(costJpy, cfg, category).breakEvenKrw;
}

// ── モック在メモリ設定ストア（サーバプロセス単位・再起動でリセット）──────────
// globalThis に載せて Next.js dev のホットリロードでも保持。
const STORE_KEY = '__compass_margin_cfg__';
type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: MarginConfig };

export function getMarginConfig(): MarginConfig {
  const g = globalThis as GlobalWithStore;
  if (!g[STORE_KEY]) g[STORE_KEY] = { ...DEFAULT_MARGIN };
  return g[STORE_KEY]!;
}

export function setMarginConfig(patch: Partial<MarginConfig>): MarginConfig {
  const g = globalThis as GlobalWithStore;
  const next = { ...getMarginConfig(), ...patch };
  g[STORE_KEY] = next;
  return next;
}

/** サーバ側：現行設定で計算（pipeline から使用）。 */
export function calcPrice(
  costJpy: number,
  category?: string,
): PricingBreakdown {
  return computePricing(costJpy, getMarginConfig(), category);
}
