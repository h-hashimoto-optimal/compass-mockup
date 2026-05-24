// 全テナント・リソース横断の漏洩回帰ガード：AのデータがBから一切見えない／ownerはテナントAPI 403。
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
const A = await tenant(`テスト隔離A ${ts}`, `xa+${ts}@example.com`);
const B = await tenant(`テスト隔離B ${ts}`, `xb+${ts}@example.com`);
const post = (cookie, url, body) => fetch(BASE + url, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
const put = (cookie, url, body) => fetch(BASE + url, { method: 'PUT', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(body) });
const get = (cookie, url) => fetch(BASE + url, { headers: { cookie } });
const len = (j) => (Array.isArray(j?.items) ? j.items.length : Array.isArray(j?.listings) ? j.listings.length : 0);

// Aに全リソースを作る
const asin = 'B0' + ts.toString().slice(-8);
const lid = (await J(await post(A, '/api/listings', { source: 'amazon', channel: 'coupang', sourceProductId: asin }))).listing.id;
await post(A, '/api/listings/' + lid + '/process', {});
await put(A, '/api/tenant/settings', { settings: { marginRate: 0.42, fxBuffer: 0.07, domesticShippingJpy: 500 }, coupang: { sellFeeRate: 0.08, priceRounding: 100 } });
await post(A, '/api/tenant/ng-words', { word: 'AだけNG' + ts, mode: 'block' });
await post(A, '/api/tenant/blacklist', { source: 'amazon', asin: 'B9' + ts.toString().slice(-8), reason: 'A only' });
await post(A, '/api/tenant/ip-brands', { brand: 'AだけBrand' + ts, level: 'block' });
await post(A, '/api/tenant/token', {});
await pool.query('UPDATE channel_listings SET floor_price_jpy = 1000 WHERE id = $1', [lid]);
await pool.query('UPDATE source_products SET last_price_jpy = 90000, last_in_stock = false WHERE source_product_id = $1', [asin]);
await post(A, '/api/tenant/alerts/scan');

// 1) B視点：すべて空 or 既定（Aの痕跡なし）
const r = {
  listings: await J(await get(B, '/api/listings')),
  settings: await J(await get(B, '/api/tenant/settings')),
  ng: await J(await get(B, '/api/tenant/ng-words')),
  bl: await J(await get(B, '/api/tenant/blacklist')),
  ip: await J(await get(B, '/api/tenant/ip-brands')),
  alerts: await J(await get(B, '/api/tenant/alerts')),
  tokens: await J(await get(B, '/api/tenant/token')),
};
console.log(`1) B出品は0(Aの出品が漏れない): ${len(r.listings)} => ${P(len(r.listings) === 0)}`);
console.log(`2) B設定は既定(Aの42%が漏れない): margin=${r.settings.settings?.marginRate} => ${P(Number(r.settings.settings?.marginRate) === 0.25)}`);
const ngLeak = (r.ng.items || []).some((x) => x.word?.includes('AだけNG'));
console.log(`3) B禁止ワードにAの追加語なし: leak=${ngLeak} => ${P(!ngLeak)}`);
console.log(`4) Bブラックリスト0(Aの登録が漏れない): ${len(r.bl)} => ${P(len(r.bl) === 0)}`);
const ipLeak = (r.ip.items || []).some((x) => x.brand?.includes('AだけBrand'));
console.log(`5) B知財にAの自社追加なし(共有のみ): leak=${ipLeak} => ${P(!ipLeak)}`);
console.log(`6) Bアラート0(Aの検知が漏れない): ${len(r.alerts)} => ${P(len(r.alerts) === 0)}`);
const tokLeak = (r.tokens.items || r.tokens.tokens || []).length;
console.log(`7) BトークンにAの分が漏れない: B件数=${tokLeak} => ${P(tokLeak === 0)}`);

// 8) Bが Aのlisting id を直接叩いても 404（横取り不可）
const crossPatch = await fetch(BASE + '/api/listings/' + lid, { method: 'PATCH', headers: { 'Content-Type': 'application/json', cookie: B }, body: JSON.stringify({ titleJa: 'のっとり' }) });
const crossProc = await post(B, '/api/listings/' + lid + '/process', {});
const crossDry = await post(B, '/api/listings/' + lid + '/dry-run', {});
console.log(`8) BはAのlistingを直接操作不可(404): patch=${crossPatch.status} process=${crossProc.status} dryrun=${crossDry.status} => ${P(crossPatch.status === 404 && crossProc.status === 404 && crossDry.status === 404)}`);

// 9) ownerはテナントAPIすべて403
const ow = await Promise.all([
  get(owner, '/api/listings'), get(owner, '/api/tenant/settings'), get(owner, '/api/tenant/ng-words'),
  get(owner, '/api/tenant/blacklist'), get(owner, '/api/tenant/ip-brands'), get(owner, '/api/tenant/alerts'),
  get(owner, '/api/tenant/token'),
].map((p) => p.then((x) => x.status)));
console.log(`9) ownerはテナントAPI全403: [${ow.join(',')}] => ${P(ow.every((s) => s === 403))}`);

// cleanup
await pool.query("DELETE FROM tenants WHERE name LIKE 'テスト隔離%'");
await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'");
await pool.query('DELETE FROM source_products WHERE source_product_id = $1', [asin]);
await pool.end();
console.log('cleanup done');
