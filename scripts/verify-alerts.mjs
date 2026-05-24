// アラート(赤字/欠品)のテナント分離・冪等・状態更新＋旧グローバル送信系の廃止(410)をE2E検証。
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
async function tenant(name, email) {
  const on = await fetch(BASE + '/api/admin/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: owner }, body: JSON.stringify({ tenantName: name, email }) });
  const token = ((await on.json()).inviteUrl || '').split('/invite/')[1];
  const ac = await fetch(BASE + '/api/auth/accept-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: 'pw-' + ts }), redirect: 'manual' });
  return cookieOf(ac);
}
const A = await tenant(`テストアラートA ${ts}`, `aa+${ts}@example.com`);
const B = await tenant(`テストアラートB ${ts}`, `ab+${ts}@example.com`);
const post = (cookie, url, body) => fetch(BASE + url, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
const get = (cookie, url) => fetch(BASE + url, { headers: { cookie } });

// A: 2件取込→処理
const asin1 = 'B0' + ts.toString().slice(-8); // 赤字
const asin2 = 'B1' + ts.toString().slice(-8); // 欠品
const lid1 = (await J(await post(A, '/api/listings', { source: 'amazon', channel: 'coupang', sourceProductId: asin1 }))).listing.id;
const lid2 = (await J(await post(A, '/api/listings', { source: 'amazon', channel: 'coupang', sourceProductId: asin2 }))).listing.id;
await post(A, '/api/listings/' + lid1 + '/process', {});
await post(A, '/api/listings/' + lid2 + '/process', {});

// 条件をSQLで確定：lid1=赤字(仕入値>下限,在庫あり) / asin2=欠品(在庫なし,赤字でない)
await pool.query('UPDATE channel_listings SET floor_price_jpy = 1000 WHERE id = $1', [lid1]);
await pool.query('UPDATE source_products SET last_price_jpy = 50000, last_in_stock = true WHERE source_product_id = $1', [asin1]);
await pool.query('UPDATE channel_listings SET floor_price_jpy = 1000 WHERE id = $1', [lid2]);
await pool.query('UPDATE source_products SET last_price_jpy = 1, last_in_stock = false WHERE source_product_id = $1', [asin2]);

// 1) スキャン：赤字+欠品 検知
const s1 = await J(await post(A, '/api/tenant/alerts/scan'));
console.log(`1) スキャンで赤字+欠品検知: created=${s1.created} open=${s1.open} => ${P(s1.created >= 2 && s1.open >= 2)}`);

// 2) テナント分離：BにAのアラートは見えない
const aOpen = await J(await get(A, '/api/tenant/alerts?status=open'));
const bOpen = await J(await get(B, '/api/tenant/alerts?status=open'));
console.log(`2) アラート分離: A=${aOpen.items?.length} B=${bOpen.items?.length} => ${P((aOpen.items?.length ?? 0) >= 2 && (bOpen.items?.length ?? 0) === 0)}`);

// 3) 冪等：再スキャンで新規作成なし
const s2 = await J(await post(A, '/api/tenant/alerts/scan'));
console.log(`3) 冪等(再スキャンで重複作成なし): created=${s2.created} => ${P(s2.created === 0)}`);

// 4) 解消：条件を戻すとopen→resolved
await pool.query('UPDATE source_products SET last_price_jpy = 1 WHERE source_product_id = $1', [asin1]);
await pool.query('UPDATE source_products SET last_in_stock = true WHERE source_product_id = $1', [asin2]);
const s3 = await J(await post(A, '/api/tenant/alerts/scan'));
console.log(`4) 条件解消でresolved化: resolved=${s3.resolved} open=${s3.open} => ${P(s3.resolved >= 2 && s3.open === 0)}`);

// 5) 状態更新：再発→ack
await pool.query('UPDATE source_products SET last_price_jpy = 50000 WHERE source_product_id = $1', [asin1]);
await post(A, '/api/tenant/alerts/scan');
const reopen = await J(await get(A, '/api/tenant/alerts?status=open'));
const aid = reopen.items?.[0]?.id;
const patch = await fetch(BASE + '/api/tenant/alerts/' + aid, { method: 'PATCH', headers: { 'Content-Type': 'application/json', cookie: A }, body: JSON.stringify({ status: 'ack' }) });
const pj = await patch.json();
const afterOpen = await J(await get(A, '/api/tenant/alerts?status=open'));
console.log(`5) ack更新: ${patch.status} status=${pj.item?.status} 残open=${afterOpen.items?.length} => ${P(patch.status === 200 && pj.item?.status === 'ack' && (afterOpen.items?.length ?? 1) === 0)}`);

// 6) 他テナントのアラートは更新不可（Bのcookieでaidをresolve→400/失敗）
const cross = await fetch(BASE + '/api/tenant/alerts/' + aid, { method: 'PATCH', headers: { 'Content-Type': 'application/json', cookie: B }, body: JSON.stringify({ status: 'resolved' }) });
console.log(`6) 他テナントのアラート更新不可: ${cross.status} => ${P(cross.status === 400)}`);

// 7) owner 403
const o1 = (await get(owner, '/api/tenant/alerts')).status;
const o2 = (await post(owner, '/api/tenant/alerts/scan')).status;
console.log(`7) ownerは403: alerts=${o1} scan=${o2} => ${P(o1 === 403 && o2 === 403)}`);

// 8) 旧グローバル送信系の廃止(410)
const d1 = (await fetch(BASE + '/api/coupang/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ asin: 'B0DEADBEEF' }) })).status;
const d2 = (await fetch(BASE + '/api/coupang/dry-run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ asin: 'B0DEADBEEF' }) })).status;
const d3 = (await fetch(BASE + '/api/asins/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ asins: ['B0DEADBEEF'] }) })).status;
const d4 = (await fetch(BASE + '/api/asins/B0DEADBEEF', { method: 'DELETE' })).status;
console.log(`8) 旧グローバル送信系の廃止410: submit=${d1} dryrun=${d2} asinsDel=${d3} asinDel=${d4} => ${P(d1 === 410 && d2 === 410 && d3 === 410 && d4 === 410)}`);

// cleanup
await pool.query("DELETE FROM tenants WHERE name LIKE 'テストアラート%'");
await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'");
await pool.query('DELETE FROM source_products WHERE source_product_id = ANY($1)', [[asin1, asin2]]);
await pool.end();
console.log('cleanup done');
