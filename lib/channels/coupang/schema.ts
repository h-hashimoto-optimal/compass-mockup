// Coupang seller-products POST 用のスキーマ型定義（最小限の必須フィールドのみ）。
// 公式: https://developers.coupangcorp.com/hc/en-us/articles/360033877853-Product-Creation
//
// 実フィールドは数十個あるが、ここではMVPで必須な範囲を定義。
// 実装時は公式PDFを参照し追加していく。

export type CoupangAttribute = {
  attributeTypeName: string; // 例: '색상' / '사이즈'
  attributeValueName: string; // 例: '블랙' / 'M'
};

export type CoupangContent = {
  contentsType: 'TEXT' | 'IMAGE_NO_SPACE';
  contentDetails: Array<{ content: string; detailType: 'TEXT' | 'IMAGE' }>;
};

export type CoupangImage = {
  imageOrder: number;
  imageType: 'REPRESENTATION' | 'DETAIL';
  vendorPath: string; // 画像URL
};

export type CoupangItem = {
  itemName: string;
  originalPrice: number; // 定価 (KRW)
  salePrice: number; // 販売価格 (KRW)
  maximumBuyCount: number;
  maximumBuyForPerson: number;
  outboundShippingTimeDay: number; // 出荷リードタイム（日）
  unitCount: number;
  adultOnly: 'EVERYONE' | 'ADULT_ONLY';
  taxType: 'TAX' | 'FREE';
  parallelImported: 'NOT_PARALLEL_IMPORTED' | 'PARALLEL_IMPORTED';
  overseasPurchased: 'NOT_OVERSEAS_PURCHASED' | 'OVERSEAS_PURCHASED';
  pccNeeded: boolean; // 越境商品はtrue
  externalVendorSku: string; // 加盟店内部SKU
  emptyBarcode: boolean;
  emptyBarcodeReason?: string;
  modelNo?: string;
  bundleSize?: string;
  contents: CoupangContent[];
  images: CoupangImage[];
  attributes: CoupangAttribute[];
  notices: Array<{ noticeCategoryName: string; noticeCategoryDetailName: string; content: string }>;
};

export type CoupangProductPayload = {
  displayCategoryCode: number;
  sellerProductName: string; // セラー内部用
  vendorId: string;
  saleStartedAt: string; // ISO date 'yyyy-MM-ddTHH:mm:ss'
  saleEndedAt: string;
  displayProductName: string; // 表示用（韓国語）
  brand: string;
  generalProductName: string;
  productGroup: string;
  deliveryMethod: 'SEQUENCIAL' | 'AGENT_BUY';
  deliveryCompanyCode: string; // 例: 'KGB'
  deliveryChargeType: 'FREE' | 'NOT_FREE' | 'CONDITIONAL_FREE';
  deliveryCharge: number;
  freeShipOverAmount?: number;
  deliveryChargeOnReturn: number;
  remoteAreaDeliverable: 'Y' | 'N';
  unionDeliveryType: 'UNION_DELIVERY' | 'NOT_UNION_DELIVERY';
  returnCenterCode: string; // 事前登録した返品センターコード
  returnChargeName: string;
  companyContactNumber: string;
  returnZipCode: string;
  returnAddress: string;
  returnAddressDetail: string;
  returnCharge: number;
  outboundShippingPlaceCode: string; // 事前登録した出荷地コード
  vendorUserId: string;
  requested: boolean;
  items: CoupangItem[];
  // requiredDocuments: Array<{ templateName: string; vendorDocumentPath: string }>; // 認証必要時
};

export type ListingForCoupang = {
  asin: string;
  titleJa: string;
  titleKo: string;
  brand: string;
  category: string; // 内部カテゴリ表記
  priceJpy: number;
  priceKrw: number;
  imageUrl: string;
  marginRate: number;
};

/**
 * 内部 listing → Coupang seller-products POST用ペイロードへ変換。
 * 加盟店設定（Vendor ID, 返品センター, 出荷地等）は引数で渡す。
 */
