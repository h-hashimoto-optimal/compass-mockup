import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tenantTokens } from '@/lib/db/schema';
import { currentTenantId } from '@/lib/tenant';
import { createTenantToken } from '@/lib/tenant-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 発行済みトークンの一覧（生トークンは返さない）
export async function GET() {
  const tenantId = await currentTenantId();
  if (!tenantId) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  const rows = await db
    .select({ id: tenantTokens.id, label: tenantTokens.label, lastUsedAt: tenantTokens.lastUsedAt, revokedAt: tenantTokens.revokedAt, createdAt: tenantTokens.createdAt })
    .from(tenantTokens)
    .where(eq(tenantTokens.tenantId, tenantId))
    .orderBy(desc(tenantTokens.createdAt));
  return NextResponse.json({ tokens: rows });
}

// 新規トークン発行（生トークンは一度だけ返す）
export async function POST(req: Request) {
  const tenantId = await currentTenantId();
  if (!tenantId) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  const { label } = (await req.json().catch(() => ({}))) as { label?: string };
  const token = await createTenantToken(tenantId, label || 'Chrome拡張');
  return NextResponse.json({ token }, { status: 201 });
}
