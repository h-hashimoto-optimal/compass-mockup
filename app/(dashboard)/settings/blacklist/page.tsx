import { currentTenantId } from '@/lib/tenant';
import { BlacklistClient } from '@/components/lists/blacklist-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function BlacklistPage() {
  const tenantId = await currentTenantId();
  if (!tenantId) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-sm text-muted-foreground">
        本部アカウントでは仕入ブラックリストは使用できません。加盟店アカウントでログインしてください。
      </div>
    );
  }
  return <BlacklistClient />;
}
