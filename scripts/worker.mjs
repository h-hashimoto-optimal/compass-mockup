// Compass バッチワーカー（常駐ポーラ）。/api/jobs/run を一定間隔で叩く「別プロセス」。
// 実処理はアプリ側(DB/RLS/テナント鍵を一元管理)で走らせ、ここは起動と間隔管理だけに徹する。
// ローカル: node scripts/worker.mjs
// 本番: Windowsタスクスケジューラ（毎分 curl /api/jobs/run）or 小型VPSで常駐。
// ※将来スケールするなら、この方式から tsx で lib/jobs/runner を直接呼ぶ真の単独ワーカーへ差し替え可。
import fs from 'node:fs';
import path from 'node:path';

function fromEnvLocal(key, fallback) {
  try {
    const p = path.join(process.cwd(), '.env.local');
    const line = fs
      .readFileSync(p, 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith(key + '='));
    if (!line) return fallback;
    let v = line.slice(key.length + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    return v || fallback;
  } catch {
    return fallback;
  }
}

const BASE = process.env.COMPASS_BASE || fromEnvLocal('COMPASS_BASE', 'http://localhost:3000');
const TOKEN = process.env.WORKER_TOKEN || fromEnvLocal('WORKER_TOKEN', '');
const INTERVAL = Number(process.env.WORKER_INTERVAL_MS || 15000);

if (!TOKEN) {
  console.error('✗ WORKER_TOKEN が未設定です（.env.local）。');
  process.exit(1);
}

async function tick() {
  try {
    const res = await fetch(BASE + '/api/jobs/run', {
      method: 'POST',
      headers: { 'X-Worker-Token': TOKEN },
    });
    const body = await res.json().catch(() => ({}));
    console.log(new Date().toISOString(), res.status, JSON.stringify(body));
  } catch (e) {
    console.error(new Date().toISOString(), 'tick失敗:', e.message);
  }
}

console.log(`[Compass worker] start base=${BASE} interval=${INTERVAL}ms`);
await tick();
setInterval(tick, INTERVAL);
