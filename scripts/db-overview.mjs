// DBの一覧と内容を可視化（dev=DATABASE_URL）。機微列(password/token/_enc/secret)はマスク。
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

function loadEnv() {
  for (const l of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadEnv();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const sensitive = (c) => /password|token|_enc$|secret/i.test(c);
const mask = (k, v) => (v == null ? null : sensitive(k) ? '***' : typeof v === 'object' ? JSON.stringify(v).slice(0, 60) : String(v).length > 60 ? String(v).slice(0, 57) + '…' : v);

const host = (() => { try { return new URL(process.env.DATABASE_URL).hostname; } catch { return '?'; } })();
console.log(`接続先(dev): ${host}\n`);

const tablesQ = await pool.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name",
);
const tables = tablesQ.rows.map((r) => r.table_name);

console.log('==================== テーブル一覧（行数） ====================');
const counts = {};
for (const t of tables) {
  const c = await pool.query(`SELECT count(*)::int AS n FROM "${t}"`);
  counts[t] = c.rows[0].n;
  console.log(`  ${t.padEnd(22)} ${counts[t]} 行`);
}

console.log('\n==================== スキーマ（列：型 NULL可否 既定） ====================');
for (const t of tables) {
  const cols = await pool.query(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
    [t],
  );
  console.log(`\n[${t}]`);
  for (const c of cols.rows) {
    const def = c.column_default ? ` = ${String(c.column_default).slice(0, 30)}` : '';
    console.log(`  - ${c.column_name.padEnd(26)} ${c.data_type}${c.is_nullable === 'NO' ? ' NOT NULL' : ''}${def}`);
  }
}

console.log('\n==================== データ（非空テーブルのみ・機微列マスク） ====================');
let any = false;
for (const t of tables) {
  if (!counts[t]) continue;
  any = true;
  const rows = await pool.query(`SELECT * FROM "${t}" LIMIT 20`);
  console.log(`\n[${t}] ${counts[t]}行（先頭${rows.rows.length}件）`);
  for (const r of rows.rows) {
    const o = {};
    for (const [k, v] of Object.entries(r)) o[k] = mask(k, v);
    console.log('  ', JSON.stringify(o, null, 0));
  }
}
if (!any) console.log('  （全テーブル空）');

await pool.end();
