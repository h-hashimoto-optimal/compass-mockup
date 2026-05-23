// 招待フローのE2E検証（秘密は出力しない）。
import fs from 'node:fs';
import path from 'node:path';

function loadEnvLocal() {
  const p = path.join(process.cwd(), '.env.local');
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadEnvLocal();

const BASE = 'http://localhost:3000';
const ownerEmail = (process.env.OWNER_EMAIL || 'hirohohashimoto@gmail.com').trim().toLowerCase();
const ownerPw = process.env.OWNER_INITIAL_PASSWORD;
const ts = Date.now();
const tenantEmail = `kameiten+${ts}@example.com`;
const tenantPw = 'tenant-pass-' + ts;

const cookieOf = (res) => ((res.headers.get('set-cookie') || '').match(/compass_session=[^;]+/) || [''])[0];

async function signin(email, password) {
  const res = await fetch(BASE + '/api/auth/signin', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, next: '/' }), redirect: 'manual',
  });
  return { status: res.status, cookie: cookieOf(res), json: await res.json().catch(() => ({})) };
}
const P = (b) => (b ? 'PASS' : 'FAIL');

// 0) 未認証で onboard → 403
const noAuth = await fetch(BASE + '/api/admin/onboard', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tenantName: 'X', email: 'x@x.com' }), redirect: 'manual',
});
console.log(`0) 未認証onboard拒否: status=${noAuth.status} => ${P(noAuth.status === 403 || noAuth.status === 307)}`);

// 1) 本部ログイン
const owner = await signin(ownerEmail, ownerPw);
console.log(`1) 本部ログイン: ${owner.status} cookie=${!!owner.cookie} => ${P(owner.json.ok && owner.cookie)}`);

// 2) 招待発行
const onboardRes = await fetch(BASE + '/api/admin/onboard', {
  method: 'POST', headers: { 'Content-Type': 'application/json', cookie: owner.cookie },
  body: JSON.stringify({ tenantName: `テスト加盟店 ${ts}`, email: tenantEmail, fullName: '加盟 太郎' }),
});
const onboardJson = await onboardRes.json().catch(() => ({}));
const token = (onboardJson.inviteUrl || '').split('/invite/')[1] || '';
console.log(`2) 招待発行: ${onboardRes.status} inviteUrl=${onboardJson.inviteUrl ? 'あり' : 'なし'} => ${P(onboardRes.status === 201 && token)}`);

// 3) 招待ページが有効表示
const invPage = await fetch(BASE + '/invite/' + token);
const invHtml = await invPage.text();
console.log(`3) 招待ページ: ${invPage.status} 無効表示=${invHtml.includes('無効です')} => ${P(invPage.status === 200 && !invHtml.includes('無効です'))}`);

// 4) 受諾（PW設定＝そのままログイン）
const accept = await fetch(BASE + '/api/auth/accept-invite', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token, password: tenantPw }), redirect: 'manual',
});
const acceptJson = await accept.json().catch(() => ({}));
const tenantCookie = cookieOf(accept);
console.log(`4) 招待受諾: ${accept.status} cookie=${!!tenantCookie} => ${P(acceptJson.ok && tenantCookie)}`);

// 5) 同じトークンは再利用不可
const reuse = await fetch(BASE + '/api/auth/accept-invite', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token, password: tenantPw }), redirect: 'manual',
});
console.log(`5) トークン再利用拒否: ${reuse.status} => ${P(reuse.status === 400)}`);

// 6) 加盟者で / は見れる
const tHome = await fetch(BASE + '/', { redirect: 'manual', headers: { cookie: tenantCookie } });
console.log(`6) 加盟者で / : ${tHome.status} => ${P(tHome.status === 200)}`);

// 7) 加盟者は /admin/tenants 不可（owner専用→/へ）
const tAdmin = await fetch(BASE + '/admin/tenants', { redirect: 'manual', headers: { cookie: tenantCookie } });
const loc = tAdmin.headers.get('location') || '';
console.log(`7) 加盟者の本部画面ガード: ${tAdmin.status} loc=${loc} => ${P(tAdmin.status >= 300 && tAdmin.status < 400 && !loc.includes('/admin'))}`);

// 8) 加盟者が改めてログインできる
const tLogin = await signin(tenantEmail, tenantPw);
console.log(`8) 加盟者ログイン: ${tLogin.status} => ${P(tLogin.json.ok === true)}`);
