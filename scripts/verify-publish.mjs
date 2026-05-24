// 一括出品(/api/listings/bulk)のテナント分離＋処理/送信フローをE2E検証。
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
async function tenant(name, email) {
  const on = await fetch(BASE + '/api/admin/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: owner }, body: JSON.stringify({ tenantName: name, email }) });
  const token = ((await on.json()).inviteUrl || '').split('/invite/')[1];
  const ac = await fetch(BASE + '/api/auth/accept-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: 'pw-' + ts }), redirect: 'manual' });
  return cookieOf(ac);
}
const A = await tenant(`テスト一括A ${ts}`, `pa+${ts}@example.com`);
const B = await tenant(`テスト一括B ${ts}`, `pb+${ts}@example.com`);
const post = (cookie, url, body) => fetch(BASE + url, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
const get = (cookie, url) => fetch(BASE + url, { headers: { cookie } });

// A: 2件取込
const asin1 = 'B0' + ts.toString().slice(-8);
const asin2 = 'B1' + ts.toString().slice(-8);
const id1 = (await J(await post(A, '/api/listings', { source: 'amazon', channel: 'coupang', sourceProductId: asin1 }))).listing.id;
const id2 = (await J(await post(A, '/api/listings', { source: 'amazon', channel: 'coupang', sourceProductId: asin2 }))).listing.id;

// 1) 一括処理
const proc = await J(await post(A, '/api/listings/bulk', { ids: [id1, id2], action: 'process' }));
const procOk = (proc.results || []).filter((r) => r.ok).length;
console.log(`1) 一括処理: ok=${procOk}/2 => ${P(procOk === 2)}`);

// 2) 処理後はpending
const after = await J(await get(A, '/api/listings'));
const pendings = (after.listings || []).filter((l) => l.status === 'pending').length;
console.log(`2) 処理後pending化: ${pendings}/2 => ${P(pendings === 2)}`);

// 3) 一括送信（結果が2件返る。鍵/画像により mode/blocked いずれか）
const sub = await J(await post(A, '/api/listings/bulk', { ids: [id1, id2], action: 'submit' }));
console.log(`3) 一括送信で結果2件: ${sub.results?.length} 例=${JSON.stringify(sub.results?.[0])} => ${P((sub.results?.length ?? 0) === 2)}`);

// 4) 他テナント分離：BがAのidを一括処理→全件失敗(横取り不可)
const cross = await J(await post(B, '/api/listings/bulk', { ids: [id1, id2], action: 'process' }));
const crossOk = (cross.results || []).filter((r) => r.ok).length;
console.log(`4) BはAのidを一括処理不可: ok=${crossOk}/2 => ${P(crossOk === 0)}`);

// 5) owner 403
const ow = (await post(owner, '/api/listings/bulk', { ids: [id1], action: 'process' })).status;
console.log(`5) owner一括403: ${ow} => ${P(ow === 403)}`);

// 6) /publish ページ描画（テナント200/文言・owner本部メッセージ）
const pg = await get(A, '/publish'); const html = await pg.text();
const pgo = await get(owner, '/publish'); const ho = await pgo.text();
console.log(`6) /publish描画: テナント=${pg.status}/${html.includes('一括出品')} owner本部=${pgo.status}/${ho.includes('本部アカウント')} => ${P(pg.status === 200 && html.includes('一括出品') && pgo.status === 200 && ho.includes('本部アカウント'))}`);

// cleanup
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await pool.query("DELETE FROM tenants WHERE name LIKE 'テスト一括%'");
await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'");
await pool.query('DELETE FROM source_products WHERE source_product_id = ANY($1)', [[asin1, asin2]]);
await pool.end();
console.log('cleanup done');
