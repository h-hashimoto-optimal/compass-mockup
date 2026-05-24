import { currentTenantId } from '@/lib/tenant';
import { AsinAddClient } from '@/components/listings/asin-add-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function AsinAddPage() {
  const tenantId = await currentTenantId();
  if (!tenantId) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-sm text-muted-foreground">
        本部アカウントではASIN追加は使用できません。加盟店アカウントでログインしてください。
      </div>
    );
  }
  return <AsinAddClient />;
}
