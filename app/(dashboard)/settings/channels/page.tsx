import Link from 'next/link';
import { currentTenantId } from '@/lib/tenant';
import { IntegrationForm } from '@/components/integrations/integration-form';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FIELDS = [
  { name: 'vendorId', label: 'Vendor ID', placeholder: 'A00012345' },
  { name: 'vendorUserId', label: 'Vendor User ID（Wing ID）' },
  { name: 'accessKey', label: 'Access Key', secret: true },
  { name: 'secretKey', label: 'Secret Key', secret: true },
  { name: 'returnCenterCode', label: '返品センターコード' },
  { name: 'outboundShippingPlaceCode', label: '出庫地コード' },
  { name: 'returnZip', label: '返品先 郵便番号' },
  { name: 'returnAddress', label: '返品先 住所' },
  { name: 'returnContactName', label: '返品先 担当者名' },
  { name: 'returnContactNumber', label: '返品先 電話番号' },
];

export default async function ChannelsSettingsPage() {
  const tenantId = await currentTenantId();
  if (!tenantId) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-sm text-muted-foreground">
        本部アカウントでは販売先連携は使用できません。加盟店アカウントでログインしてください。
      </div>
    );
  }
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold">販売先連携（Coupang）</h1>
        <p className="text-sm text-muted-foreground mt-1">Coupangへ出品・送信するためのAPI鍵と出荷/返品情報を登録します（自店舗専用・暗号化保存）。</p>
      </div>
      <IntegrationForm
        kind="coupang"
        fields={FIELDS}
        note={
          <>
            販売手数料・価格丸め・通貨は{' '}
            <Link href="/settings/margin" className="text-primary hover:underline">利益・価格設定</Link>
            {' '}で設定します。CoupangはAPI呼出し元IPの許可リスト登録が必要です（本部側で対応）。
          </>
        }
      />
    </div>
  );
}
