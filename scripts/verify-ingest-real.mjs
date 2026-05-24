// 拡張がスクレイプした実データ(価格/ブランド/画像)が 受信→処理 を通しても維持されることを検証。
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
const on = await fetch(BASE + '/api/admin/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: owner }, body: JSON.stringify({ tenantName: `テスト実データ ${ts}`, email: `rd+${ts}@example.com` }) });
const tk = ((await on.json()).inviteUrl || '').split('/invite/')[1];
const ac = await fetch(BASE + '/api/auth/accept-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tk, password: 'pw-' + ts }), redirect: 'manual' });
const A = cookieOf(ac);
const tok = (await J(await fetch(BASE + '/api/tenant/token', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: A }, body: JSON.stringify({}) }))).token;
const post = (url, body) => fetch(BASE + url, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: A }, body: body ? JSON.stringify(body) : undefined });

const asin = 'B0' + ts.toString().slice(-8);
const REAL_PRICE = 7777; // mock擬似価格(980〜5880)の範囲外＝実データ保持を判別できる
const REAL_BRAND = '拡張ブランド' + ts.toString().slice(-4);
const REAL_IMG = 'https://example.com/real-' + ts + '.jpg';

// 拡張相当：実データ付きで /api/ingest
await fetch(BASE + '/api/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Compass-Token': tok }, body: JSON.stringify({ source: 'amazon-jp', items: [{ asin, title: '実スクレイプ商品', brand: REAL_BRAND, priceJpy: REAL_PRICE, imageUrl: REAL_IMG, url: 'https://www.amazon.co.jp/dp/' + asin }] }) });
const list = await J(await fetch(BASE + '/api/listings', { headers: { cookie: A } }));
const lid = (list.listings || []).find((l) => l.sourceProductId === asin)?.id;
console.log(`1) 受信時に実価格保持: sourcePriceJpy=${(list.listings || []).find((l) => l.sourceProductId === asin)?.sourcePriceJpy} => ${P((list.listings || []).find((l) => l.sourceProductId === asin)?.sourcePriceJpy === REAL_PRICE)}`);

// 処理 → 実価格/ブランド/画像が維持されるか
await post('/api/listings/' + lid + '/process', {});
const det = (await J(await fetch(BASE + '/api/listings/' + lid, { headers: { cookie: A } }))).listing;
const pv = await J(await post('/api/listings/' + lid + '/dry-run', {}));
console.log(`2) 処理後も実価格維持(mock擬似でなく${REAL_PRICE}): ${det.sourcePriceJpy} => ${P(det.sourcePriceJpy === REAL_PRICE)}`);
console.log(`3) 処理後も実ブランド維持: "${pv.preview?.brand}" => ${P(pv.preview?.brand === REAL_BRAND)}`);
console.log(`4) 処理後も実メイン画像維持: ${pv.preview?.images?.[0]} => ${P(pv.preview?.images?.[0] === REAL_IMG)}`);

// 対照：hint無し(手動ASINのみ)はmockフォールバック（擬似価格980〜5880・picsum画像）
const asin2 = 'B1' + ts.toString().slice(-8);
const lid2 = (await J(await post('/api/listings', { source: 'amazon', channel: 'coupang', sourceProductId: asin2 }))).listing.id;
await post('/api/listings/' + lid2 + '/process', {});
const det2 = (await J(await fetch(BASE + '/api/listings/' + lid2, { headers: { cookie: A } }))).listing;
const pv2 = await J(await post('/api/listings/' + lid2 + '/dry-run', {}));
const isMockPrice = det2.sourcePriceJpy >= 980 && det2.sourcePriceJpy <= 5880;
const isPicsum = (pv2.preview?.images?.[0] || '').includes('picsum');
console.log(`5) 対照(hint無し)はmockフォールバック: 価格=${det2.sourcePriceJpy}(mock範囲=${isMockPrice}) 画像picsum=${isPicsum} => ${P(isMockPrice && isPicsum)}`);

// cleanup
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await pool.query("DELETE FROM tenants WHERE name LIKE 'テスト実データ%'");
await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'");
await pool.query('DELETE FROM source_products WHERE source_product_id = ANY($1)', [[asin, asin2]]);
await pool.end();
console.log('cleanup done');
