import { currentTenantId } from '@/lib/tenant';
import { NgWordsClient } from '@/components/lists/ng-words-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function NgWordsPage() {
  const tenantId = await currentTenantId();
  if (!tenantId) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-sm text-muted-foreground">
        本部アカウントでは禁止ワード設定は使用できません。加盟店アカウントでログインしてください。
      </div>
    );
  }
  return <NgWordsClient />;
}
