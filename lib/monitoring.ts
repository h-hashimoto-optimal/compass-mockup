// コアB：仕入元の最新価格・在庫を再取得し、赤字／低マージン／在庫切れを検知する監視エンジン。
//
// - simulateSourceRefresh：仕入元の再取得を決定論的にシミュレート（モック）。
//   実環境では SP-API / 楽天 / Yahoo! の実値に置換する。
// - evaluate：最新原価＋現行の販売価格(KRW)から pricing.computePricing で再計算し、
//   損益分岐割れ＝赤字 / 在庫0＝在庫切れ / 実利益率が下限未満＝低マージン を判定。
// - 設定は globalThis 在メモリ（pricing.ts と同方式・サーバ再起動でリセット）。

import { listings } from './mock-data';
import { computePricing, getMarginConfig } from './pricing';
import { formatJPY, formatKRW } from './utils';

export type SourceSnapshot = {
  listingId: string;
  costJpyBefore: number;
  costJpyNow: number;
  stockNow: number;
  fetchedAt: string;
};

// 決定論的ドリフトシナリオ（モック）。実環境では仕入元APIの実値で置換。
// costFactor: 原価倍率 / stock: 再取得した仕入元在庫
const DRIFT: Record<string, { costFactor: number; stock: number }> = {
  'L-0001': { costFactor: 1.3, stock: 30 }, // 原価高騰 → 赤字化（ナイキ）
  'L-0003': { costFactor: 1.38, stock: 12 }, // 原価高騰 → 赤字化（ホットクック）
  'L-0005': { costFactor: 1.1, stock: 5 }, // 原価上昇 → 低マージン（Sony・元18%）
  'L-0006': { costFactor: 1.0, stock: 0 }, // 在庫切れ（無印）
  'L-0008': { costFactor: 1.0, stock: 0 }, // 在庫切れ（カルディ）
};

export function simulateSourceRefresh(
  at: string = new Date().toISOString(),
): SourceSnapshot[] {
  return listings.map((l) => {
    const d = DRIFT[l.id] ?? { costFactor: 1.0, stock: 50 };
    return {
      listingId: l.id,
      costJpyBefore: l.priceJpy,
      costJpyNow: Math.round(l.priceJpy * d.costFactor),
      stockNow: d.stock,
      fetchedAt: at,
    };
  });
}

export type AlertKind = 'oos' | 'loss' | 'low_margin';
export type AlertSeverity = 'critical' | 'warning';

export type DetectedAlert = {
  listingId: string;
  title: string;
  kind: AlertKind;
  severity: AlertSeverity;
  detail: string;
  costJpyBefore: number;
  costJpyNow: number;
  salePriceKrw: number;
  breakEvenKrw: number;
  realMarginRate: number;
};

export type MonitorConfig = {
  minMarginRate: number; // この実利益率(%)を下回ったら low_margin 警告
  floorGuardEnabled: boolean; // 損益分岐割れ(赤字)を critical 検知するか
  channels: { line: boolean; chatwork: boolean; email: boolean };
};

export const DEFAULT_MONITOR: MonitorConfig = {
  minMarginRate: 10,
  floorGuardEnabled: true,
  channels: { line: true, chatwork: true, email: false },
};

const STORE_KEY = '__compass_monitor_cfg__';
type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: MonitorConfig };

export function getMonitorConfig(): MonitorConfig {
  const g = globalThis as GlobalWithStore;
  if (!g[STORE_KEY])
    g[STORE_KEY] = {
      ...DEFAULT_MONITOR,
      channels: { ...DEFAULT_MONITOR.channels },
    };
  return g[STORE_KEY]!;
}

export function setMonitorConfig(patch: Partial<MonitorConfig>): MonitorConfig {
  const g = globalThis as GlobalWithStore;
  const cur = getMonitorConfig();
  const next: MonitorConfig = {
    ...cur,
    ...patch,
    channels: { ...cur.channels, ...(patch.channels ?? {}) },
  };
  g[STORE_KEY] = next;
  return next;
}

// 最新原価＋現行の販売価格(KRW)から実利益率を算出。
// listings 画面の rowProfit と同一ロジック（原価+送料+関税+VAT を控除）。
function realMargin(
  costJpyNow: number,
  salePriceKrw: number,
  category: string,
) {
  const p = computePricing(costJpyNow, getMarginConfig(), category);
  const baseCostJpy = p.jpyTotal - p.profit;
  const revenueJpy = p.fxRate > 0 ? salePriceKrw / p.fxRate : 0;
  const profitJpy = Math.round(revenueJpy - baseCostJpy);
  const rate = costJpyNow > 0 ? (profitJpy / costJpyNow) * 100 : 0;
  return { breakEvenKrw: p.breakEvenKrw, rate };
}

export function evaluate(
  snapshots: SourceSnapshot[],
  monitorCfg: MonitorConfig = getMonitorConfig(),
): DetectedAlert[] {
  const byId = new Map(listings.map((l) => [l.id, l] as const));
  const out: DetectedAlert[] = [];

  for (const s of snapshots) {
    const l = byId.get(s.listingId);
    if (!l) continue;

    const { breakEvenKrw, rate } = realMargin(
      s.costJpyNow,
      l.priceKrw,
      l.category,
    );
    const base = {
      listingId: l.id,
      title: l.titleJa,
      costJpyBefore: s.costJpyBefore,
      costJpyNow: s.costJpyNow,
      salePriceKrw: l.priceKrw,
      breakEvenKrw,
      realMarginRate: Math.round(rate * 10) / 10,
    };

    if (s.stockNow <= 0) {
      out.push({
        ...base,
        kind: 'oos',
        severity: 'critical',
        detail: '仕入元在庫が0。販売継続不可（出品停止を推奨）',
      });
      continue; // 在庫切れが最優先。同一商品で重複アラートしない
    }

    if (monitorCfg.floorGuardEnabled && l.priceKrw < breakEvenKrw) {
      out.push({
        ...base,
        kind: 'loss',
        severity: 'critical',
        detail: `原価 ${formatJPY(s.costJpyBefore)}→${formatJPY(
          s.costJpyNow,
        )} で損益分岐 ${formatKRW(breakEvenKrw)} を割れ（赤字）`,
      });
      continue;
    }

    if (rate < monitorCfg.minMarginRate) {
      out.push({
        ...base,
        kind: 'low_margin',
        severity: 'warning',
        detail: `実利益率 ${base.realMarginRate}% が下限 ${monitorCfg.minMarginRate}% 未満`,
      });
    }
  }

  return out;
}

export const alertKindLabel: Record<AlertKind, string> = {
  oos: '在庫切れ',
  loss: '赤字',
  low_margin: '低マージン',
};

export const alertKindVariant: Record<
  AlertKind,
  'destructive' | 'warning' | 'info'
> = {
  oos: 'destructive',
  loss: 'destructive',
  low_margin: 'warning',
};
