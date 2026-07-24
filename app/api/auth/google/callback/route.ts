import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, invitations } from '@/lib/db/schema';
import { createSession } from '@/lib/auth';
import { exchangeCodeForIdToken, decodeIdToken, GOOGLE_CALLBACK_PATH } from '@/lib/google-oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fail(origin: string, reason: string) {
  return NextResponse.redirect(new URL(`/login?error=${reason}`, origin));
}

export async function GET(req: Request) {
  const reqUrl = new URL(req.url);
  const origin = reqUrl.origin;
  const code = reqUrl.searchParams.get('code');
  const state = reqUrl.searchParams.get('state');

  const jar = await cookies();
  const raw = jar.get('g_oauth')?.value;
  jar.delete('g_oauth');
  if (!code || !state || !raw) return fail(origin, 'oauth');

  let saved: { state: string; next: string };
  try {
    saved = JSON.parse(raw);
  } catch {
    return fail(origin, 'oauth');
  }
  if (saved.state !== state) return fail(origin, 'state');

  const redirectUri = new URL(GOOGLE_CALLBACK_PATH, origin).toString();
  let identity;
  try {
    const idToken = await exchangeCodeForIdToken(code, redirectUri);
    identity = decodeIdToken(idToken);
  } catch {
    return fail(origin, 'google');
  }
  if (!identity.emailVerified) return fail(origin, 'unverified');

  // 招待制：メール一致する既存ユーザーがいる場合のみログイン許可（公開登録なし）
  const [user] = await db.select().from(users).where(eq(users.email, identity.email)).limit(1);
  if (!user) return fail(origin, 'not_invited');
  if (user.googleSub && user.googleSub !== identity.sub) return fail(origin, 'account_mismatch');

  await db
    .update(users)
    .set({ googleSub: identity.sub, status: 'active', lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  // 未受諾の招待があれば受諾済みにする（加盟者の初回ログイン）
  if (user.tenantId) {
    await db
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(
        and(
          eq(invitations.email, identity.email),
          eq(invitations.tenantId, user.tenantId),
          isNull(invitations.acceptedAt),
        ),
      );
  }

  await createSession(user.id);
  const next = saved.next && saved.next.startsWith('/') ? saved.next : '/';
  return NextResponse.redirect(new URL(next, origin));
}
