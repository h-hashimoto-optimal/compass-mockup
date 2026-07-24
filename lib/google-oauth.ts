// Google OAuth 2.0（自前実装）。scope=openid/email/profile を取得し、id_token から sub/email を得る。
// セッションは既存の sessions テーブル＋Cookie（lib/auth.ts）を再利用する（作り直し最小化）。
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

export const GOOGLE_CALLBACK_PATH = '/api/auth/google/callback';

function clientId(): string {
  const v = process.env.GOOGLE_CLIENT_ID;
  if (!v) throw new Error('GOOGLE_CLIENT_ID 未設定');
  return v;
}
function clientSecret(): string {
  const v = process.env.GOOGLE_CLIENT_SECRET;
  if (!v) throw new Error('GOOGLE_CLIENT_SECRET 未設定');
  return v;
}

export function googleAuthUrl(redirectUri: string, state: string): string {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set('client_id', clientId());
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

export async function exchangeCodeForIdToken(code: string, redirectUri: string): Promise<string> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
  const json = (await res.json()) as { id_token?: string };
  if (!json.id_token) throw new Error('id_token がありません');
  return json.id_token;
}

export type GoogleIdentity = { sub: string; email: string; emailVerified: boolean };

// id_token は Google のトークンエンドポイントからサーバ間TLSで直接取得しているため、
// ペイロードのデコードのみで信頼できる（署名検証ライブラリは持ち込まない＝依存を増やさない）。
export function decodeIdToken(idToken: string): GoogleIdentity {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('不正なid_token');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
  };
  if (!payload.sub || !payload.email) throw new Error('id_token に sub/email がありません');
  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: payload.email_verified === true || payload.email_verified === 'true',
  };
}
