// 価格計算（仕入JPY → 販売チャネル通貨）と赤字下限の算出。整数で返す。
// 入力の率はすべて number（呼び出し側で numeric 列を parseFloat 済み）。

export type PricingInput = {
  marginRate: number; // 目標利益率
  fxBuffer: number; // 為替バッファ
  domesticShippingJpy: number; // 国内送料（円）
  sellFeeRate: number; // チャネル販売手数料率
  priceRounding: number; // 売価の丸め単位（チャネル通貨）
  fxRate: number; // JPY→チャネル通貨レート
};

export type PricingResult = {
  listPrice: number; // 販売価格（整数・チャネル通貨）
  floorPriceJpy: number; // この仕入値を超えたら赤字（整数・円）
};

export function computeListingPricing(sourcePriceJpy: number, p: PricingInput): PricingResult {
  const round = p.priceRounding > 0 ? p.priceRounding : 1;
  const effFx = p.fxRate * (1 + p.fxBuffer); // バッファ込みレート
  const costJpy = sourcePriceJpy + p.domesticShippingJpy;

  // 販売手数料＋利益を載せた売価。分母が0以下なら安全側に倍率で逃がす。
  const denom = 1 - p.sellFeeRate - p.marginRate;
  const raw = denom > 0 ? (costJpy * effFx) / denom : costJpy * effFx * 2;
  const listPrice = Math.ceil(raw / round) * round;

  // 固定した売価に対し、手数料控除後の手取りで賄える仕入上限（円）＝赤字下限
  const maxCostJpy = (listPrice * (1 - p.sellFeeRate)) / effFx;
  const floorPriceJpy = Math.floor(maxCostJpy - p.domesticShippingJpy);

  return { listPrice, floorPriceJpy };
}
