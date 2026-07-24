// mock時のデモ用エラートリガーをE2E検証：ASINに特定語を含めると原因別のSP_API_*エラーが返る。
// （画面側の amazonFetchErrorMessage は、これらのコードを原因別メッセージに変換する）
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

const o = await fetch(BASE + '/api/auth/signin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: (process.env.OWNER_EMAIL || 'hirohohashimoto@gmail.com').toLowerCase(), password: process.env.OWNER_INITIAL_PASSWORD }), redirect: 'manual' });
const owner = cookieOf(o);
const on = await fetch(BASE + '/api/admin/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: owner }, body: JSON.stringify({ tenantName: `SPERR ${ts}`, email: `se+${ts}@example.com` }) });
const tk = ((await on.json()).inviteUrl || '').split('/invite/')[1];
const ac = await fetch(BASE + '/api/auth/accept-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tk, password: 'pw-' + ts }), redirect: 'manual' });
const A = cookieOf(ac);

const asins = [];
async function run(asin) {
  asins.push(asin);
  const lid = (await J(await fetch(BASE + '/api/listings', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: A }, body: JSON.stringify({ source: 'amazon', channel: 'coupang', sourceProductId: asin }) }))).listing.id;
  const r = await fetch(BASE + '/api/listings/' + lid + '/process', { method: 'POST', headers: { cookie: A } });
  const j = await r.json().catch(() => ({}));
  return { http: r.status, err: j.error || '', status: j.listing?.status };
}

const t1 = await run('B0NOTFOUND' + (ts % 100));
console.log(`1) NOTFOUND→404カタログ失敗: http=${t1.http} err=${t1.err} => ${P(t1.http === 500 && /SP_API_CATALOG/.test(t1.err) && /404/.test(t1.err))}`);

const t2 = await run('B0AUTHFAIL' + (ts % 100));
console.log(`2) AUTHFAIL→認証失敗: http=${t2.http} err=${t2.err} => ${P(t2.http === 500 && /SP_API_AUTH/.test(t2.err))}`);

const t3 = await run('B0RATELIMIT' + (ts % 100));
console.log(`3) RATELIMIT→429: http=${t3.http} err=${t3.err} => ${P(t3.http === 500 && /429/.test(t3.err))}`);

const t4 = await run('B0FAIL' + (ts % 100));
console.log(`4) FAIL→汎用取得失敗: http=${t4.http} err=${t4.err} => ${P(t4.http === 500 && /SP_API_FETCH_FAILED/.test(t4.err))}`);

const t5 = await run('B0' + ts.toString().slice(-8));
console.log(`5) 通常ASIN→成功(ready): http=${t5.http} status=${t5.status} => ${P(t5.http === 200 && t5.status === 'ready')}`);

// cleanup
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await pool.query("DELETE FROM tenants WHERE name LIKE 'SPERR %'");
await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'");
for (const a of asins) await pool.query('DELETE FROM source_products WHERE source_product_id = $1', [a]);
await pool.end();
console.log('cleanup done');
