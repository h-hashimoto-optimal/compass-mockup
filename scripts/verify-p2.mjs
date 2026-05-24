// P2の最初の核（テナントscoping＋仕入商品永続化）のE2E検証。秘密は出さない。
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

function loadEnv() {
  for (const l of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadEnv();
const BASE = 'http://localhost:3000';
const ownerEmail = (process.env.OWNER_EMAIL || 'hirohohashimoto@gmail.com').trim().toLowerCase();
const ownerPw = process.env.OWNER_INITIAL_PASSWORD;
const ts = Date.now();
const P = (b) => (b ? 'PASS' : 'FAIL');
const cookieOf = (r) => ((r.headers.get('set-cookie') || '').match(/compass_session=[^;]+/) || [''])[0];

async function signin(email, password) {
  const r = await fetch(BASE + '/api/auth/signin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), redirect: 'manual' });
  return cookieOf(r);
}
async function onboardAndAccept(ownerCookie, name, email) {
  const r = await fetch(BASE + '/api/admin/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: ownerCookie }, body: JSON.stringify({ tenantName: name, email }) });
  const token = ((await r.json()).inviteUrl || '').split('/invite/')[1];
  const a = await fetch(BASE + '/api/auth/accept-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: 'pw-' + ts + '-' + name }), redirect: 'manual' });
  return cookieOf(a);
}
async function postListing(cookie, b) {
  const r = await fetch(BASE + '/api/listings', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(b) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}
async function getListings(cookie) {
  const r = await fetch(BASE + '/api/listings', { headers: cookie ? { cookie } : {} });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}

const owner = await signin(ownerEmail, ownerPw);
const A = await onboardAndAccept(owner, `テスト加盟店A ${ts}`, `a+${ts}@example.com`);
const B = await onboardAndAccept(owner, `テスト加盟店B ${ts}`, `b+${ts}@example.com`);

const asin = 'B0' + ts.toString().slice(-8);
const c1 = await postListing(A, { source: 'amazon', sourceProductId: asin, channel: 'coupang', titleJa: 'テスト商品', priceJpy: 1980 });
console.log(`1) A:取込(新規): ${c1.status} status=${c1.json.status} => ${P(c1.status === 201 && c1.json.status === 'created')}`);

const c2 = await postListing(A, { source: 'amazon', sourceProductId: asin, channel: 'coupang' });
console.log(`2) A:同一再取込(冪等): ${c2.status} status=${c2.json.status} => ${P(c2.status === 200 && c2.json.status === 'exists')}`);

const la = await getListings(A);
console.log(`3) A:一覧=1件: ${la.json.listings?.length} => ${P(la.json.listings?.length === 1)}`);

const lb = await getListings(B);
console.log(`4) B:一覧=0件(テナント分離): ${lb.json.listings?.length} => ${P(lb.json.listings?.length === 0)}`);

const lo = await getListings(owner);
console.log(`5) owner:テナント文脈なし→403: ${lo.status} => ${P(lo.status === 403)}`);

const bad = await postListing(A, { source: 'invalid', sourceProductId: 'x', channel: 'coupang' });
console.log(`6) 不正source拒否: ${bad.status} => ${P(bad.status === 400)}`);

// 別チャネル(naver)に同一仕入商品を出品できる
const cn = await postListing(A, { source: 'amazon', sourceProductId: asin, channel: 'naver' });
console.log(`7) A:同一仕入をnaverにも出品(多チャネル): ${cn.status} status=${cn.json.status} => ${P(cn.status === 201)}`);

// 8) パイプライン処理（mock）：翻訳・価格・floor を埋める
const lid = c1.json.listing.id;
const pr = await fetch(BASE + '/api/listings/' + lid + '/process', { method: 'POST', headers: { cookie: A } });
const pj = await pr.json().catch(() => ({}));
const lst = pj.listing || {};
console.log(`8) 処理(翻訳/価格/floor): ${pr.status} 翻訳=${!!lst.titleTranslated} 売価=${lst.listPrice} floor円=${lst.floorPriceJpy} => ${P(pr.status === 200 && !!lst.titleTranslated && lst.listPrice > 0 && lst.floorPriceJpy > 0)}`);

// 9) 出品プレビュー＋Coupang dry-run
const dr = await fetch(BASE + '/api/listings/' + lid + '/dry-run', { method: 'POST', headers: { cookie: A } });
const dj = await dr.json().catch(() => ({}));
const okDry = dr.status === 200 && dj.mode === 'dry-run' && !!dj.payload?.displayProductName && Array.isArray(dj.validation?.warnings) && (dj.preview?.images?.length ?? 0) > 0;
console.log(`9) プレビュー+dry-run: ${dr.status} mode=${dj.mode} payload=${!!dj.payload?.displayProductName} 警告=${dj.validation?.warnings?.length} ready=${dj.validation?.ready} 画像=${dj.preview?.images?.length} => ${P(okDry)}`);

// 10) 個別編集
const ed = await fetch(BASE + '/api/listings/' + lid, { method: 'PATCH', headers: { 'Content-Type': 'application/json', cookie: A }, body: JSON.stringify({ titleTranslated: '手動編集テスト', listPrice: 99999 }) });
const ej = await ed.json().catch(() => ({}));
console.log(`10) 個別編集: ${ed.status} 反映=${ej.listing?.titleTranslated === '手動編集テスト' && ej.listing?.listPrice === 99999} => ${P(ed.status === 200 && ej.listing?.titleTranslated === '手動編集テスト' && ej.listing?.listPrice === 99999)}`);

// 11) 単一送信（creds無し→dry-run）
const sb = await fetch(BASE + '/api/listings/' + lid + '/submit', { method: 'POST', headers: { cookie: A } });
const sj = await sb.json().catch(() => ({}));
console.log(`11) 単一送信(dry-run): ${sb.status} mode=${sj.mode} => ${P(sb.status === 200 && sj.mode === 'dry-run')}`);

// 12) 論理削除→一覧から消える＋削除後に同一仕入を再出品できる(部分ユニーク)
const dl = await fetch(BASE + '/api/listings/' + lid, { method: 'DELETE', headers: { cookie: A } });
const afterDel = await getListings(A);
const reAdd = await postListing(A, { source: 'amazon', sourceProductId: asin, channel: 'coupang' });
console.log(`12) 論理削除→残り${afterDel.json.listings?.length}件(naver) / 同一coupang再出品=${reAdd.json.status} => ${P(dl.status === 200 && afterDel.json.listings?.length === 1 && reAdd.status === 201)}`);

// cleanup
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const del = await pool.query("DELETE FROM tenants WHERE name LIKE 'テスト加盟店%' RETURNING name");
await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'");
await pool.query("DELETE FROM source_products WHERE source_product_id = $1", [asin]);
console.log(`cleanup: テナント${del.rowCount}件＋source削除`);
await pool.end();
