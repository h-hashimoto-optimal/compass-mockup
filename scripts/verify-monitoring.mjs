// 受注・監視設定のテナント分離＋監視設定がscanAlertsに反映されることをE2E検証。
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
const A = await tenant(`テスト監視A ${ts}`, `ma+${ts}@example.com`);
const B = await tenant(`テスト監視B ${ts}`, `mb+${ts}@example.com`);
const get = (cookie, url) => fetch(BASE + url, { headers: { cookie } });
const post = (cookie, url, body) => fetch(BASE + url, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
const put = (cookie, url, body) => fetch(BASE + url, { method: 'PUT', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(body) });
const aId = (await pool.query('SELECT id FROM tenants WHERE name=$1', [`テスト監視A ${ts}`])).rows[0].id;

// ── 受注：分離 ──
await pool.query("INSERT INTO orders (tenant_id, channel, channel_order_id, status, buyer_name, total_amount) VALUES ($1,'coupang',$2,'new','홍길동',12000)", [aId, 'ORD-' + ts]);
const ordA = await J(await get(A, '/api/tenant/orders'));
const ordB = await J(await get(B, '/api/tenant/orders'));
console.log(`1) 受注のテナント分離: A=${ordA.items?.length} B=${ordB.items?.length} => ${P((ordA.items?.length ?? 0) === 1 && (ordB.items?.length ?? 0) === 0)}`);
const ordOwner = (await get(owner, '/api/tenant/orders')).status;
console.log(`2) 受注 owner403: ${ordOwner} => ${P(ordOwner === 403)}`);

// ── 監視設定：分離 ──
await put(A, '/api/tenant/monitoring', { detectLoss: false, detectOos: false, lossBufferPct: 0.1, notifyEmail: true });
const monA = await J(await get(A, '/api/tenant/monitoring'));
const monB = await J(await get(B, '/api/tenant/monitoring'));
console.log(`3) 監視設定分離: A.detectLoss=${monA.detectLoss} A.buffer=${monA.lossBufferPct} B.detectLoss=${monB.detectLoss}(既定true) => ${P(monA.detectLoss === false && Number(monA.lossBufferPct) === 0.1 && monB.detectLoss === true)}`);
const monOwner = (await get(owner, '/api/tenant/monitoring')).status;
console.log(`4) 監視 owner403: ${monOwner} => ${P(monOwner === 403)}`);

// ── 監視設定が scan に反映 ──
const asin = 'B0' + ts.toString().slice(-8);
const lid = (await J(await post(A, '/api/listings', { source: 'amazon', channel: 'coupang', sourceProductId: asin }))).listing.id;
await post(A, '/api/listings/' + lid + '/process', {});
await pool.query('UPDATE channel_listings SET floor_price_jpy = 1000 WHERE id = $1', [lid]);
await pool.query('UPDATE source_products SET last_price_jpy = 1100, last_in_stock = false WHERE source_product_id = $1', [asin]);

// A: detectLoss/Oos=false → 検知なし
const s1 = await J(await post(A, '/api/tenant/alerts/scan'));
console.log(`5) 検知OFFで作成0: created=${s1.created} open=${s1.open} => ${P(s1.created === 0 && s1.open === 0)}`);

// 検知ON(buffer0) → 赤字+欠品
await put(A, '/api/tenant/monitoring', { detectLoss: true, detectOos: true, lossBufferPct: 0 });
const s2 = await J(await post(A, '/api/tenant/alerts/scan'));
console.log(`6) 検知ONで赤字+欠品検知: created=${s2.created} => ${P(s2.created === 2)}`);

// buffer効果：仕入値950(<下限1000)。buffer0なら赤字でない→解消、buffer0.15なら閾値850<950で赤字
await pool.query('UPDATE source_products SET last_price_jpy = 950, last_in_stock = true WHERE source_product_id = $1', [asin]);
await put(A, '/api/tenant/monitoring', { detectLoss: true, detectOos: true, lossBufferPct: 0 });
const s3 = await J(await post(A, '/api/tenant/alerts/scan'));
const openLossA = (await J(await get(A, '/api/tenant/alerts?status=open'))).items?.filter((x) => x.type === 'price_up_loss').length ?? 0;
await put(A, '/api/tenant/monitoring', { detectLoss: true, detectOos: true, lossBufferPct: 0.15 });
const s4 = await J(await post(A, '/api/tenant/alerts/scan'));
const openLossA2 = (await J(await get(A, '/api/tenant/alerts?status=open'))).items?.filter((x) => x.type === 'price_up_loss').length ?? 0;
console.log(`7) 予備警告マージン反映(950: buffer0→赤字なし / buffer0.15→赤字): open赤字 buffer0=${openLossA} buffer0.15=${openLossA2} => ${P(openLossA === 0 && openLossA2 === 1)}`);

// cleanup
await pool.query("DELETE FROM tenants WHERE name LIKE 'テスト監視%'");
await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'");
await pool.query('DELETE FROM source_products WHERE source_product_id = $1', [asin]);
await pool.end();
console.log('cleanup done');
