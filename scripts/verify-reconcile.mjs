// Coupang状態同期(reconcile)：承認/販売の取り込み・却下・一括・分離をE2E検証。
// 実キー無し＝モック（sellerProductIdに'REJECT'を含めば반려、他は승인완료+판매중）。
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
  const tk = ((await on.json()).inviteUrl || '').split('/invite/')[1];
  const ac = await fetch(BASE + '/api/auth/accept-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tk, password: 'pw-' + ts }), redirect: 'manual' });
  return cookieOf(ac);
}
const A = await tenant(`テスト同期A ${ts}`, `rca+${ts}@example.com`);
const B = await tenant(`テスト同期B ${ts}`, `rcb+${ts}@example.com`);
const post = (cookie, url) => fetch(BASE + url, { method: 'POST', headers: { cookie } });
const get = (cookie, url) => fetch(BASE + url, { headers: { cookie } });

// A: 2件取込→処理→（送信済みをSQLで模擬：status=submitted＋sellerProductId付与）
const a1 = 'B0' + ts.toString().slice(-8);
const a2 = 'B1' + ts.toString().slice(-8);
const mk = async (asin, spid) => {
  const lid = (await J(await fetch(BASE + '/api/listings', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: A }, body: JSON.stringify({ source: 'amazon', channel: 'coupang', sourceProductId: asin }) }))).listing.id;
  await post(A, '/api/listings/' + lid + '/process');
  await pool.query("UPDATE channel_listings SET status='submitted', channel_product_id=$2 WHERE id=$1", [lid, spid]);
  return lid;
};
const lidOk = await mk(a1, 'SP' + ts); // 승인완료+판매중
const lidRej = await mk(a2, 'SP-REJECT-' + ts); // 반려

// 1) 承認済み→販売中の取り込み
const r1 = await J(await post(A, '/api/listings/' + lidOk + '/reconcile'));
console.log(`1) 同期で承認/販売取り込み: approval=${r1.approvalStatus} sales=${r1.salesStatus} vi=${r1.vendorItemId ? 'あり' : 'なし'} => ${P(r1.ok && r1.approvalStatus === 'approved' && r1.salesStatus === 'on_sale' && !!r1.vendorItemId)}`);
const d1 = (await J(await get(A, '/api/listings/' + lidOk))).listing;
console.log(`2) DB反映(出品詳細): approval=${d1.coupangApprovalStatus} sales=${d1.coupangSalesStatus} => ${P(d1.coupangApprovalStatus === 'approved' && d1.coupangSalesStatus === 'on_sale')}`);

// 3) 却下の取り込み（理由付き・販売null）
const r2 = await J(await post(A, '/api/listings/' + lidRej + '/reconcile'));
console.log(`3) 却下の取り込み: approval=${r2.approvalStatus} sales=${r2.salesStatus} reason=${r2.rejectedReason ? 'あり' : 'なし'} => ${P(r2.approvalStatus === 'rejected' && r2.salesStatus == null && !!r2.rejectedReason)}`);

// 4) 未送信(ready)はスキップ
const a3 = 'B2' + ts.toString().slice(-8);
const lidReady = (await J(await fetch(BASE + '/api/listings', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: A }, body: JSON.stringify({ source: 'amazon', channel: 'coupang', sourceProductId: a3 }) }))).listing.id;
await post(A, '/api/listings/' + lidReady + '/process');
const r3 = await J(await post(A, '/api/listings/' + lidReady + '/reconcile'));
console.log(`4) 未送信はスキップ: skipped=${r3.skipped} => ${P(r3.skipped === true)}`);

// 5) 一括同期（submitted対象のみ）
const r4 = await J(await post(A, '/api/tenant/reconcile'));
console.log(`5) 一括同期(submitted対象): scanned=${r4.scanned} updated=${r4.updated} => ${P(r4.scanned === 2 && r4.updated === 2)}`);

// 6) 分離：BはAのlistingを同期不可(404)
const cross = await post(B, '/api/listings/' + lidOk + '/reconcile');
console.log(`6) 他テナントのlisting同期不可: ${cross.status} => ${P(cross.status === 404)}`);

// 7) owner 403
const ow = (await post(owner, '/api/tenant/reconcile')).status;
console.log(`7) ownerは403: ${ow} => ${P(ow === 403)}`);

// cleanup
await pool.query("DELETE FROM tenants WHERE name LIKE 'テスト同期%'");
await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'");
await pool.query('DELETE FROM source_products WHERE source_product_id = ANY($1)', [[a1, a2, a3]]);
await pool.end();
console.log('cleanup done');
