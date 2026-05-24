// 禁止ワード/ブラックリスト/知財のテナント分離＋適用をE2E検証。
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
const A = await tenant(`テストリストA ${ts}`, `la+${ts}@example.com`);
const B = await tenant(`テストリストB ${ts}`, `lb+${ts}@example.com`);
const post = (cookie, url, body) => fetch(BASE + url, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(body) });
const get = (cookie, url) => fetch(BASE + url, { headers: { cookie } });

// ── 禁止ワード：分離（starter 15語に加え A だけに 1語追加）──
const ngWord = 'A専用NG' + ts;
await post(A, '/api/tenant/ng-words', { word: ngWord, mode: 'block' });
const ngA = await J(await get(A, '/api/tenant/ng-words'));
const ngB = await J(await get(B, '/api/tenant/ng-words'));
const ngAhas = (ngA.items || []).some((r) => r.word === ngWord);
const ngBhas = (ngB.items || []).some((r) => r.word === ngWord);
console.log(`1) 禁止ワード分離: A件数=${ngA.items?.length} B件数=${ngB.items?.length} Aに追加語=${ngAhas} Bに混入=${ngBhas} => ${P(ngAhas && !ngBhas)}`);

// ── 禁止ワード：処理時に適用（翻訳後タイトルから除去）──
const asinNg = 'B0' + ts.toString().slice(-8);
const lid = (await J(await post(A, '/api/listings', { source: 'amazon', channel: 'coupang', sourceProductId: asinNg }))).listing.id;
const t1 = (await J(await post(A, '/api/listings/' + lid + '/process', {}))).listing?.titleTranslated || '';
const token = (t1.split(/\s+/).find((w) => w.length >= 2)) || t1.slice(0, 3);
await post(A, '/api/tenant/ng-words', { word: token, mode: 'block' });
const t2 = (await J(await post(A, '/api/listings/' + lid + '/process', {}))).listing?.titleTranslated || '';
console.log(`2) 禁止ワード適用(除去): "${token}" t1含む=${t1.includes(token)} t2含む=${t2.includes(token)} => ${P(token.length >= 2 && t1.includes(token) && !t2.includes(token))}`);

// ── ブラックリスト：分離＋取込除外 ──
const asinBl = 'B1' + ts.toString().slice(-8);
await post(A, '/api/tenant/blacklist', { source: 'amazon', asin: asinBl, reason: 'test' });
const blAdd = await post(A, '/api/listings', { source: 'amazon', channel: 'coupang', sourceProductId: asinBl });
const blAddJson = await blAdd.json();
console.log(`3) BL該当ASINはA取込で422blocked: ${blAdd.status} status=${blAddJson.status} => ${P(blAdd.status === 422 && blAddJson.status === 'blocked')}`);
const blAddB = await post(B, '/api/listings', { source: 'amazon', channel: 'coupang', sourceProductId: asinBl });
console.log(`4) 同ASINはB(BL未登録)で取込可=分離: ${blAddB.status} => ${P(blAddB.status === 201)}`);
const blListB = await J(await get(B, '/api/tenant/blacklist'));
console.log(`5) BLリスト分離(BにAの登録は無い): B=${blListB.items?.length} => ${P((blListB.items?.length ?? 0) === 0)}`);

// ── 知財：分離＋プレビュー警告 ──
const prev1 = await J(await post(A, '/api/listings/' + lid + '/dry-run', {}));
const brand = prev1.preview?.brand;
await post(A, '/api/tenant/ip-brands', { brand, level: 'block' });
await post(B, '/api/tenant/ip-brands', { brand: 'ZZZ専用B' + ts, level: 'warn' });
const prev2 = await J(await post(A, '/api/listings/' + lid + '/dry-run', {}));
const ipHit = !!prev2.preview?.ipBrand && prev2.validation?.warnings?.some((w) => w.msg.includes('知財監視ブランド該当'));
console.log(`6) 知財プレビュー警告: brand="${brand}" ipBrand=${JSON.stringify(prev2.preview?.ipBrand)} ready=${prev2.validation?.ready} => ${P(ipHit && prev2.validation?.ready === false)}`);
const ipA = await J(await get(A, '/api/tenant/ip-brands'));
const ipB = await J(await get(B, '/api/tenant/ip-brands'));
const aHasB = (ipA.items || []).some((r) => r.brand?.startsWith('ZZZ専用B'));
const bHasOwn = (ipB.items || []).some((r) => r.brand?.startsWith('ZZZ専用B') && r.own);
console.log(`7) 知財の自社分は分離(AはBの自社分を見ない/Bは自社ownで見える): AにB混入=${aHasB} BにownでB分=${bHasOwn} => ${P(!aHasB && bHasOwn)}`);

// ── owner 403 ──
const o1 = (await get(owner, '/api/tenant/ng-words')).status;
const o2 = (await get(owner, '/api/tenant/blacklist')).status;
const o3 = (await get(owner, '/api/tenant/ip-brands')).status;
console.log(`8) ownerは全リスト403: ${o1}/${o2}/${o3} => ${P(o1 === 403 && o2 === 403 && o3 === 403)}`);

// cleanup
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await pool.query("DELETE FROM tenants WHERE name LIKE 'テストリスト%'");
await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'");
await pool.query('DELETE FROM source_products WHERE source_product_id = ANY($1)', [[asinNg, asinBl]]);
await pool.end();
console.log('cleanup done');
