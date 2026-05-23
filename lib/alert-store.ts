// コアB：検知アラートの在メモリストア（pricing.ts と同じ globalThis 方式・再起動でリセット）。
// 実環境では Supabase の alerts テーブルへ置換。

import type { DetectedAlert } from './monitoring';

export type StoredAlert = DetectedAlert & {
  id: string;
  createdAt: string;
  notified: boolean;
};

const KEY = '__compass_alerts__';
type GlobalWithStore = typeof globalThis & {
  [KEY]?: { alerts: StoredAlert[]; lastSyncAt: string | null };
};

function box() {
  const g = globalThis as GlobalWithStore;
  if (!g[KEY]) g[KEY] = { alerts: [], lastSyncAt: null };
  return g[KEY]!;
}

export function getAlerts(): StoredAlert[] {
  return box().alerts;
}

export function getLastSyncAt(): string | null {
  return box().lastSyncAt;
}

// 同期1回ぶんの検知結果でアラートを置き換える（スナップショット型運用）。
export function replaceAlerts(
  detected: DetectedAlert[],
  at: string,
): StoredAlert[] {
  const b = box();
  const ymd = at.slice(0, 10).replace(/-/g, '');
  b.alerts = detected.map((d, i) => ({
    ...d,
    id: `AL-${ymd}-${String(i + 1).padStart(3, '0')}`,
    createdAt: at,
    notified: false,
  }));
  b.lastSyncAt = at;
  return b.alerts;
}

export function markNotified(ids: string[]): void {
  const set = new Set(ids);
  for (const a of box().alerts) if (set.has(a.id)) a.notified = true;
}
