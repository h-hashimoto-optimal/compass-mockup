// テナント別 受注。Coupang注文API連携後にここへ同期する想定（現状は取得のみ）。
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';

export async function listOrders(tenantId: string) {
  return db
    .select()
    .from(orders)
    .where(eq(orders.tenantId, tenantId))
    .orderBy(desc(orders.createdAt));
}
