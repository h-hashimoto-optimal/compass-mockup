// ASIN取得グループ（受信トレイ）：グループ化・件数集計・選別処理・テナント分離をE2E検証。
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
  const tk = ((await on.json()).inviteUrl || '').split('/invite/')[1];
  const ac = await fetch(BASE + '/api/auth/accept-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tk, password: 'pw-' + ts }), redirect: 'manual' });
  const cookie = cookieOf(ac);
  const tok = (await J(await fetch(BASE + '/api/tenant/token', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({}) }))).token;
  return { cookie, tok };
}
const A = await tenant(`テストグループA ${ts}`, `ga+${ts}@example.com`);
const B = await tenant(`テストグループB ${ts}`, `gb+${ts}@example.com`);
const get = (cookie, url) => fetch(BASE + url, { headers: { cookie } });

const a1 = 'B0' + ts.toString().slice(-8);
const a2 = 'B1' + ts.toString().slice(-8);
const a3 = 'B2' + ts.toString().slice(-8);
// A: 拡張相当で1グループ取込（検索語+取得日時+3件）
const ing = await J(await fetch(BASE + '/api/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Compass-Token': A.tok }, body: JSON.stringify({ source: 'amazon-jp', query: 'ヘッドホン', url: 'https://www.amazon.co.jp/s?k=ヘッドホン', capturedAt: new Date().toISOString(), items: [{ asin: a1, title: 'ヘッドホンA', priceJpy: 3000 }, { asin: a2, title: 'ヘッドホンB', priceJpy: 4000 }, { asin: a3, title: 'ヘッドホンC', priceJpy: 5000 }] }) }));
console.log(`1) 取込でグループ作成(batchId返る): ${ing.batchId ? 'あり' : 'なし'} 受信=${ing.received} => ${P(!!ing.batchId && ing.received === 3)}`);

// A: グループ一覧（検索語・件数・未処理）
const bl = await J(await get(A.cookie, '/api/tenant/batches'));
const grp = (bl.items || []).find((x) => x.id === ing.batchId);
console.log(`2) グループ一覧に出る(検索語/総数/未処理): query=${grp?.query} total=${grp?.total} drafts=${grp?.drafts} => ${P(grp?.query === 'ヘッドホン' && grp?.total === 3 && grp?.drafts === 3)}`);

// B: 分離（Aのグループは見えない）
const blB = await J(await get(B.cookie, '/api/tenant/batches'));
console.log(`3) グループのテナント分離: B件数=${blB.items?.length} => ${P((blB.items?.length ?? 0) === 0)}`);

// A: グループ内アイテム
const itemsA = await J(await get(A.cookie, '/api/tenant/batches/' + ing.batchId));
const ids = (itemsA.items || []).map((i) => i.id);
console.log(`4) グループ内アイテム取得: ${itemsA.items?.length}件 => ${P(itemsA.items?.length === 3)}`);

// A: 2件選別→Coupang出品へ（処理）
const sub = await J(await fetch(BASE + '/api/listings/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: A.cookie }, body: JSON.stringify({ ids: ids.slice(0, 2), action: 'process' }) }));
const okN = (sub.results || []).filter((r) => r.ok).length;
const bl2 = await J(await get(A.cookie, '/api/tenant/batches'));
const grp2 = (bl2.items || []).find((x) => x.id === ing.batchId);
console.log(`5) 選別2件を出品準備→進捗反映: 処理ok=${okN} 未処理=${grp2?.drafts} 出品へ=${grp2?.advanced} => ${P(okN === 2 && grp2?.drafts === 1 && grp2?.advanced === 2)}`);

// B: Aのグループ詳細を直接叩いても0件（横取り不可）
const crossB = await J(await get(B.cookie, '/api/tenant/batches/' + ing.batchId));
console.log(`6) BはAのグループ詳細を見れない: ${crossB.items?.length}件 => ${P((crossB.items?.length ?? 0) === 0)}`);

// owner 403
const ow1 = (await get(owner, '/api/tenant/batches')).status;
const ow2 = (await get(owner, '/api/tenant/batches/' + ing.batchId)).status;
console.log(`7) ownerは403: list=${ow1} detail=${ow2} => ${P(ow1 === 403 && ow2 === 403)}`);

// cleanup
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await pool.query("DELETE FROM tenants WHERE name LIKE 'テストグループ%'");
await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'");
await pool.query('DELETE FROM source_products WHERE source_product_id = ANY($1)', [[a1, a2, a3]]);
await pool.end();
console.log('cleanup done');
