import { currentTenantId } from '@/lib/tenant';
import { InboxClient } from '@/components/inbox/inbox-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const tenantId = await currentTenantId();
  if (!tenantId) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-sm text-muted-foreground">
        本部アカウントでは受信トレイは使用できません。
        <br />
        加盟店アカウントでログインしてください。
      </div>
    );
  }
  return <InboxClient />;
}
