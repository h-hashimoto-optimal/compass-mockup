// Chrome拡張から受信したASINを保持する簡易ストア。
// モック用。tmp/captured-asins.json に追記/読出。本番ではDB(Supabase)へ。

import fs from 'node:fs';
import path from 'node:path';

export type CapturedAsin = {
  asin: string;
  title: string;
  brand?: string;
  priceJpy: number | null;
  imageUrl: string;
  url: string;
  source: string;
  query: string;
  capturedAt: string;
  receivedAt: string;
};

const FILE = path.join(process.cwd(), 'tmp', 'captured-asins.json');

function ensureFile() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, '[]', 'utf8');
}

export function readAll(): CapturedAsin[] {
  ensureFile();
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    const json = JSON.parse(raw);
    return Array.isArray(json) ? json : [];
  } catch {
    return [];
  }
}

export function appendUnique(items: CapturedAsin[]): {
  added: number;
  total: number;
} {
  const existing = readAll();
  const seen = new Set(existing.map((e) => e.asin));
  const toAdd = items.filter((i) => !seen.has(i.asin));
  const next = [...toAdd, ...existing].slice(0, 500); // 直近500件まで
  ensureFile();
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2), 'utf8');
  return { added: toAdd.length, total: next.length };
}

export function clearAll(): void {
  ensureFile();
  fs.writeFileSync(FILE, '[]', 'utf8');
}

export function removeMany(asins: string[]): {
  removed: CapturedAsin[];
  total: number;
} {
  const set = new Set(asins);
  const cur = readAll();
  const removed = cur.filter((c) => set.has(c.asin));
  const next = cur.filter((c) => !set.has(c.asin));
  ensureFile();
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2), 'utf8');
  return { removed, total: next.length };
}

export function removeOne(asin: string): CapturedAsin | null {
  const result = removeMany([asin]);
  return result.removed[0] ?? null;
}
