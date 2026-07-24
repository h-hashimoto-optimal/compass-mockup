import { currentTenantId } from '@/lib/tenant';
import { ListingDetailClient } from '@/components/listings/listing-detail-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await currentTenantId();
  if (!tenantId) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-sm text-muted-foreground">
        本部アカウントでは出品詳細は使用できません。加盟店アカウントでログインしてください。
      </div>
    );
  }
  return <ListingDetailClient id={id} />;
}
