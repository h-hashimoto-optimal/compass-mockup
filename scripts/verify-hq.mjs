// 本部の最小操作のE2E検証（停止/再開・招待再送/取消・権限）。秘密は出さない。
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

function loadEnv() {
  for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadEnv();

const BASE = 'http://localhost:3000';
const ownerEmail = (process.env.OWNER_EMAIL || 'hirohohashimoto@gmail.com').trim().toLowerCase();
const ownerPw = process.env.OWNER_INITIAL_PASSWORD;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const P = (b) => (b ? 'PASS' : 'FAIL');
const cookieOf = (r) => ((r.headers.get('set-cookie') || '').match(/compass_session=[^;]+/) || [''])[0];

async function signin(email, password) {
  const r = await fetch(BASE + '/api/auth/signin', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }), redirect: 'manual',
  });
  return { status: r.status, cookie: cookieOf(r), json: await r.json().catch(() => ({})) };
}
async function onboard(cookie, name, email) {
  const r = await fetch(BASE + '/api/admin/onboard', {
    method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ tenantName: name, email }),
  });
  return r.json();
}
async function accept(token, password) {
  const r = await fetch(BASE + '/api/auth/accept-invite', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }), redirect: 'manual',
  });
  return { status: r.status, cookie: cookieOf(r), json: await r.json().catch(() => ({})) };
}
const tokenFrom = (j) => (j.inviteUrl || '').split('/invite/')[1] || '';
const tenantId = async (name) => (await pool.query('SELECT id FROM tenants WHERE name=$1', [name])).rows[0]?.id;
const inviteId = async (email) => (await pool.query("SELECT id FROM invitations WHERE email=$1 AND accepted_at IS NULL ORDER BY created_at DESC LIMIT 1", [email])).rows[0]?.id;

const owner = await signin(ownerEmail, ownerPw);
const ts = Date.now();

// ── A. 停止 → ログイン遮断 → 再開 → 復帰 ──
{
  const name = `停止テスト ${ts}`, email = `susp+${ts}@example.com`, pw = 'pw-' + ts + '-aaaa';
  const t = tokenFrom(await onboard(owner.cookie, name, email));
  const acc = await accept(t, pw);
  const id = await tenantId(name);
  const suspend = await fetch(`${BASE}/api/admin/tenants/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', cookie: owner.cookie }, body: JSON.stringify({ status: 'suspended' }) });
  const loginWhileSusp = await signin(email, pw);
  const sessionWhileSusp = await fetch(BASE + '/', { redirect: 'manual', headers: { cookie: acc.cookie } });
  const resume = await fetch(`${BASE}/api/admin/tenants/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', cookie: owner.cookie }, body: JSON.stringify({ status: 'active' }) });
  const loginAfterResume = await signin(email, pw);
  console.log(`A1 受諾ログイン: ${P(acc.json.ok)}`);
  console.log(`A2 停止API: ${suspend.status} ${P(suspend.status === 200)}`);
  console.log(`A3 停止中はログイン不可: ${loginWhileSusp.status} ${P(loginWhileSusp.status === 401)}`);
  console.log(`A4 停止中は既存セッションも遮断(/→login): ${sessionWhileSusp.status} ${P(sessionWhileSusp.status >= 300 && sessionWhileSusp.status < 400)}`);
  console.log(`A5 再開API: ${resume.status} ${P(resume.status === 200)}`);
  console.log(`A6 再開後ログイン可: ${loginAfterResume.status} ${P(loginAfterResume.json.ok === true)}`);
}

// ── B. 招待 再送（旧トークン失効・新トークン有効）──
{
  const name = `再送テスト ${ts}`, email = `resend+${ts}@example.com`, pw = 'pw-' + ts + '-bbbb';
  const oldTok = tokenFrom(await onboard(owner.cookie, name, email));
  const id = await inviteId(email);
  const re = await fetch(`${BASE}/api/admin/invitations/${id}`, { method: 'POST', headers: { cookie: owner.cookie } });
  const reJson = await re.json();
  const newTok = tokenFrom(reJson);
  const oldAccept = await accept(oldTok, pw);
  const newAccept = await accept(newTok, pw);
  console.log(`B1 再送API: ${re.status} ${P(re.status === 200 && newTok)}`);
  console.log(`B2 旧トークン失効: ${oldAccept.status} ${P(oldAccept.status === 400)}`);
  console.log(`B3 新トークン有効: ${newAccept.status} ${P(newAccept.json.ok === true)}`);
}

// ── C. 招待 取消（トークン無効化）──
{
  const name = `取消テスト ${ts}`, email = `revoke+${ts}@example.com`, pw = 'pw-' + ts + '-cccc';
  const tok = tokenFrom(await onboard(owner.cookie, name, email));
  const id = await inviteId(email);
  const del = await fetch(`${BASE}/api/admin/invitations/${id}`, { method: 'DELETE', headers: { cookie: owner.cookie } });
  const acceptAfter = await accept(tok, pw);
  console.log(`C1 取消API: ${del.status} ${P(del.status === 200)}`);
  console.log(`C2 取消後トークン無効: ${acceptAfter.status} ${P(acceptAfter.status === 400)}`);
}

// ── D. 権限（非owner/未認証は操作不可）──
{
  const anyTenant = (await pool.query('SELECT id FROM tenants LIMIT 1')).rows[0]?.id;
  const noAuth = await fetch(`${BASE}/api/admin/tenants/${anyTenant}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'suspended' }) });
  console.log(`D1 未認証で停止API拒否: ${noAuth.status} ${P(noAuth.status === 403)}`);
}

await pool.end();
