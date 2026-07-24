// テナント別SP-API鍵の配線をE2E検証：
//  - 鍵なし→mockで処理成功（ready・タイトル/売価がつく）
//  - 偽の鍵あり→SP-API本番経路に入り、LWA認証失敗で処理が落ちる（=鍵が読まれ本番に行っている証拠）
//  - 鍵を外す→再びmockで成功
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
const on = await fetch(BASE + '/api/admin/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: owner }, body: JSON.stringify({ tenantName: `SPAPI ${ts}`, email: `sp+${ts}@example.com` }) });
const tk = ((await on.json()).inviteUrl || '').split('/invite/')[1];
const ac = await fetch(BASE + '/api/auth/accept-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tk, password: 'pw-' + ts }), redirect: 'manual' });
const A = cookieOf(ac);
const post = (url) => fetch(BASE + url, { method: 'POST', headers: { cookie: A } });
const put = (url, body) => fetch(BASE + url, { method: 'PUT', headers: { 'Content-Type': 'application/json', cookie: A }, body: JSON.stringify(body) });
const del = (url) => fetch(BASE + url, { method: 'DELETE', headers: { cookie: A } });
const getL = async (lid) => (await J(await fetch(BASE + '/api/listings/' + lid, { headers: { cookie: A } }))).listing;

const asin = 'B0' + ts.toString().slice(-8);
const lid = (await J(await fetch(BASE + '/api/listings', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: A }, body: JSON.stringify({ source: 'amazon', channel: 'coupang', sourceProductId: asin }) }))).listing.id;

// 1) 鍵なし → mockで処理成功（ready・タイトル/売価あり）
const r1 = await post('/api/listings/' + lid + '/process');
const l1 = await getL(lid);
console.log(`1) 鍵なし=mock処理成功: http=${r1.status} status=${l1.status} title=${!!l1.titleJa} listPrice=${l1.listPrice} => ${P(r1.status === 200 && l1.status === 'ready' && !!l1.titleJa && l1.listPrice > 0)}`);

// 2) 偽の鍵を保存
const amz = await J(await put('/api/tenant/integrations/amazon_spapi', { marketplaceId: 'A1VC38T7YXB528', region: 'fe', lwaClientId: 'amzn1.application-oa2-client.fake' + ts, lwaClientSecret: 'fakesecret' + ts, refreshToken: 'Atzr|FAKE' + ts }));
console.log(`2) 偽SP-API鍵を保存: connected=${amz.connected} fields=${amz.fields?.join(',')} => ${P(amz.connected === true && amz.fields?.includes('refreshToken'))}`);

// 3) 鍵あり → SP-API本番経路 → LWA認証失敗で処理が落ちる
const r3 = await post('/api/listings/' + lid + '/process');
const b3 = await J(r3);
const wentToSpApi = r3.status >= 400 && /SP_API/.test(b3.error || '');
console.log(`3) 偽鍵で本番経路に入りLWA失敗: http=${r3.status} err=${(b3.error || '').slice(0, 40)} => ${P(wentToSpApi)}`);

// 4) 鍵を外す → 再びmockで成功
await del('/api/tenant/integrations/amazon_spapi');
const r4 = await post('/api/listings/' + lid + '/process');
console.log(`4) 鍵を外すとmockで成功: http=${r4.status} => ${P(r4.status === 200)}`);

// cleanup
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await pool.query("DELETE FROM tenants WHERE name LIKE 'SPAPI %'");
await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'");
await pool.query('DELETE FROM source_products WHERE source_product_id = $1', [asin]);
await pool.end();
console.log('cleanup done');
