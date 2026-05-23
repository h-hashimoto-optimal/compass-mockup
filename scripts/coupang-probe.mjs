// Coupang GATE probe — 実Global Marketplaceキーで「どのAPIが取得できるか」を非破壊GETで検証する。
//
// 使い方:
//   1) compass-mockup 直下に .env.local を作り、実キーを入れる（チャットには貼らない）:
//        COUPANG_VENDOR_ID=A0xxxxxx
//        COUPANG_ACCESS_KEY=xxxxxxxx
//        COUPANG_SECRET_KEY=xxxxxxxx
//   2) cd compass-mockup && node scripts/coupang-probe.mjs
//
// 署名は lib/channels/coupang/hmac.ts と同じ CEA-HMAC-SHA256。
// このスクリプトは GET のみ。出品(作成)など破壊的操作は一切しない。
// シークレット(Access/Secret)とAuthorizationヘッダは出力しない。

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://api-gateway.coupang.com';

// --- .env.local を読む（依存なしの簡易パーサ） ---
function loadEnvLocal() {
  const p = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
loadEnvLocal();

const VENDOR_ID = process.env.COUPANG_VENDOR_ID;
const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY;
const SECRET_KEY = process.env.COUPANG_SECRET_KEY;

if (!VENDOR_ID || !ACCESS_KEY || !SECRET_KEY) {
  console.error(
    '✗ .env.local に COUPANG_VENDOR_ID / COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY を設定してください（チャットには貼らないこと）。',
  );
  process.exit(1);
}

function signedDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${p(d.getUTCFullYear() % 100)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

function authHeader(method, pathWithQuery) {
  const [pth, query = ''] = pathWithQuery.split('?');
  const sd = signedDate();
  const message = `${sd}${method}${pth}${query}`;
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(message).digest('hex');
  return `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${sd}, signature=${signature}`;
}

function verdictFor(status) {
  if (status === 200) return '✅ 取得OK';
  if (status === 400) return '⚠️ 400（パラメータ形式の可能性。権限とは別問題かも）';
  if (status === 401) return '🔑 401（認証NG：キー誤り/署名/PCの時刻ズレを疑う）';
  if (status === 403) return '⛔ 403（権限なし＝Globalセラーでは不可の疑い）';
  if (status === 404) return '❓ 404（このセラータイプに非提供の可能性）';
  return `⚠️ ${status}`;
}

// 成功時は顧客/売上の中身(PII)を出さず、形と件数だけ要約する。
function summarizeOk(text) {
  try {
    const j = JSON.parse(text);
    if (j && Array.isArray(j.data)) return `OK（PII非表示）data=${j.data.length}件`;
    if (Array.isArray(j)) return `OK（PII非表示）${j.length}件`;
    const keys = j && typeof j === 'object' ? Object.keys(j) : [];
    return `OK（PII非表示）topKeys=[${keys.join(',')}]`;
  } catch {
    return 'OK（本文はJSON以外・非表示）';
  }
}

async function probe(name, method, pathWithQuery) {
  const url = BASE + pathWithQuery;
  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: authHeader(method, pathWithQuery),
        'X-Requested-By': VENDOR_ID,
        'Content-Type': 'application/json;charset=UTF-8',
      },
    });
    const text = await res.text();
    // 200=データ本文(PII可能性)は出さず要約 / 非200=エラーメッセージ(PIIでない)を表示
    const detail =
      res.status === 200
        ? summarizeOk(text)
        : `body: ${text.slice(0, 300).replace(/\s+/g, ' ')}`;
    console.log(`\n[${name}] ${method} ${pathWithQuery.split('?')[0]}`);
    console.log(`  status=${res.status} → ${verdictFor(res.status)}`);
    console.log(`  ${detail}`);
  } catch (e) {
    console.log(`\n[${name}] ERROR ${e.message}`);
  }
}

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() - n);
  return iso(d);
};
const prevMonth = () => {
  const d = new Date(today);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
};

const V = encodeURIComponent(VENDOR_ID);

const tests = [
  [
    '出品一覧(Product list)',
    'GET',
    `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products?vendorId=${V}&maxPerPage=1`,
  ],
  [
    '売上明細(revenue-history)',
    'GET',
    `/v2/providers/openapi/apis/api/v1/revenue-history?vendorId=${V}&recognitionDateFrom=${daysAgo(30)}&recognitionDateTo=${iso(today)}&maxPerPage=1`,
  ],
  [
    '精算(settlement-histories)',
    'GET',
    `/v2/providers/marketplace_openapi/apis/api/v1/settlement-histories?revenueRecognitionYearMonth=${prevMonth()}`,
  ],
  [
    '注文(ordersheets)',
    'GET',
    `/v2/providers/openapi/apis/api/v5/vendors/${V}/ordersheets?createdAtFrom=${daysAgo(7)}&createdAtTo=${iso(today)}&status=ACCEPT&maxPerPage=1`,
  ],
  [
    'CS(callCenterInquiries)',
    'GET',
    `/v2/providers/openapi/apis/api/v5/vendors/${V}/callCenterInquiries?inquiryStartAt=${daysAgo(7)}&inquiryEndAt=${iso(today)}&partnerCounselingStatus=NO_ANSWER&pageSize=1&pageNum=1`,
  ],
];

console.log(`Coupang GATE probe — vendor=${VENDOR_ID.slice(0, 3)}*** / GETのみ・非破壊`);
for (const t of tests) {
  // 直列実行（レート制限と読みやすさのため）
  // eslint-disable-next-line no-await-in-loop
  await probe(...t);
}
console.log(
  '\n--- 判定 ---\n200=取得可 / 401=認証見直し / 403=権限なし(Globalセラー不可の疑い) / 404=非提供 / 400=パラメータ形式',
);
