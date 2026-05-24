// 設定のテナント分離E2E（Aの変更がBに影響しない／pricingに反映）。
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
  return cookieOf(ac);
}
const A = await tenant(`テスト設定A ${ts}`, `sa+${ts}@example.com`);
const B = await tenant(`テスト設定B ${ts}`, `sb+${ts}@example.com`);

// A: 利益率を40%に
const put = await fetch(BASE + '/api/tenant/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json', cookie: A }, body: JSON.stringify({ settings: { marginRate: 0.4, fxBuffer: 0.05, domesticShippingJpy: 300 }, coupang: { sellFeeRate: 0.09, priceRounding: 100 } }) });
const pj = await put.json();
console.log(`1) A設定保存: ${put.status} margin=${pj.settings?.marginRate} fee=${pj.coupang?.sellFeeRate} => ${P(put.status === 200 && Number(pj.settings?.marginRate) === 0.4 && Number(pj.coupang?.sellFeeRate) === 0.09)}`);

// B: 既定のまま（Aの変更が混入しない）
const bg = await (await fetch(BASE + '/api/tenant/settings', { headers: { cookie: B } })).json();
console.log(`2) B設定は既定(分離): margin=${bg.settings?.marginRate} => ${P(Number(bg.settings?.marginRate) === 0.25)}`);

// owner: 403
const og = await fetch(BASE + '/api/tenant/settings', { headers: { cookie: owner } });
console.log(`3) ownerは403: ${og.status} => ${P(og.status === 403)}`);

// A: 取込→処理 で A設定が使われる（丸め100→売価が100の倍数）
const asin = 'B0' + ts.toString().slice(-8);
const ing = await fetch(BASE + '/api/listings', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: A }, body: JSON.stringify({ source: 'amazon', channel: 'coupang', sourceProductId: asin }) });
const lid = (await ing.json()).listing.id;
const pr = await fetch(BASE + '/api/listings/' + lid + '/process', { method: 'POST', headers: { cookie: A } });
const lst = (await pr.json()).listing;
console.log(`4) A設定でprocess(売価が丸め100倍数): 売価=${lst?.listPrice} => ${P(pr.status === 200 && lst?.listPrice > 0 && lst.listPrice % 100 === 0)}`);

// cleanup
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await pool.query("DELETE FROM tenants WHERE name LIKE 'テスト設定%'");
await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'");
await pool.query('DELETE FROM source_products WHERE source_product_id = $1', [asin]);
await pool.end();
console.log('cleanup done');
