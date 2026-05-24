// 拡張トークン取込のテナント分離をE2E検証。
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
async function tenant(name, email) {
  const on = await fetch(BASE + '/api/admin/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: owner }, body: JSON.stringify({ tenantName: name, email }) });
  const token = ((await on.json()).inviteUrl || '').split('/invite/')[1];
  const ac = await fetch(BASE + '/api/auth/accept-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: 'pw-' + ts }), redirect: 'manual' });
  const cookie = cookieOf(ac);
  const tk = await fetch(BASE + '/api/tenant/token', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({}) });
  return { cookie, ingestToken: (await tk.json()).token };
}
const A = await tenant(`テスト取込A ${ts}`, `ia+${ts}@example.com`);
const B = await tenant(`テスト取込B ${ts}`, `ib+${ts}@example.com`);

const asin = 'B0' + ts.toString().slice(-8);
// Aのトークンで取込
const ing = await fetch(BASE + '/api/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Compass-Token': A.ingestToken }, body: JSON.stringify({ asin, title: '拡張取込テスト', price: 1500 }) });
const ingJson = await ing.json();
console.log(`1) Aトークンで取込: ${ing.status} status=${ingJson.status} => ${P(ing.status === 201)}`);

// AのリストにdraftがあるかB(別)には無いか
const la = await (await fetch(BASE + '/api/listings', { headers: { cookie: A.cookie } })).json();
const lb = await (await fetch(BASE + '/api/listings', { headers: { cookie: B.cookie } })).json();
console.log(`2) A受信トレイに入る/Bには入らない: A=${la.listings?.length} B=${lb.listings?.length} => ${P(la.listings?.length === 1 && lb.listings?.length === 0)}`);

// 不正トークン
const bad = await fetch(BASE + '/api/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Compass-Token': 'invalid' }, body: JSON.stringify({ asin: 'B0XXXXXXXX' }) });
console.log(`3) 不正トークン拒否: ${bad.status} => ${P(bad.status === 401)}`);

// Bのトークンで取込→Bに入る（A混入なし）
const asin2 = 'B1' + ts.toString().slice(-8);
await fetch(BASE + '/api/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Compass-Token': B.ingestToken }, body: JSON.stringify({ asin: asin2 }) });
const la2 = await (await fetch(BASE + '/api/listings', { headers: { cookie: A.cookie } })).json();
const lb2 = await (await fetch(BASE + '/api/listings', { headers: { cookie: B.cookie } })).json();
console.log(`4) Bトークン取込→Bのみ反映: A=${la2.listings?.length} B=${lb2.listings?.length} => ${P(la2.listings?.length === 1 && lb2.listings?.length === 1)}`);

// 旧グローバル/api/asins は廃止(410)
const old = await fetch(BASE + '/api/asins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ asin: 'B0DEADBEEF' }] }) });
console.log(`5) 旧/api/asins 廃止: ${old.status} => ${P(old.status === 410)}`);

// cleanup
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await pool.query("DELETE FROM tenants WHERE name LIKE 'テスト取込%'");
await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'");
await pool.query('DELETE FROM source_products WHERE source_product_id = ANY($1)', [[asin, asin2]]);
await pool.end();
console.log('cleanup done');
