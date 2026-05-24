// 最小権限のアプリ実行ロール compass_app を作成/更新し、APP_DATABASE_URL を .env.local に書く。
// owner(DATABASE_URL)で実行。owner はRLSをbypassするので migration/seed/テストは従来通り。
// アプリは APP_DATABASE_URL(=非owner) で接続し RLS の対象になる（多層防御）。値(パスワード)は表示しない。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Pool } from 'pg';

function loadEnv() { for (const l of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]; } }
loadEnv();

const ROLE = 'compass_app';
const pw = crypto.randomBytes(24).toString('hex'); // URL安全(hex)
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const exists = (await pool.query('select 1 from pg_roles where rolname=$1', [ROLE])).rowCount > 0;
if (exists) {
  await pool.query(`ALTER ROLE ${ROLE} WITH LOGIN PASSWORD '${pw}'`);
} else {
  await pool.query(`CREATE ROLE ${ROLE} WITH LOGIN PASSWORD '${pw}'`);
}
// 最小権限：DML一式＋スキーマ/シーケンス。owner作成の将来テーブルにも自動付与。
await pool.query(`GRANT USAGE ON SCHEMA public TO ${ROLE}`);
await pool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${ROLE}`);
await pool.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ROLE}`);
await pool.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${ROLE}`);
await pool.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${ROLE}`);
await pool.end();

// APP_DATABASE_URL を組み立て（DATABASE_URLのhost/db/paramsを流用、user/passだけ差し替え）
const u = new URL(process.env.DATABASE_URL);
u.username = ROLE;
u.password = pw;
const appUrl = u.toString();

const p = path.join(process.cwd(), '.env.local');
let s = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
if (/^APP_DATABASE_URL=.*$/m.test(s)) {
  s = s.replace(/^APP_DATABASE_URL=.*$/m, 'APP_DATABASE_URL=' + appUrl);
} else {
  if (s && !s.endsWith('\n')) s += '\n';
  s += 'APP_DATABASE_URL=' + appUrl + '\n';
}
fs.writeFileSync(p, s);
console.log(`✓ ロール ${ROLE} を作成/更新し、APP_DATABASE_URL を .env.local に設定しました（値は非表示）`);
console.log('  → devサーバーを再起動すると、アプリがこのロールで接続しRLSの対象になります。');