export function buildCoupangPayload(
  listing: ListingForCoupang,
  ctx: {
    vendorId: string;
    vendorUserId: string;
    displayCategoryCode: number;
    returnCenterCode: string;
    outboundShippingPlaceCode: string;
    returnAddress: {
      zip: string;
      address: string;
      detail: string;
      contactNumber: string;
      contactName: string;
    };
  },
): CoupangProductPayload {
  const now = new Date();
  const saleStart = new Date(now.getTime() - 60 * 1000); // 1分前から販売開始
  const saleEnd = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365 * 5); // 5年後

  return {
    displayCategoryCode: ctx.displayCategoryCode,
    sellerProductName: `OPT-${listing.asin}-${listing.titleJa}`.slice(0, 100),
    vendorId: ctx.vendorId,
    saleStartedAt: toCoupangDateTime(saleStart),
    saleEndedAt: toCoupangDateTime(saleEnd),
    displayProductName: listing.titleKo.slice(0, 100),
    brand: listing.brand,
    generalProductName: listing.titleKo.slice(0, 100),
    productGroup: listing.category,
    deliveryMethod: 'AGENT_BUY',
    deliveryCompanyCode: 'DIRECT',
    deliveryChargeType: 'NOT_FREE',
    deliveryCharge: 3000,
    freeShipOverAmount: 50000,
    deliveryChargeOnReturn: 3000,
    remoteAreaDeliverable: 'N',
    unionDeliveryType: 'NOT_UNION_DELIVERY',
    returnCenterCode: ctx.returnCenterCode,
    returnChargeName: ctx.returnAddress.contactName,
    companyContactNumber: ctx.returnAddress.contactNumber,
    returnZipCode: ctx.returnAddress.zip,
    returnAddress: ctx.returnAddress.address,
    returnAddressDetail: ctx.returnAddress.detail,
    returnCharge: 3000,
    outboundShippingPlaceCode: ctx.outboundShippingPlaceCode,
    vendorUserId: ctx.vendorUserId,
    requested: true,
    items: [
      {
        itemName: listing.titleKo.slice(0, 100),
        originalPrice: listing.priceKrw,
        salePrice: listing.priceKrw,
        maximumBuyCount: 9999,
        maximumBuyForPerson: 0, // 0=制限なし
        outboundShippingTimeDay: 5,
        unitCount: 1,
        adultOnly: 'EVERYONE',
        taxType: 'TAX',
        parallelImported: 'NOT_PARALLEL_IMPORTED',
        overseasPurchased: 'OVERSEAS_PURCHASED',
        pccNeeded: true, // 越境商品なので必須
        externalVendorSku: `OPT-${listing.asin}`,
        emptyBarcode: true,
        emptyBarcodeReason: '해외 직구 상품',
        contents: [
          {
            contentsType: 'TEXT',
            contentDetails: [
              {
                content: `<p>${escapeHtml(listing.titleKo)}</p><p>일본 정품 / 당일발송 가능</p>`,
                detailType: 'TEXT',
              },
            ],
          },
        ],
        images: [
          {
            imageOrder: 0,
            imageType: 'REPRESENTATION',
            vendorPath: listing.imageUrl,
          },
        ],
        attributes: [
          { attributeTypeName: '원산지', attributeValueName: '일본' },
          { attributeTypeName: '제조사', attributeValueName: listing.brand },
        ],
        notices: [
          {
            noticeCategoryName: '기타 재화',
            noticeCategoryDetailName: '품명 및 모델명',
            content: listing.titleKo,
          },
        ],
      },
    ],
  };
}

function toCoupangDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Coupang側のエラーコードを日本語にマッピング（抜粋）。
 */
export const coupangErrorMap: Record<string, string> = {
  CATEGORY_NOT_MATCHED: 'カテゴリが正しくマッピングされていません',
  REQUIRED_ATTRIBUTE_MISSING: '必須属性が不足しています',
  IMAGE_INVALID: '画像が仕様を満たしていません',
  PRICE_TOO_LOW: '販売価格が下限を下回っています',
  DUPLICATE_PRODUCT: '同一商品が既に登録されています',
};
