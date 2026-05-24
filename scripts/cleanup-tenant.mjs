// 加盟店01 を dev / prod 両ブランチから削除（テスト用テナント）。host/件数のみ表示、秘密は出さない。
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

function loadEnv() {
  for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadEnv();

// 既定は dev のみ。prod も消す場合は `node scripts/cleanup-tenant.mjs --prod`（要明示）。
const includeProd = process.argv.includes('--prod');
const targets = [
  { label: 'dev (DATABASE_URL)', url: process.env.DATABASE_URL },
  ...(includeProd ? [{ label: 'prod', url: process.env.PRODUCTION_DATABASE_URL || process.env.PRODUTION_DATABASE_URL }] : []),
];

const seen = new Set();
for (const t of targets) {
  if (!t.url) { console.log(`-- ${t.label}: 未設定（スキップ）`); continue; }
  let host = '?';
  try { host = new URL(t.url).hostname; } catch {}
  if (seen.has(host)) { console.log(`-- ${t.label}: 同一ホスト(${host})なのでスキップ`); continue; }
  seen.add(host);

  const pool = new Pool({ connectionString: t.url, ssl: { rejectUnauthorized: false } });
  try {
    console.log(`\n== ${t.label}  host=${host} ==`);
    const before = await pool.query('SELECT name, status FROM tenants ORDER BY created_at');
    console.log('  [before] tenants:', before.rows.map((r) => r.name).join(', ') || '(なし)');
    const del = await pool.query("DELETE FROM tenants WHERE name = '加盟店01' RETURNING name");
    console.log('  削除:', del.rows.map((r) => r.name).join(', ') || '(該当なし)');
    const tAfter = await pool.query('SELECT name FROM tenants ORDER BY created_at');
    const uAfter = await pool.query('SELECT email, role FROM users ORDER BY created_at');
    console.log('  [after] tenants:', tAfter.rows.map((r) => r.name).join(', ') || '(なし)');
    console.log('  [after] users:', uAfter.rows.map((r) => `${r.email}(${r.role})`).join(', ') || '(なし)');
  } catch (e) {
    console.log(`  ✗ エラー: ${e.message}`);
  } finally {
    await pool.end().catch(() => {});
  }
}
