import { currentTenantId } from '@/lib/tenant';
import { IpBrandsClient } from '@/components/lists/ip-brands-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function IpBrandsPage() {
  const tenantId = await currentTenantId();
  if (!tenantId) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-sm text-muted-foreground">
        本部アカウントでは知財・監視ブランド設定は使用できません。加盟店アカウントでログインしてください。
      </div>
    );
  }
  return <IpBrandsClient />;
}
