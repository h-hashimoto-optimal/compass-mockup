import { currentTenantId } from '@/lib/tenant';
import { SettingsClient } from '@/components/settings/settings-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function MarginSettingsPage() {
  const tenantId = await currentTenantId();
  if (!tenantId) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-sm text-muted-foreground">
        本部アカウントでは利益設定は使用できません。加盟店アカウントでログインしてください。
      </div>
    );
  }
  return <SettingsClient />;
}
