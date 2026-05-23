import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, invitations } from '@/lib/db/schema';
import { hashToken, hashPassword, createSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 招待トークン＋パスワードでアカウントを有効化し、そのままログイン状態にする
export async function POST(req: Request) {
  const { token, password } = (await req.json().catch(() => ({}))) as {
    token?: string;
    password?: string;
  };
  if (!token || !password) {
    return NextResponse.json({ error: 'トークンとパスワードが必要です' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'パスワードは8文字以上にしてください' }, { status: 400 });
  }

  const [inv] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.tokenHash, hashToken(token)))
    .limit(1);

  if (!inv) return NextResponse.json({ error: '招待が見つかりません' }, { status: 400 });
  if (inv.acceptedAt) return NextResponse.json({ error: 'この招待は使用済みです' }, { status: 400 });
  if (new Date(inv.expiresAt) < new Date()) {
    return NextResponse.json({ error: '招待の有効期限が切れています' }, { status: 400 });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, inv.email), eq(users.tenantId, inv.tenantId)))
    .limit(1);
  if (!user) return NextResponse.json({ error: '対象ユーザーが見つかりません' }, { status: 400 });

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password), status: 'active' })
    .where(eq(users.id, user.id));
  await db.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, inv.id));

  await createSession(user.id);
  return NextResponse.json({ ok: true, redirect: '/' });
}
