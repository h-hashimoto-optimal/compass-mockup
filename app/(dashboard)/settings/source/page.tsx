import { currentTenantId } from '@/lib/tenant';
import { IntegrationForm } from '@/components/integrations/integration-form';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FIELDS = [
  { name: 'sellerId', label: '出品者ID（Seller ID）', placeholder: 'A1B2C3...' },
  { name: 'marketplaceId', label: 'マーケットプレイスID', placeholder: 'A1VC38T7YXB528（日本）' },
  { name: 'region', label: 'リージョン', placeholder: 'fe（極東）' },
  { name: 'lwaClientId', label: 'LWA Client ID' },
  { name: 'lwaClientSecret', label: 'LWA Client Secret', secret: true },
  { name: 'refreshToken', label: 'Refresh Token', secret: true },
];

export default async function SourceSettingsPage() {
  const tenantId = await currentTenantId();
  if (!tenantId) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-sm text-muted-foreground">
        本部アカウントでは仕入元連携は使用できません。加盟店アカウントでログインしてください。
      </div>
    );
  }
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold">仕入元連携（Amazon SP-API）</h1>
        <p className="text-sm text-muted-foreground mt-1">Amazonの商品情報・在庫・価格を取得するためのAPI鍵を登録します（自店舗専用・暗号化保存）。</p>
      </div>
      <IntegrationForm
        kind="amazon_spapi"
        fields={FIELDS}
        note="利益率・為替・送料の設定は「利益・価格設定」で行います。ここでは取得元（Amazon）の接続情報のみを設定します。"
      />
    </div>
  );
}
