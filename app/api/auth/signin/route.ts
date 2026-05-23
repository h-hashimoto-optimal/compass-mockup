import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, tenants } from '@/lib/db/schema';
import { verifyPassword, createSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { email, password, next } = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    next?: string;
  };
  if (!email || !password) {
    return NextResponse.json({ error: 'メールアドレスとパスワードを入力してください' }, { status: 400 });
  }

  const rows = await db
    .select({
      id: users.id,
      status: users.status,
      passwordHash: users.passwordHash,
      tenantStatus: tenants.status,
    })
    .from(users)
    .leftJoin(tenants, eq(users.tenantId, tenants.id))
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  const user = rows[0];

  // メール不一致・PW未設定(招待未受諾)・停止中・加盟店停止中・PW不一致は同じメッセージ（情報を漏らさない）
  const ok =
    !!user &&
    user.status === 'active' &&
    user.tenantStatus !== 'suspended' &&
    !!user.passwordHash &&
    (await verifyPassword(password, user.passwordHash));
  if (!ok) {
    return NextResponse.json({ error: 'メールアドレスまたはパスワードが違います' }, { status: 401 });
  }

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await createSession(user.id);
  return NextResponse.json({ ok: true, redirect: next || '/' });
}
