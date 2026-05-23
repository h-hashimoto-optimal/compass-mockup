// ログイン動作の実機検証（パスワード/トークンは出力しない）。
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
const email = (process.env.OWNER_EMAIL || 'hirohohashimoto@gmail.com').trim().toLowerCase();
const password = process.env.OWNER_INITIAL_PASSWORD;

async function signin(pw) {
  const res = await fetch(BASE + '/api/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pw, next: '/' }),
    redirect: 'manual',
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: json.ok === true, hasCookie: /compass_session=/.test(setCookie), setCookie };
}

// 1) 正しいPWでログイン
const good = await signin(password);
console.log(`1) 正PWログイン: status=${good.status} ok=${good.ok} cookie発行=${good.hasCookie} => ${good.ok && good.hasCookie ? 'PASS' : 'FAIL'}`);

// 2) 誤PWは弾く
const bad = await signin('wrong-password-xxxxx');
console.log(`2) 誤PW拒否: status=${bad.status} => ${bad.status === 401 ? 'PASS' : 'FAIL'}`);

// 3) Cookieあり/なしで保護ページの挙動
const cookie = (good.setCookie.match(/compass_session=[^;]+/) || [''])[0];
const noCookie = await fetch(BASE + '/', { redirect: 'manual' });
const withCookie = await fetch(BASE + '/', { redirect: 'manual', headers: { cookie } });
const noLoc = noCookie.headers.get('location') || '';
console.log(`3a) 未ログインで / → status=${noCookie.status} location=${noLoc.includes('/login') ? '/login(リダイレクト)' : noLoc} => ${noCookie.status >= 300 && noCookie.status < 400 && noLoc.includes('/login') ? 'PASS' : 'FAIL'}`);
console.log(`3b) ログイン済で / → status=${withCookie.status} => ${withCookie.status === 200 ? 'PASS' : 'FAIL'}`);
