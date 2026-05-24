// 商品管理の検索・ステータス絞り込み・件数・ページングをE2E検証。
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
const on = await fetch(BASE + '/api/admin/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: owner }, body: JSON.stringify({ tenantName: `検索 ${ts}`, email: `se+${ts}@example.com` }) });
const tk = ((await on.json()).inviteUrl || '').split('/invite/')[1];
const ac = await fetch(BASE + '/api/auth/accept-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tk, password: 'pw-' + ts }), redirect: 'manual' });
const A = cookieOf(ac);
const add = (asin, title) => fetch(BASE + '/api/listings', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: A }, body: JSON.stringify({ source: 'amazon', channel: 'coupang', sourceProductId: asin, titleJa: title }) });
const get = (qs) => fetch(BASE + '/api/listings?' + qs, { headers: { cookie: A } });

const uniq = 'ZQX' + ts.toString().slice(-6);
const asins = ['B0' + ts.toString().slice(-8), 'B1' + ts.toString().slice(-8), 'B2' + ts.toString().slice(-8)];
await add(asins[0], 'ヘッドホン ' + uniq);
await add(asins[1], 'モバイルバッテリー 通常');
const lid3 = (await J(await add(asins[2], 'スニーカー 通常'))).listing.id;

// 1) all: 件数・カウント
const all = await J(await get('group=all'));
console.log(`1) 一覧+件数: total=${all.total} draft=${all.counts?.draft} => ${P(all.total === 3 && all.counts?.draft === 3)}`);

// 2) 検索（ユニーク語）
const s = await J(await get('q=' + encodeURIComponent(uniq)));
console.log(`2) 検索でtitle絞り込み: total=${s.total} => ${P(s.total === 1 && s.listings[0].sourceProductId === asins[0])}`);

// 3) ASIN検索
const s2 = await J(await get('q=' + asins[1]));
console.log(`3) 検索でASIN絞り込み: total=${s2.total} => ${P(s2.total === 1 && s2.listings[0].sourceProductId === asins[1])}`);

// 4) ページング
const p1 = await J(await get('group=all&pageSize=2&page=1'));
const p2 = await J(await get('group=all&pageSize=2&page=2'));
console.log(`4) ページング(2件/頁): p1=${p1.listings?.length} p2=${p2.listings?.length} total=${p1.total} => ${P(p1.listings?.length === 2 && p2.listings?.length === 1 && p1.total === 3)}`);

// 5) ステータス絞り込み（1件をready化）
await fetch(BASE + '/api/listings/' + lid3 + '/process', { method: 'POST', headers: { cookie: A } });
const ready = await J(await get('group=ready'));
const draft = await J(await get('group=draft'));
console.log(`5) 群フィルタ: ready=${ready.total} draft=${draft.total} counts(ready=${draft.counts?.ready},draft=${draft.counts?.draft}) => ${P(ready.total === 1 && draft.total === 2 && draft.counts?.ready === 1 && draft.counts?.draft === 2)}`);

// 6) 検索×群の複合
const sg = await J(await get('group=draft&q=' + encodeURIComponent(uniq)));
console.log(`6) 検索×群: total=${sg.total} => ${P(sg.total === 1)}`);

// cleanup
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await pool.query("DELETE FROM tenants WHERE name LIKE '検索 %'");
await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'");
await pool.query('DELETE FROM source_products WHERE source_product_id = ANY($1)', [asins]);
await pool.end();
console.log('cleanup done');
