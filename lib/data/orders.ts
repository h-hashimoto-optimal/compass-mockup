// テナント別 受注。Coupang注文API連携後にここへ同期する想定（現状は取得のみ）。RLS対象テーブル。
import { desc, eq } from 'drizzle-orm';
import { withTenant } from '@/lib/db';
import { orders } from '@/lib/db/schema';

export async function listOrders(tenantId: string) {
  return withTenant(tenantId, (tx) =>
    tx.select().from(orders).where(eq(orders.tenantId, tenantId)).orderBy(desc(orders.createdAt)),
  );
}
