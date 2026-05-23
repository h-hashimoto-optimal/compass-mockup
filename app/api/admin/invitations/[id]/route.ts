import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { invitations, users } from '@/lib/db/schema';
import { getSession, generateToken, hashToken } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireOwner() {
  const session = await getSession();
  return session?.role === 'owner';
}

// 招待の再送（リンク再発行：新トークン＋期限7日）。本部のみ。
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireOwner())) {
    return NextResponse.json({ error: '権限がありません（本部のみ）' }, { status: 403 });
  }
  const [inv] = await db.select().from(invitations).where(eq(invitations.id, params.id)).limit(1);
  if (!inv) return NextResponse.json({ error: '招待が見つかりません' }, { status: 404 });
  if (inv.acceptedAt) return NextResponse.json({ error: '受諾済みの招待です' }, { status: 400 });

  const rawToken = generateToken();
  await db
    .update(invitations)
    .set({ tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) })
    .where(eq(invitations.id, inv.id));

  const inviteUrl = `${new URL(req.url).origin}/invite/${rawToken}`;
  return NextResponse.json({ ok: true, inviteUrl });
}

// 招待の取消（招待と、未受諾の招待ユーザーを削除）。本部のみ。
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!(await requireOwner())) {
    return NextResponse.json({ error: '権限がありません（本部のみ）' }, { status: 403 });
  }
  const [inv] = await db.select().from(invitations).where(eq(invitations.id, params.id)).limit(1);
  if (!inv) return NextResponse.json({ error: '招待が見つかりません' }, { status: 404 });
  if (inv.acceptedAt) return NextResponse.json({ error: '受諾済みは取消できません' }, { status: 400 });

  // 未受諾(招待中)のユーザーのみ削除（既にactive化していれば残す）
  await db
    .delete(users)
    .where(and(eq(users.email, inv.email), eq(users.tenantId, inv.tenantId), eq(users.status, 'invited')));
  await db.delete(invitations).where(eq(invitations.id, inv.id));
  return NextResponse.json({ ok: true });
}
