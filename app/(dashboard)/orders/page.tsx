import { currentTenantId } from '@/lib/tenant';
import { OrdersClient } from '@/components/orders/orders-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const tenantId = await currentTenantId();
  if (!tenantId) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-sm text-muted-foreground">
        本部アカウントでは受注は使用できません。加盟店アカウントでログインしてください。
      </div>
    );
  }
  return <OrdersClient />;
}
