// 実DB認証（Postgres/Drizzle）。bcryptでパスワード、セッションはDB保存＋httpOnly Cookie。
// 既存の SessionUser / Role の「形」は維持し、画面側を無改修にする。
import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sessions, users, tenants } from '@/lib/db/schema';
import type { SessionUser, Role } from '@/components/common/role-context';

const COOKIE_NAME = 'compass_session';
const SESSION_DAYS = 30;

// ─── トークン/パスワード ───────────────────────────────
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

// 生トークンはCookie/メールに、DBにはこのハッシュを保存する
export function hashToken(raw: string): string {
  return createHash('sha256')
    .update(raw + (process.env.SESSION_SECRET ?? ''))
    .digest('hex');
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── セッション ────────────────────────────────────────
export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * SESSION_DAYS);
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt });
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function destroySession(): Promise<void> {
  const c = cookies().get(COOKIE_NAME);
  if (c?.value) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(c.value)));
  }
  cookies().delete(COOKIE_NAME);
}

// セッションCookie → SessionUser を組み立てる（期限切れ/不正は null）
export async function getSession(): Promise<SessionUser | null> {
  const c = cookies().get(COOKIE_NAME);
  if (!c?.value) return null;

  const rows = await db
    .select({
      expiresAt: sessions.expiresAt,
      role: users.role,
      fullName: users.fullName,
      email: users.email,
      status: users.status,
      tenantId: users.tenantId,
      tenantName: tenants.name,
      tenantStatus: tenants.status,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .leftJoin(tenants, eq(users.tenantId, tenants.id))
    .where(eq(sessions.tokenHash, hashToken(c.value)))
    .limit(1);

  const r = rows[0];
  if (!r) return null;
  if (new Date(r.expiresAt) < new Date()) {
    await destroySession();
    return null;
  }
  if (r.status === 'suspended') return null;
  // 加盟店が停止中ならアクセス遮断（ownerはtenantなしなので影響なし）
  if (r.tenantStatus === 'suspended') return null;

  return {
    role: r.role as Role,
    fullName: r.fullName ?? '',
    email: r.email,
    // owner は tenant_id NULL → 本部モード表記
    tenantName: r.tenantName ?? '— 本部モード（全テナント）',
    tenantId: r.tenantId ?? 'HQ',
  };
}
