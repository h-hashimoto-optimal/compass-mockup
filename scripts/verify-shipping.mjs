// 重量別の国際配送料が 赤字下限/売価 に反映されること、テナント料金表編集が効くことをE2E検証。
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
const on = await fetch(BASE + '/api/admin/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: owner }, body: JSON.stringify({ tenantName: `送料 ${ts}`, email: `sh+${ts}@example.com` }) });
const tk = ((await on.json()).inviteUrl || '').split('/invite/')[1];
const ac = await fetch(BASE + '/api/auth/accept-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tk, password: 'pw-' + ts }), redirect: 'manual' });
const A = cookieOf(ac);
const post = (url) => fetch(BASE + url, { method: 'POST', headers: { cookie: A } });
const patch = (url, body) => fetch(BASE + url, { method: 'PATCH', headers: { 'Content-Type': 'application/json', cookie: A }, body: JSON.stringify(body) });
const put = (url, body) => fetch(BASE + url, { method: 'PUT', headers: { 'Content-Type': 'application/json', cookie: A }, body: JSON.stringify(body) });
const getL = async (lid) => (await J(await fetch(BASE + '/api/listings/' + lid, { headers: { cookie: A } }))).listing;

const asin = 'B0' + ts.toString().slice(-8);
const lid = (await J(await fetch(BASE + '/api/listings', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: A }, body: JSON.stringify({ source: 'amazon', channel: 'coupang', sourceProductId: asin }) }))).listing.id;

// 軽い(300g=900円)
await patch('/api/listings/' + lid, { weightGOverride: 300 });
await post('/api/listings/' + lid + '/process');
const light = await getL(lid);

// 重い(25000g=4800円)
await patch('/api/listings/' + lid, { weightGOverride: 25000 });
await post('/api/listings/' + lid + '/process');
const heavy = await getL(lid);

console.log(`1) 重いほど売価が上がる: 軽=${light.listPrice} 重=${heavy.listPrice} => ${P(heavy.listPrice > light.listPrice)}`);
// 売価が送料分上がるため、その売価での損益分岐仕入(=赤字下限)も上がる＝送料が反映されている
console.log(`2) 送料が赤字下限に反映(重いほど変化): 軽=${light.floorPriceJpy} 重=${heavy.floorPriceJpy} => ${P(heavy.floorPriceJpy !== light.floorPriceJpy && heavy.floorPriceJpy > light.floorPriceJpy)}`);

// テナント料金表を編集（全帯9999円）→さらに送料増→下限さらに低下
await put('/api/tenant/settings', { settings: { shippingRates: [{ maxG: 100000, feeJpy: 9999 }] } });
const st = await J(await (await fetch(BASE + '/api/tenant/settings', { headers: { cookie: A } })));
const savedTiers = st.settings?.shippingRatesJson;
await post('/api/listings/' + lid + '/process');
const custom = await getL(lid);
console.log(`3) 料金表編集が保存される: ${JSON.stringify(savedTiers)} => ${P(Array.isArray(savedTiers) && savedTiers[0]?.feeJpy === 9999)}`);
console.log(`4) 料金表編集が下限に反映(9999円→更に変化): 重=${heavy.floorPriceJpy} 編集後=${custom.floorPriceJpy} => ${P(custom.floorPriceJpy > heavy.floorPriceJpy)}`);

// cleanup
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await pool.query("DELETE FROM tenants WHERE name LIKE '送料 %'");
await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'");
await pool.query('DELETE FROM source_products WHERE source_product_id = $1', [asin]);
await pool.end();
console.log('cleanup done');
