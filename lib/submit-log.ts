// コアA 6.3：Coupang送信ログ（req/res）の在メモリ保存。
// pricing.ts と同じ globalThis 方式・再起動でリセット。実環境では Supabase の submit_logs へ。

export type SubmitLogEntry = {
  id: string;
  at: string;
  asin: string;
  mode: 'dry-run' | 'live';
  ok: boolean;
  status: number | null;
  titleKo: string;
  priceKrw: number;
  reason: string | null;
};

const KEY = '__compass_submit_log__';
type GlobalWithStore = typeof globalThis & { [KEY]?: SubmitLogEntry[] };

function log(): SubmitLogEntry[] {
  const g = globalThis as GlobalWithStore;
  if (!g[KEY]) g[KEY] = [];
  return g[KEY]!;
}

export function getSubmitLog(): SubmitLogEntry[] {
  return log();
}

export function appendSubmitLog(
  e: Omit<SubmitLogEntry, 'id' | 'at'>,
): SubmitLogEntry {
  const at = new Date().toISOString();
  const entry: SubmitLogEntry = {
    ...e,
    id: `SL-${Date.now()}`,
    at,
  };
  log().unshift(entry);
  // 直近200件まで保持
  if (log().length > 200) log().length = 200;
  return entry;
}

export function clearSubmitLog(): void {
  const g = globalThis as GlobalWithStore;
  g[KEY] = [];
}
