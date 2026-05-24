// 連携(API鍵)の暗号化保存・テナント分離・平文非保存・owner403 をE2E検証。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Pool } from 'pg';
function loadEnv() { for (const l of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]; } }
loadEnv();
const BASE = 'http://localhost:3000';
const ts = Date.now();
const P = (b) => (b ? 'PASS' : 'FAIL');
const J = (r) => r.json();
const cookieOf = (r) => ((r.headers.get('set-cookie') || '').match(/compass_session=[^;]+/) || [''])[0];
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

function decrypt(s) {
  const raw = Buffer.from(s, 'base64');
  const key = Buffer.from(process.env.SECRETS_MASTER_KEY, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8'));
}

const o = await fetch(BASE + '/api/auth/signin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: (process.env.OWNER_EMAIL || 'hirohohashimoto@gmail.com').toLowerCase(), password: process.env.OWNER_INITIAL_PASSWORD }), redirect: 'manual' });
const owner = cookieOf(o);
async function tenant(name, email) {
  const on = await fetch(BASE + '/api/admin/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: owner }, body: JSON.stringify({ tenantName: name, email }) });
  const token = ((await on.json()).inviteUrl || '').split('/invite/')[1];
  const ac = await fetch(BASE + '/api/auth/accept-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: 'pw-' + ts }), redirect: 'manual' });
  return cookieOf(ac);
}
const A = await tenant(`テスト連携A ${ts}`, `ina+${ts}@example.com`);
const B = await tenant(`テスト連携B ${ts}`, `inb+${ts}@example.com`);
const get = (cookie, url) => fetch(BASE + url, { headers: { cookie } });
const put = (cookie, url, body) => fetch(BASE + url, { method: 'PUT', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(body) });

// 0) サーバに暗号化鍵がロードされているか
const st0 = await J(await get(A, '/api/tenant/integrations/coupang'));
console.log(`0) サーバ暗号化鍵あり: masterKey=${st0.masterKey} connected=${st0.connected} => ${P(st0.masterKey === true && st0.connected === false)}`);
if (st0.masterKey !== true) { console.log('!! devサーバの再起動が必要（.env.localのSECRETS_MASTER_KEY未ロード）'); await pool.end(); process.exit(1); }

// 1) 保存→連携済み（シークレットは値が返らない）
const secret = 'SUPER_SECRET_' + ts;
const putRes = await J(await put(A, '/api/tenant/integrations/coupang', { vendorId: 'A0001', accessKey: 'AK_' + ts, secretKey: secret, returnZip: '1000001' }));
const noValueLeak = JSON.stringify(putRes).indexOf(secret) === -1;
console.log(`1) 保存→連携済み&値は返らない: connected=${putRes.connected} fields=${putRes.fields?.length} leak=${!noValueLeak} => ${P(putRes.connected === true && putRes.fields?.includes('secretKey') && noValueLeak)}`);

// 2) DBは平文でなく暗号化（復号で一致）
const [row] = (await pool.query("SELECT secrets_enc FROM tenant_integrations ti JOIN tenants t ON t.id=ti.tenant_id WHERE t.name=$1 AND ti.kind='coupang'", [`テスト連携A ${ts}`])).rows;
const plaintextInDb = row.secrets_enc.includes(secret);
const dec = decrypt(row.secrets_enc);
console.log(`2) DBは暗号化(平文非保存)&復号一致: 平文混入=${plaintextInDb} 復号secretKey一致=${dec.secretKey === secret} => ${P(!plaintextInDb && dec.secretKey === secret)}`);

// 3) 部分更新：vendorIdのみ変更してもsecretKeyは保持
await put(A, '/api/tenant/integrations/coupang', { vendorId: 'A0002' });
const [row2] = (await pool.query("SELECT secrets_enc FROM tenant_integrations ti JOIN tenants t ON t.id=ti.tenant_id WHERE t.name=$1 AND ti.kind='coupang'", [`テスト連携A ${ts}`])).rows;
const dec2 = decrypt(row2.secrets_enc);
console.log(`3) 部分更新でsecretKey保持&vendorId更新: vendorId=${dec2.vendorId} secret保持=${dec2.secretKey === secret} => ${P(dec2.vendorId === 'A0002' && dec2.secretKey === secret)}`);

// 4) テナント分離：BはAの連携を見ない
const stB = await J(await get(B, '/api/tenant/integrations/coupang'));
console.log(`4) 連携のテナント分離: B connected=${stB.connected} => ${P(stB.connected === false)}`);

// 5) amazon_spapi も保存できる
const amz = await J(await put(A, '/api/tenant/integrations/amazon_spapi', { sellerId: 'SELLER1', refreshToken: 'RT_' + ts }));
console.log(`5) amazon_spapi保存: connected=${amz.connected} fields=${amz.fields?.join(',')} => ${P(amz.connected === true && amz.fields?.includes('refreshToken'))}`);

// 6) owner 403 / 不明kind 400
const ow = (await get(owner, '/api/tenant/integrations/coupang')).status;
const ownerPut = (await put(owner, '/api/tenant/integrations/coupang', { vendorId: 'x' })).status;
const badKind = (await get(A, '/api/tenant/integrations/rakuten')).status;
console.log(`6) owner403/不明kind400: ownerGet=${ow} ownerPut=${ownerPut} badKind=${badKind} => ${P(ow === 403 && ownerPut === 403 && badKind === 400)}`);

// cleanup
await pool.query("DELETE FROM tenants WHERE name LIKE 'テスト連携%'");
await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'");
await pool.end();
console.log('cleanup done');
