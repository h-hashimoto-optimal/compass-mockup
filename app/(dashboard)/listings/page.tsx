import { currentTenantId } from '@/lib/tenant';
import { ListingsClient } from '@/components/listings/listings-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function ListingsPage() {
  const tenantId = await currentTenantId();
  if (!tenantId) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-sm text-muted-foreground">
        本部アカウントでは商品管理は使用できません。
        <br />
        加盟店アカウントでログインしてください。
      </div>
    );
  }
  return <ListingsClient />;
}
