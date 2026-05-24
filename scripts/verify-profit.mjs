// 損益内訳・価格再計算・重量不明時1000円 をE2E検証。
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
const on = await fetch(BASE + '/api/admin/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: owner }, body: JSON.stringify({ tenantName: `損益 ${ts}`, email: `pf+${ts}@example.com` }) });
const tk = ((await on.json()).inviteUrl || '').split('/invite/')[1];
const ac = await fetch(BASE + '/api/auth/accept-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tk, password: 'pw-' + ts }), redirect: 'manual' });
const A = cookieOf(ac);
const post = (url) => fetch(BASE + url, { method: 'POST', headers: { cookie: A } });
const patch = (url, body) => fetch(BASE + url, { method: 'PATCH', headers: { 'Content-Type': 'application/json', cookie: A }, body: JSON.stringify(body) });
const get = (url) => fetch(BASE + url, { headers: { cookie: A } });

const asin = 'B0' + ts.toString().slice(-8);
const lid = (await J(await fetch(BASE + '/api/listings', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: A }, body: JSON.stringify({ source: 'amazon', channel: 'coupang', sourceProductId: asin }) }))).listing.id;
await post('/api/listings/' + lid + '/process');

// 1) 損益内訳（手数料・配送料・仕入・利益）
const b0 = await J(await get('/api/listings/' + lid + '/breakdown'));
const costOk = b0.costJpy === b0.sourcePriceJpy + b0.domesticShippingJpy + b0.intlShippingJpy;
console.log(`1) 損益内訳: 売価=${b0.salePriceKrw} 手数料=${b0.feeKrw} 配送=${b0.intlShippingJpy} 仕入=${b0.sourcePriceJpy} 利益=${b0.profitJpy} 率=${b0.marginPct}% costOK=${costOk} => ${P(b0.salePriceKrw > 0 && b0.intlShippingJpy > 0 && costOk && Number.isFinite(b0.profitJpy))}`);

// 2) 利益率を50%に→保存して再計算→売価UP・利益UP
const before = (await J(await get('/api/listings/' + lid))).listing.listPrice;
await patch('/api/listings/' + lid, { marginOverride: 0.5 });
const rc = await J(await post('/api/listings/' + lid + '/recompute'));
console.log(`2) 再計算で売価UP・損益再算出: 旧=${before} 新=${rc.listPrice} 利益=${rc.breakdown?.profitJpy} => ${P(rc.listPrice > before && rc.breakdown && rc.breakdown.profitJpy > b0.profitJpy)}`);

// 3) 重量不明→国際配送料は一律1000円
await pool.query("UPDATE source_products SET raw = raw - 'weightG' WHERE source_product_id=$1", [asin]);
await patch('/api/listings/' + lid, { weightGOverride: null });
const b2 = await J(await get('/api/listings/' + lid + '/breakdown'));
console.log(`3) 重量不明は一律1000円: weightG=${b2.weightG} intl=${b2.intlShippingJpy} => ${P(b2.weightG == null && b2.intlShippingJpy === 1000)}`);

// cleanup
await pool.query("DELETE FROM tenants WHERE name LIKE '損益 %'");
await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'");
await pool.query('DELETE FROM source_products WHERE source_product_id = $1', [asin]);
await pool.end();
console.log('cleanup done');
