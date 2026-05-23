// 受信トレイから「除外」操作で動的に追加されたASIN BLを保持する在メモリストア。
// mock-data の asinBlacklist がシード相当（静的）、こちらが動的追加分。
// 取り込みチェックや /settings/blacklist 表示時に両者をマージして使う。

import type { BlacklistEntry } from './mock-data';

const KEY = '__compass_blacklist_dynamic__';
type GlobalWithStore = typeof globalThis & { [KEY]?: BlacklistEntry[] };

function store(): BlacklistEntry[] {
  const g = globalThis as GlobalWithStore;
  if (!g[KEY]) g[KEY] = [];
  return g[KEY]!;
}

export function getAllDynamic(): BlacklistEntry[] {
  return [...store()];
}

export function addDynamic(entries: BlacklistEntry[]): { added: number; total: number } {
  const existing = store();
  const seen = new Set(existing.map((e) => e.code));
  const toAdd = entries.filter((e) => !seen.has(e.code));
  existing.unshift(...toAdd);
  return { added: toAdd.length, total: existing.length };
}

export function removeDynamicByCode(code: string): boolean {
  const cur = store();
  const idx = cur.findIndex((e) => e.code === code);
  if (idx === -1) return false;
  cur.splice(idx, 1);
  return true;
}

export function removeDynamicByCodes(codes: string[]): number {
  const set = new Set(codes);
  const cur = store();
  let removed = 0;
  for (let i = cur.length - 1; i >= 0; i--) {
    if (set.has(cur[i].code)) {
      cur.splice(i, 1);
      removed++;
    }
  }
  return removed;
}

export function clearAllDynamic(): void {
  const g = globalThis as GlobalWithStore;
  g[KEY] = [];
}
