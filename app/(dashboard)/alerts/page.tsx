import { currentTenantId } from '@/lib/tenant';
import { AlertsClient } from '@/components/alerts/alerts-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  const tenantId = await currentTenantId();
  if (!tenantId) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-sm text-muted-foreground">
        本部アカウントでは在庫・損益アラートは使用できません。加盟店アカウントでログインしてください。
      </div>
    );
  }
  return <AlertsClient />;
}
