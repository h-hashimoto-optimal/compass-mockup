// /listings 画面がテナントログインで描画されるかのスモーク（HTTP+HTML確認）。
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
function loadEnv() { for (const l of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]; } }
loadEnv();
const BASE = 'http://localhost:3000';
const ts = Date.now();
const cookieOf = (r) => ((r.headers.get('set-cookie') || '').match(/compass_session=[^;]+/) || [''])[0];
const P = (b) => (b ? 'PASS' : 'FAIL');

const o = await fetch(BASE + '/api/auth/signin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: (process.env.OWNER_EMAIL || 'hirohohashimoto@gmail.com').toLowerCase(), password: process.env.OWNER_INITIAL_PASSWORD }), redirect: 'manual' });
const owner = cookieOf(o);
const on = await fetch(BASE + '/api/admin/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: owner }, body: JSON.stringify({ tenantName: `テストUI ${ts}`, email: `ui+${ts}@example.com` }) });
const token = ((await on.json()).inviteUrl || '').split('/invite/')[1];
const ac = await fetch(BASE + '/api/auth/accept-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: 'pw-' + ts }), redirect: 'manual' });
const T = cookieOf(ac);

// 未ログインで /listings → /login
const noAuth = await fetch(BASE + '/listings', { redirect: 'manual' });
console.log(`1) 未ログイン/listings→login: ${noAuth.status} ${P(noAuth.status >= 300 && noAuth.status < 400)}`);

// テナントで /listings → 200 + 画面文言
const r = await fetch(BASE + '/listings', { headers: { cookie: T } });
const html = await r.text();
console.log(`2) テナントで/listings描画: ${r.status} 文言=${html.includes('商品管理')} ${P(r.status === 200 && html.includes('商品管理'))}`);

// owner で /listings → 本部メッセージ
const ro = await fetch(BASE + '/listings', { headers: { cookie: owner } });
const ho = await ro.text();
console.log(`3) ownerで/listings→本部メッセージ: ${ro.status} ${P(ro.status === 200 && ho.includes('本部アカウント'))}`);

// cleanup
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await pool.query("DELETE FROM tenants WHERE name LIKE 'テストUI%'");
await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'");
await pool.end();
console.log('cleanup done');
