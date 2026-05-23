import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// セッションCookieはEdgeでは“有無”だけ判定（DB照合はサーバ側 getSession で行う）。
// owner専用ガード（/admin）は /admin のサーバコンポーネントで role 判定する。
const COOKIE_NAME = 'compass_session';
const PUBLIC = ['/login', '/invite', '/api/auth'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.next();
  if (pathname.startsWith('/_next')) return NextResponse.next();
  if (pathname === '/favicon.ico') return NextResponse.next();

  const hasSession = !!req.cookies.get(COOKIE_NAME)?.value;
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
