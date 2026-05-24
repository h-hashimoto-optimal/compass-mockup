// 連携(coupang)の実コンテキストがpreview/submitに配線され、かつ秘密がレスポンスに漏れないことを検証。
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
const on = await fetch(BASE + '/api/admin/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: owner }, body: JSON.stringify({ tenantName: `テスト配線 ${ts}`, email: `w+${ts}@example.com` }) });
const token = ((await on.json()).inviteUrl || '').split('/invite/')[1];
const ac = await fetch(BASE + '/api/auth/accept-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: 'pw-' + ts }), redirect: 'manual' });
const A = cookieOf(ac);
const post = (url, body) => fetch(BASE + url, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: A }, body: body ? JSON.stringify(body) : undefined });
const put = (url, body) => fetch(BASE + url, { method: 'PUT', headers: { 'Content-Type': 'application/json', cookie: A }, body: JSON.stringify(body) });

const asin = 'B0' + ts.toString().slice(-8);
const lid = (await J(await post('/api/listings', { source: 'amazon', channel: 'coupang', sourceProductId: asin }))).listing.id;
await post('/api/listings/' + lid + '/process', {});

// 1) 連携前: デモ vendorId(A012345)・未設定警告あり
const pv1 = await J(await post('/api/listings/' + lid + '/dry-run', {}));
const s1 = JSON.stringify(pv1.payload);
const warnUnset = (pv1.validation?.warnings || []).some((w) => w.msg.includes('Coupang連携が未設定'));
console.log(`1) 連携前=デモctx&未設定警告: demoVendor=${s1.includes('A012345')} 警告=${warnUnset} => ${P(s1.includes('A012345') && warnUnset)}`);

// 2) 連携保存
const VENDOR = 'AREAL' + ts.toString().slice(-5);
const ACCESS = 'AK_' + ts;
const SECRET = 'SK_SECRET_' + ts;
await put('/api/tenant/integrations/coupang', { vendorId: VENDOR, vendorUserId: 'wing_' + ts, accessKey: ACCESS, secretKey: SECRET, returnCenterCode: 'RC' + ts, outboundShippingPlaceCode: 'OB' + ts, returnZip: '1500001', returnAddress: 'Tokyo Shibuya', returnContactName: 'Han', returnContactNumber: '+81-3-1111-2222' });

// 3) 連携後: payloadに実vendorId反映・未設定警告消失・秘密はレスポンス非露出
const pv2res = await post('/api/listings/' + lid + '/dry-run', {});
const pv2text = await pv2res.text();
const pv2 = JSON.parse(pv2text);
const usesReal = JSON.stringify(pv2.payload).includes(VENDOR);
const warnGone = !(pv2.validation?.warnings || []).some((w) => w.msg.includes('Coupang連携が未設定'));
const noSecretLeak = !pv2text.includes(SECRET) && !pv2text.includes(ACCESS);
console.log(`2) 連携後=実vendor反映: ${usesReal} 未設定警告消失: ${warnGone} => ${P(usesReal && warnGone)}`);
console.log(`3) 秘密(access/secret)はレスポンス非露出: leak=${!noSecretLeak} => ${P(noSecretLeak)}`);

// 4) 本送信ガード: 鍵があっても COUPANG_LIVE_SEND 未設定なら dry-run
const sub = await J(await post('/api/listings/' + lid + '/submit', {}));
console.log(`4) 本送信ガード(鍵あり→dry-run): mode=${sub.mode} reason=${(sub.reason || '').slice(0, 20)}… => ${P(sub.mode === 'dry-run' && (sub.reason || '').includes('未有効化'))}`);

// cleanup
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await pool.query("DELETE FROM tenants WHERE name LIKE 'テスト配線%'");
await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'");
await pool.query('DELETE FROM source_products WHERE source_product_id = $1', [asin]);
await pool.end();
console.log('cleanup done');
