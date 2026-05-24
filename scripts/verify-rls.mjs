// RLS（重要表）の多層防御をDBレベルで検証：
//  - app専用ロール(compass_app)はGUC一致行のみ可視 / GUC無しは0件 / 他テナント不可視
//  - owner(DATABASE_URL)はbypass（migration/seed/テストが従来通り動く）
//  - アプリ(Next)が実際に compass_app で接続していることを pg_stat_activity で確認
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
const owner = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const app = new Pool({ connectionString: process.env.APP_DATABASE_URL, ssl: { rejectUnauthorized: false } });

// GUCをセットして app ロールで1クエリ実行（トランザクション内 SET LOCAL）
async function gucQ(tenantId, sql, params = []) {
  const c = await app.connect();
  try {
    await c.query('BEGIN');
    if (tenantId) await c.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
    const r = await c.query(sql, params);
    await c.query('COMMIT');
    return r;
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}

const o = await fetch(BASE + '/api/auth/signin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: (process.env.OWNER_EMAIL || 'hirohohashimoto@gmail.com').toLowerCase(), password: process.env.OWNER_INITIAL_PASSWORD }), redirect: 'manual' });
const oc = cookieOf(o);
async function tenant(name, email) {
  const on = await fetch(BASE + '/api/admin/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: oc }, body: JSON.stringify({ tenantName: name, email }) });
  const tk = ((await on.json()).inviteUrl || '').split('/invite/')[1];
  const ac = await fetch(BASE + '/api/auth/accept-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tk, password: 'pw-' + ts }), redirect: 'manual' });
  return cookieOf(ac);
}
const A = await tenant(`テストRLS-A ${ts}`, `ra+${ts}@example.com`);
const B = await tenant(`テストRLS-B ${ts}`, `rb+${ts}@example.com`);
const aId = (await owner.query('select id from tenants where name=$1', [`テストRLS-A ${ts}`])).rows[0].id;
const bId = (await owner.query('select id from tenants where name=$1', [`テストRLS-B ${ts}`])).rows[0].id;

// A: 出品(API)・連携(API)・受注(owner INSERT)
const asin = 'B0' + ts.toString().slice(-8);
const lid = (await J(await fetch(BASE + '/api/listings', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: A }, body: JSON.stringify({ source: 'amazon', channel: 'coupang', sourceProductId: asin }) }))).listing.id;
await fetch(BASE + '/api/tenant/integrations/coupang', { method: 'PUT', headers: { 'Content-Type': 'application/json', cookie: A }, body: JSON.stringify({ vendorId: 'V' + ts, accessKey: 'AK', secretKey: 'SK' }) });
await owner.query("INSERT INTO orders (tenant_id, channel, channel_order_id, status) VALUES ($1,'coupang',$2,'new')", [aId, 'O-' + ts]);

// 1) アプリが compass_app で接続している（pg_stat_activity）
await fetch(BASE + '/api/listings', { headers: { cookie: A } }); // 接続を使わせる
const act = await owner.query("select count(*)::int n from pg_stat_activity where usename='compass_app'");
console.log(`1) アプリはcompass_appで接続: 接続数=${act.rows[0].n} => ${P(act.rows[0].n > 0)}`);

// 2) appロール×GUC=A：自テナント行は見える
const aSeesOwn = (await gucQ(aId, 'select count(*)::int n from channel_listings where id=$1', [lid])).rows[0].n;
const aSeesInt = (await gucQ(aId, "select count(*)::int n from tenant_integrations where tenant_id=$1 and kind='coupang'", [aId])).rows[0].n;
const aSeesOrd = (await gucQ(aId, 'select count(*)::int n from orders where tenant_id=$1', [aId])).rows[0].n;
console.log(`2) GUC=Aで自テナント可視: listing=${aSeesOwn} integ=${aSeesInt} order=${aSeesOrd} => ${P(aSeesOwn === 1 && aSeesInt === 1 && aSeesOrd === 1)}`);

// 3) appロール×GUC=B：Aの行は一切見えない
const bSeesA_l = (await gucQ(bId, 'select count(*)::int n from channel_listings where id=$1', [lid])).rows[0].n;
const bSeesA_i = (await gucQ(bId, 'select count(*)::int n from tenant_integrations where tenant_id=$1', [aId])).rows[0].n;
const bSeesA_o = (await gucQ(bId, 'select count(*)::int n from orders where tenant_id=$1', [aId])).rows[0].n;
console.log(`3) GUC=BでAの行は不可視: listing=${bSeesA_l} integ=${bSeesA_i} order=${bSeesA_o} => ${P(bSeesA_l === 0 && bSeesA_i === 0 && bSeesA_o === 0)}`);

// 4) appロール×GUC無し：0件（コンテキスト無しは遮断）
const noGuc = (await gucQ(null, 'select count(*)::int n from channel_listings where id=$1', [lid])).rows[0].n;
console.log(`4) GUC無しは遮断(0件): listing=${noGuc} => ${P(noGuc === 0)}`);

// 5) owner はbypass（全行見える＝migration/seed/テストが従来通り）
const ownerSees = (await owner.query('select count(*)::int n from channel_listings where id=$1', [lid])).rows[0].n;
console.log(`5) ownerはbypass(可視): listing=${ownerSees} => ${P(ownerSees === 1)}`);

// cleanup
await owner.query("DELETE FROM tenants WHERE name LIKE 'テストRLS-%'");
await owner.query("DELETE FROM users WHERE email LIKE '%@example.com'");
await owner.query('DELETE FROM source_products WHERE source_product_id = $1', [asin]);
await app.end();
await owner.end();
console.log('cleanup done');
