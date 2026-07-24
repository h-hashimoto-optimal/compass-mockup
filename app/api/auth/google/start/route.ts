import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateToken } from '@/lib/auth';
import { googleAuthUrl, GOOGLE_CALLBACK_PATH } from '@/lib/google-oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 「Googleでログイン」→ state を Cookie に保存して Google の同意画面へリダイレクト
export async function GET(req: Request) {
  const reqUrl = new URL(req.url);
  const next = reqUrl.searchParams.get('next') || '/';
  const state = generateToken();
  const redirectUri = new URL(GOOGLE_CALLBACK_PATH, reqUrl.origin).toString();

  (await cookies()).set('g_oauth', JSON.stringify({ state, next }), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
    secure: process.env.NODE_ENV === 'production',
  });

  return NextResponse.redirect(googleAuthUrl(redirectUri, state));
}
