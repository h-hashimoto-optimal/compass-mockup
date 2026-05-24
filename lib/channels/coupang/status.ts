// Coupang 出品状態の取得（状態同期 reconcile 用）。
// 仕様: seller-product(承認) GET → statusName / items[].vendorItemId・saleStatus を取得。
//   実キーがあれば本番GET、無ければモック（同じマッパで処理＝挙動を揃える）。
// ※ 承認(statusName)は公開仕様の韓国語表記準拠。販売(saleStatus)の正確なフィールドは実APIで要確認。
import { signRequest, type CoupangCredentials } from './hmac';
import type { CoupangApprovalStatus, CoupangSalesStatus } from '@/lib/constants';

export type CoupangStatusResult = {
  approvalStatus: CoupangApprovalStatus | null;
  salesStatus: CoupangSalesStatus | null;
  vendorItemId: string | null;
  rejectedReason: string | null;
  source: 'coupang' | 'mock';
  statusName: string;
};

type RawItem = { vendorItemId?: string | number; saleStatus?: string };
type RawProduct = { statusName?: string; items?: RawItem[]; rejectReason?: string };

// 承認(seller-product)ステータス：Coupangの statusName(韓/英) → 自前enum
function mapApproval(statusName: string): CoupangApprovalStatus | null {
  const s = statusName || '';
  if (/반려|거부|DENIED|REJECT/i.test(s)) return 'rejected';
  if (/부분승인|PARTIAL/i.test(s)) return 'partial_approved';
  if (/승인완료|APPROVED/i.test(s)) return 'approved';
  if (/승인대기|심사|APPROVING|WAIT/i.test(s)) return 'requested';
  if (/삭제|DELETED/i.test(s)) return 'deleted';
  if (/임시|TEMP|SAVE/i.test(s)) return null; // 임시저장＝未送信扱い
  return 'requested';
}

// 販売(vendorItem)ステータス：saleStatus → 自前enum
function mapSales(saleStatus: string): CoupangSalesStatus | null {
  const s = saleStatus || '';
  if (/품절|SOLDOUT|OUT_OF/i.test(s)) return 'soldout';
  if (/판매중지|중지|STOP|SUSPEND/i.test(s)) return 'suspended';
  if (/판매중|ON_?SALE|SELLING/i.test(s)) return 'on_sale';
  return null;
}

function mapRaw(raw: RawProduct, source: 'coupang' | 'mock'): CoupangStatusResult {
  const statusName = raw.statusName ?? '';
  const approvalStatus = mapApproval(statusName);
  const item = (raw.items ?? [])[0];
  const vendorItemId = item?.vendorItemId != null ? String(item.vendorItemId) : null;
  const salesStatus =
    approvalStatus === 'approved' || approvalStatus === 'partial_approved'
      ? mapSales(item?.saleStatus ?? '')
      : null;
  const rejectedReason = approvalStatus === 'rejected' ? raw.rejectReason ?? statusName : null;
  return { approvalStatus, salesStatus, vendorItemId, rejectedReason, source, statusName };
}

// モック：sellerProductId に 'REJECT' を含めば 반려、それ以外は 승인완료＋판매중（決定論的）。
function mockRaw(sellerProductId: string): RawProduct {
  if (/REJECT/i.test(sellerProductId)) {
    return { statusName: '승인반려', rejectReason: '카테고리 필수속성 누락(모의)' };
  }
  return { statusName: '승인완료', items: [{ vendorItemId: 'VI-' + sellerProductId, saleStatus: '판매중' }] };
}

export async function fetchCoupangProductStatus(
  sellerProductId: string,
  credentials?: CoupangCredentials | null,
): Promise<CoupangStatusResult> {
  if (!credentials) return mapRaw(mockRaw(sellerProductId), 'mock');

  const signed = signRequest({
    method: 'GET',
    pathWithQuery: `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${sellerProductId}`,
    credentials,
  });
  const res = await fetch(signed.url, { method: 'GET', headers: signed.headers });
  const json = (await res.json().catch(() => ({}))) as { data?: RawProduct } & RawProduct;
  return mapRaw(json.data ?? json, 'coupang');
}
