import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  tenants,
  users,
  invitations,
  tenantSettings,
  tenantChannelSettings,
  ngWords,
} from '@/lib/db/schema';
import { getSession, generateToken, hashToken } from '@/lib/auth';
import { STARTER_NG_WORDS } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function slugify(s: string): string {
  const base = (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return (base || 'tenant') + '-' + randomBytes(2).toString('hex');
}

// 本部が「加盟店＋招待」を作成。招待URLを返す（メール自動送信は後フェーズ）。
export async function POST(req: Request) {
  const session = await getSession();
  if (session?.role !== 'owner') {
    return NextResponse.json({ error: '権限がありません（本部のみ）' }, { status: 403 });
  }

  const { tenantName, email, fullName, role } = (await req.json().catch(() => ({}))) as {
    tenantName?: string;
    email?: string;
    fullName?: string;
    role?: string;
  };
  if (!tenantName?.trim() || !email?.trim()) {
    return NextResponse.json({ error: '加盟店名とメールアドレスは必須です' }, { status: 400 });
  }
  const emailNorm = email.trim().toLowerCase();
  const inviteRole =
    role === 'member' || role === 'operator' ? role : 'tenant_admin';

  const dup = await db.select({ id: users.id }).from(users).where(eq(users.email, emailNorm)).limit(1);
  if (dup.length) {
    return NextResponse.json({ error: 'このメールアドレスは既に登録されています' }, { status: 409 });
  }

  const owner = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, session.email))
    .limit(1);

  const [tenant] = await db
    .insert(tenants)
    .values({ name: tenantName.trim(), slug: slugify(tenantName) })
    .returning();

  // 既定設定・初期データを配布（列defaultを使うため最小値のみ指定）
  await db.insert(tenantSettings).values({ tenantId: tenant.id });
  await db.insert(tenantChannelSettings).values({ tenantId: tenant.id, channel: 'coupang' });
  if (STARTER_NG_WORDS.length) {
    await db.insert(ngWords).values(
      STARTER_NG_WORDS.map((w) => ({
        tenantId: tenant.id,
        word: w.word,
        mode: w.mode,
        replacement: w.replacement ?? null,
      })),
    );
  }

  await db.insert(users).values({
    tenantId: tenant.id,
    email: emailNorm,
    fullName: fullName?.trim() || null,
    role: inviteRole,
    status: 'invited',
  });

  const rawToken = generateToken();
  await db.insert(invitations).values({
    tenantId: tenant.id,
    email: emailNorm,
    role: inviteRole,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7日有効
    createdBy: owner[0]?.id ?? null,
  });

  const inviteUrl = `${new URL(req.url).origin}/invite/${rawToken}`;
  return NextResponse.json({ ok: true, inviteUrl, tenantName: tenant.name, email: emailNorm }, { status: 201 });
}
