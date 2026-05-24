// 商品個別の利益率上書き＋手動売価＋カテゴリ手動上書きをE2E検証。
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
const on = await fetch(BASE + '/api/admin/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: owner }, body: JSON.stringify({ tenantName: `上書き ${ts}`, email: `ov+${ts}@example.com` }) });
const tk = ((await on.json()).inviteUrl || '').split('/invite/')[1];
const ac = await fetch(BASE + '/api/auth/accept-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tk, password: 'pw-' + ts }), redirect: 'manual' });
const A = cookieOf(ac);
const post = (url) => fetch(BASE + url, { method: 'POST', headers: { cookie: A } });
const patch = (url, body) => fetch(BASE + url, { method: 'PATCH', headers: { 'Content-Type': 'application/json', cookie: A }, body: JSON.stringify(body) });
const getL = async (lid) => (await J(await fetch(BASE + '/api/listings/' + lid, { headers: { cookie: A } }))).listing;

const asin = 'B0' + ts.toString().slice(-8);
const lid = (await J(await fetch(BASE + '/api/listings', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: A }, body: JSON.stringify({ source: 'amazon', channel: 'coupang', sourceProductId: asin }) }))).listing.id;
await post('/api/listings/' + lid + '/process');
const p0 = (await getL(lid)).listPrice;

// 1) 利益率を50%に上書き→再処理→売価が上がる
await patch('/api/listings/' + lid, { marginOverride: 0.5 });
const d1 = await getL(lid);
await post('/api/listings/' + lid + '/process');
const p1 = (await getL(lid)).listPrice;
console.log(`1) 利益率上書き保存: marginOverride=${d1.marginOverride} => ${P(Number(d1.marginOverride) === 0.5)}`);
console.log(`2) 上書き後の再処理で売価上昇(25%→50%): p0=${p0} p1=${p1} => ${P(p1 > p0)}`);

// 3) 手動売価編集（送信前）
await patch('/api/listings/' + lid, { listPrice: 99999 });
console.log(`3) 手動売価編集: listPrice=${(await getL(lid)).listPrice} => ${P((await getL(lid)).listPrice === 99999)}`);

// 4) カテゴリ手動上書き→プレビューに反映
await patch('/api/listings/' + lid, { coupangCategoryCode: 778899, coupangCategoryName: '수동카테고리' });
const pv = await J(await post('/api/listings/' + lid + '/dry-run'));
console.log(`4) カテゴリ手動上書きがプレビュー反映: category=${pv.preview?.category} => ${P(pv.preview?.category === '수동카테고리')}`);

// 5) カテゴリ上書きクリア→自動推定に戻る（mock）
await patch('/api/listings/' + lid, { coupangCategoryCode: null, coupangCategoryName: null });
const pv2 = await J(await post('/api/listings/' + lid + '/dry-run'));
console.log(`5) クリアで自動推定に戻る: category=${pv2.preview?.category} 手動でない=${pv2.preview?.category !== '수동카테고리'} => ${P(pv2.preview?.category !== '수동카테고리' && !!pv2.preview?.category)}`);

// cleanup
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await pool.query("DELETE FROM tenants WHERE name LIKE '上書き %'");
await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'");
await pool.query('DELETE FROM source_products WHERE source_product_id = $1', [asin]);
await pool.end();
console.log('cleanup done');
