// ステータス整合ガード：審査中/販売中は再処理・再送不可、却下は再処理・再送可、をE2E検証（サーバ側）。
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
function loadEnv() { for (const l of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]; } }
loadEnv();
const BASE = 'http://localhost:3000';
const ts = Date.now();
const P = (b) => (b ? 'PASS' : 'FAIL');
const J = (r) => r.json();
const cookieOf = (r) => ((r.headers.get('set-cookie') || '').match(/compass_session=[^;]+/) || [''])[0];
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const o = await fetch(BASE + '/api/auth/signin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: (process.env.OWNER_EMAIL || 'hirohohashimoto@gmail.com').toLowerCase(), password: process.env.OWNER_INITIAL_PASSWORD }), redirect: 'manual' });
const owner = cookieOf(o);
const on = await fetch(BASE + '/api/admin/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: owner }, body: JSON.stringify({ tenantName: `ガード ${ts}`, email: `g+${ts}@example.com` }) });
const tk = ((await on.json()).inviteUrl || '').split('/invite/')[1];
const ac = await fetch(BASE + '/api/auth/accept-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tk, password: 'pw-' + ts }), redirect: 'manual' });
const A = cookieOf(ac);
const post = (url) => fetch(BASE + url, { method: 'POST', headers: { cookie: A } });
const mk = async (asin, set) => {
  const lid = (await J(await fetch(BASE + '/api/listings', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: A }, body: JSON.stringify({ source: 'amazon', channel: 'coupang', sourceProductId: asin }) }))).listing.id;
  await post('/api/listings/' + lid + '/process');
  if (set) await pool.query(`UPDATE channel_listings SET ${set} WHERE id=$1`, [lid]);
  return lid;
};

// 審査中（submitted/requested）
const a1 = 'B0' + ts.toString().slice(-8);
const lidReview = await mk(a1, "status='submitted', coupang_approval_status='requested', channel_product_id='SP'||" + "'" + ts + "'");
const p1 = await post('/api/listings/' + lidReview + '/process');
const s1 = await J(await post('/api/listings/' + lidReview + '/submit'));
console.log(`1) 審査中は再処理409: ${p1.status} => ${P(p1.status === 409)}`);
console.log(`2) 審査中は再送不可(already_submitted): mode=${s1.mode} => ${P(s1.mode === 'already_submitted')}`);

// 販売中（submitted/approved/on_sale）
const a2 = 'B1' + ts.toString().slice(-8);
const lidSell = await mk(a2, "status='submitted', coupang_approval_status='approved', coupang_sales_status='on_sale'");
const p2 = await post('/api/listings/' + lidSell + '/process');
const s2 = await J(await post('/api/listings/' + lidSell + '/submit'));
console.log(`3) 販売中は再処理409: ${p2.status} => ${P(p2.status === 409)}`);
console.log(`4) 販売中は再送不可: mode=${s2.mode} => ${P(s2.mode === 'already_submitted')}`);

// 却下（submitted/rejected）→ 再処理OK・再送OK
const a3 = 'B2' + ts.toString().slice(-8);
const lidRej = await mk(a3, "status='submitted', coupang_approval_status='rejected'");
const p3 = await post('/api/listings/' + lidRej + '/process');
console.log(`5) 却下は再処理OK(200): ${p3.status} => ${P(p3.status === 200)}`);
// 再処理でstatus=readyに戻る → 送信可
const s3 = await J(await post('/api/listings/' + lidRej + '/submit'));
console.log(`6) 却下→再処理後は送信可(mock/dry-run): mode=${s3.mode} => ${P(s3.mode === 'mock' || s3.mode === 'dry-run')}`);

// cleanup
await pool.query("DELETE FROM tenants WHERE name LIKE 'ガード%'");
await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'");
await pool.query('DELETE FROM source_products WHERE source_product_id = ANY($1)', [[a1, a2, a3]]);
await pool.end();
console.log('cleanup done');
