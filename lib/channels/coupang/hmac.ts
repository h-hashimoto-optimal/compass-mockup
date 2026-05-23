// Coupang Wing OpenAPI HMAC-SHA256 署名生成
// 仕様: https://developers.coupangcorp.com/hc/en-us/articles/360033461914-Creating-HMAC-Signature
//
// Authorization ヘッダ形式:
//   CEA algorithm=HmacSHA256, access-key={ACCESS_KEY}, signed-date={YYMMDDTHHMMSSZ}, signature={HMAC_HEX}
// 署名対象メッセージ:
//   {signed-date}{HTTP_METHOD}{path-without-query}{query-string-without-?}
// 署名:
//   HMAC-SHA256(secretKey, message) → hex(lowercase)

import crypto from 'node:crypto';

export type CoupangCredentials = {
  vendorId: string;
  accessKey: string;
  secretKey: string;
};

export type CoupangSignedRequest = {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers: Record<string, string>;
  body?: string;
  // デバッグ/プレビュー用に内訳も返す
  debug: {
    signedDate: string;
    message: string;
    signature: string;
    path: string;
    query: string;
  };
};

const BASE_URL = 'https://api-gateway.coupang.com';

/**
 * 現在時刻を YYMMDDTHHMMSSZ 形式（UTC）で返す。
 */
export function formatSignedDate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yy = pad(d.getUTCFullYear() % 100);
  const mm = pad(d.getUTCMonth() + 1);
  const dd = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mi = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${yy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

/**
 * Coupang仕様に従って署名済みリクエストを生成する。
 * 実際のHTTP送信はこの関数の外で fetch() などで行う。
 */
export function signRequest(params: {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  pathWithQuery: string; // 例: '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products?vendorId=A001'
  body?: object | string;
  credentials: CoupangCredentials;
  signedDate?: string; // テスト時に固定するためオプション
}): CoupangSignedRequest {
  const { method, pathWithQuery, body, credentials } = params;
  const signedDate = params.signedDate ?? formatSignedDate();

  const [path, query = ''] = pathWithQuery.split('?');

  const message = `${signedDate}${method}${path}${query}`;
  const signature = crypto
    .createHmac('sha256', credentials.secretKey)
    .update(message)
    .digest('hex');

  const auth =
    `CEA algorithm=HmacSHA256, ` +
    `access-key=${credentials.accessKey}, ` +
    `signed-date=${signedDate}, ` +
    `signature=${signature}`;

  const headers: Record<string, string> = {
    Authorization: auth,
    'X-Requested-By': credentials.vendorId,
    'Content-Type': 'application/json;charset=UTF-8',
  };

  const bodyString =
    body == null ? undefined : typeof body === 'string' ? body : JSON.stringify(body);

  return {
    url: `${BASE_URL}${pathWithQuery}`,
    method,
    headers,
    body: bodyString,
    debug: {
      signedDate,
      message,
      signature,
      path,
      query,
    },
  };
}

/**
 * 署名済みリクエストを cURL コマンド文字列に変換（手元検証用）。
 */
export function toCurl(req: CoupangSignedRequest): string {
  const headerArgs = Object.entries(req.headers)
    .map(([k, v]) => `  -H "${k}: ${v}"`)
    .join(' \\\n');
  const dataArg = req.body
    ? ` \\\n  --data-raw '${req.body.replace(/'/g, "'\\''")}'`
    : '';
  return `curl -X ${req.method} "${req.url}" \\\n${headerArgs}${dataArg}`;
}
