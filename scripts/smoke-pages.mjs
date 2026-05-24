// 新テナントページ(禁止ワード/BL/知財/アラート)のSSRスモーク（200+文言、owner→本部メッセージ）。
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
function loadEnv() { for (const l of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]; } }
loadEnv();
const BASE = 'http://localhost:3000';
const ts = Date.now();
const P = (b) => (b ? 'PASS' : 'FAIL');
const cookieOf = (r) => ((r.headers.get('set-cookie') || '').match(/compass_session=[^;]+/) || [''])[0];

const o = await fetch(BASE + '/api/auth/signin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: (process.env.OWNER_EMAIL || 'hirohohashimoto@gmail.com').toLowerCase(), password: process.env.OWNER_INITIAL_PASSWORD }), redirect: 'manual' });
const owner = cookieOf(o);
const on = await fetch(BASE + '/api/admin/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: owner }, body: JSON.stringify({ tenantName: `テストページ ${ts}`, email: `pg+${ts}@example.com` }) });
const token = ((await on.json()).inviteUrl || '').split('/invite/')[1];
const ac = await fetch(BASE + '/api/auth/accept-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: 'pw-' + ts }), redirect: 'manual' });
const T = cookieOf(ac);

const pages = [
  ['/settings/ng-words', '禁止ワード'],
  ['/settings/blacklist', '仕入ブラックリスト'],
  ['/settings/ip-brands', '知財・監視ブランド'],
  ['/alerts', '在庫・損益アラート'],
  ['/settings/source', '仕入元連携'],
  ['/settings/channels', '販売先連携'],
  ['/settings/monitoring', '監視設定'],
  ['/orders', '受注'],
];
let i = 1;
for (const [url, kw] of pages) {
  const r = await fetch(BASE + url, { headers: { cookie: T } });
  const html = await r.text();
  const ro = await fetch(BASE + url, { headers: { cookie: owner } });
  const ho = await ro.text();
  console.log(`${i++}) ${url}: テナント=${r.status}/${html.includes(kw)} owner本部=${ro.status}/${ho.includes('本部アカウント')} => ${P(r.status === 200 && html.includes(kw) && ro.status === 200 && ho.includes('本部アカウント'))}`);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await pool.query("DELETE FROM tenants WHERE name LIKE 'テストページ%'");
await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'");
await pool.end();
console.log('cleanup done');
