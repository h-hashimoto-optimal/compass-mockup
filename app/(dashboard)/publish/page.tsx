import { currentTenantId } from '@/lib/tenant';
import { PublishClient } from '@/components/publish/publish-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function PublishPage() {
  const tenantId = await currentTenantId();
  if (!tenantId) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-sm text-muted-foreground">
        本部アカウントでは一括出品は使用できません。加盟店アカウントでログインしてください。
      </div>
    );
  }
  return <PublishClient />;
}
