import { redirect } from 'next/navigation';
import { desc, eq, isNull } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { tenants, invitations } from '@/lib/db/schema';
import { AdminClient } from '@/components/admin/admin-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 実DB版。owner専用。リッチな利用状況指標（プラン/売上/エラー率等）はP4の本部ダッシュボードで追加。
export default async function AdminTenantsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'owner') redirect('/'); // owner専用ガード（サーバ側）

  const tenantRows = await db
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug, status: tenants.status })
    .from(tenants)
    .orderBy(desc(tenants.createdAt));

  const pendingRows = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      tenantName: tenants.name,
    })
    .from(invitations)
    .leftJoin(tenants, eq(invitations.tenantId, tenants.id))
    .where(isNull(invitations.acceptedAt))
    .orderBy(desc(invitations.createdAt));

  const pending = pendingRows.map((p) => ({
    id: p.id,
    email: p.email,
    role: p.role,
    tenantName: p.tenantName,
    expiresAt: p.expiresAt.toISOString(),
  }));

  return <AdminClient tenants={tenantRows} pending={pending} />;
}
