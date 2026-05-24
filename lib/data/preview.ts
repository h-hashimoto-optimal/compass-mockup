// 出品プレビュー＋Coupang dry-run（DB=channel_listings 駆動）。
// 送信前に「最終形＋必須項目の欠落警告」を可視化し、ペイロード/curlも返す（実送信はしない）。
import { and, eq, isNull } from 'drizzle-orm';
import { withTenant } from '@/lib/db';
import { channelListings, sourceProducts } from '@/lib/db/schema';
import { recommendCategory } from '@/lib/channels/coupang/category-mapper';
import { buildCoupangPayload } from '@/lib/channels/coupang/schema';
import { signRequest, toCurl } from '@/lib/channels/coupang/hmac';
import { matchIpBrand } from '@/lib/data/lists';
import { getIntegrationSecrets } from '@/lib/data/integrations';

type SourceRaw = { imageUrls?: string[]; brand?: string; description?: string } | null;

// dry-run用のデモ加盟店情報（連携未設定時のフォールバック）
const DEMO_CTX = {
  vendorId: 'A012345',
  vendorUserId: 'demo_shop',
  returnCenterCode: 'RC-DEMO',
  outboundShippingPlaceCode: 'OB-DEMO',
  returnAddress: {
    zip: '1000001',
    address: 'Tokyo, Chiyoda-ku 1-1',
    detail: 'Demo Center',
    contactNumber: '+81-3-0000-0000',
    contactName: 'Demo',
  },
};
// 署名/curl表示は常にデモ鍵で行う（実 accessKey/secretKey をレスポンスへ漏らさないため）。
const DEMO_CREDS = {
  vendorId: 'A012345',
  accessKey: 'DEMO_ACCESS_KEY_NOT_REAL',
  secretKey: 'DEMO_SECRET_KEY_NOT_REAL',
};

// 連携(coupang)から出荷/返品コンテキストを解決（vendorId等＝非秘密）。未設定はデモ値。
async function resolveCoupangCtx(tenantId: string) {
  const s = await getIntegrationSecrets<Record<string, string>>(tenantId, 'coupang');
  if (!s || !s.vendorId) return { ...DEMO_CTX, configured: false };
  return {
    vendorId: s.vendorId,
    vendorUserId: s.vendorUserId || DEMO_CTX.vendorUserId,
    returnCenterCode: s.returnCenterCode || DEMO_CTX.returnCenterCode,
    outboundShippingPlaceCode: s.outboundShippingPlaceCode || DEMO_CTX.outboundShippingPlaceCode,
    returnAddress: {
      zip: s.returnZip || DEMO_CTX.returnAddress.zip,
      address: s.returnAddress || DEMO_CTX.returnAddress.address,
      detail: DEMO_CTX.returnAddress.detail,
      contactNumber: s.returnContactNumber || DEMO_CTX.returnAddress.contactNumber,
      contactName: s.returnContactName || DEMO_CTX.returnAddress.contactName,
    },
    configured: true,
  };
}

export async function previewListing(tenantId: string, listingId: string) {
  const [row] = await withTenant(tenantId, (tx) =>
    tx
    .select({
      id: channelListings.id,
      channel: channelListings.channel,
      status: channelListings.status,
      titleJa: channelListings.titleJa,
      titleTranslated: channelListings.titleTranslated,
      listPrice: channelListings.listPrice,
      listCurrency: channelListings.listCurrency,
      floorPriceJpy: channelListings.floorPriceJpy,
      sourcePriceJpyAtList: channelListings.sourcePriceJpyAtList,
      categoryCode: channelListings.coupangCategoryCode,
      categoryName: channelListings.coupangCategoryName,
      sourceId: sourceProducts.id,
      source: sourceProducts.source,
      sourceProductId: sourceProducts.sourceProductId,
      lastPriceJpy: sourceProducts.lastPriceJpy,
      lastInStock: sourceProducts.lastInStock,
      raw: sourceProducts.raw,
    })
    .from(channelListings)
    .innerJoin(sourceProducts, eq(channelListings.sourceProductId, sourceProducts.id))
    .where(
      and(
        eq(channelListings.id, listingId),
        eq(channelListings.tenantId, tenantId),
        isNull(channelListings.deletedAt),
      ),
    )
    .limit(1),
  );
  if (!row) throw new Error('NOT_FOUND');
  if (row.channel !== 'coupang') throw new Error('UNSUPPORTED_CHANNEL'); // 他チャネルは後でアダプタ

  const raw = row.raw as SourceRaw;
  const images = raw?.imageUrls ?? [];
  const brand = raw?.brand ?? 'NoBrand';
  const ctx = await resolveCoupangCtx(tenantId);

  // 必須項目チェック（blocking=送信不可 / info=注意）
  const warnings: { level: 'block' | 'info'; msg: string }[] = [];
  if (!row.titleTranslated) warnings.push({ level: 'block', msg: '韓国語タイトルが未設定（先に「処理」を実行）' });
  if (!row.listPrice || row.listPrice <= 0) warnings.push({ level: 'block', msg: '販売価格が未計算（先に「処理」を実行）' });
  if (images.length === 0) warnings.push({ level: 'block', msg: '画像がありません' });
  if (row.floorPriceJpy != null && row.lastPriceJpy != null && row.lastPriceJpy > row.floorPriceJpy)
    warnings.push({ level: 'block', msg: `現在の仕入値(${row.lastPriceJpy}円)が赤字下限(${row.floorPriceJpy}円)を超過＝このままだと赤字` });
  warnings.push({ level: 'info', msg: '商品コード(ASIN/JAN)はCoupang相乗りのマッチング要確認（product-idは空欄出力）' });
  warnings.push({ level: 'info', msg: '상품정보제공고시/カテゴリ別必須属性は現状プレースホルダ（★Coupang必須項目フル対応で実装予定）' });
  if (!ctx.configured)
    warnings.push({ level: 'info', msg: 'Coupang連携が未設定です（「販売先（Coupang）」でAPI鍵・出荷/返品情報を登録）。送信はデモ扱いになります' });

  // 知財ブランド（本部共有＋自社）に該当するか
  const ipBrand = await matchIpBrand(tenantId, brand);
  if (ipBrand)
    warnings.push({
      level: ipBrand.level === 'block' ? 'block' : 'info',
      msg: `知財監視ブランド該当: 「${ipBrand.brand}」（${ipBrand.level === 'block' ? '出品不可' : '要注意'}）`,
    });

  const ready = !warnings.some((w) => w.level === 'block');

  // カテゴリ推定（mock or 実API）
  // カテゴリ：手動上書きがあれば優先。無ければ推定（テナントのCoupang鍵があれば実API、無ければmock）。
  let category: { displayCategoryCode: number; displayCategoryName: string };
  if (row.categoryCode != null) {
    category = { displayCategoryCode: row.categoryCode, displayCategoryName: row.categoryName ?? `カテゴリ#${row.categoryCode}` };
  } else {
    const cc = await getIntegrationSecrets<Record<string, string>>(tenantId, 'coupang');
    const creds = cc && cc.vendorId && cc.accessKey && cc.secretKey ? { vendorId: cc.vendorId, accessKey: cc.accessKey, secretKey: cc.secretKey } : null;
    category = await recommendCategory({ productName: `${row.titleTranslated ?? ''} ${row.titleJa ?? ''}`.trim(), brand }, creds);
  }

  // Coupangペイロード（dry-run）
  const payload = buildCoupangPayload(
    {
      asin: row.sourceProductId,
      titleJa: row.titleJa ?? '',
      titleKo: row.titleTranslated ?? '',
      brand,
      category: category.displayCategoryName,
      priceJpy: row.sourcePriceJpyAtList ?? 0,
      priceKrw: row.listPrice ?? 0,
      imageUrl: images[0] ?? '',
      marginRate: 0,
    },
    {
      vendorId: ctx.vendorId,
      vendorUserId: ctx.vendorUserId,
      displayCategoryCode: category.displayCategoryCode,
      returnCenterCode: ctx.returnCenterCode,
      outboundShippingPlaceCode: ctx.outboundShippingPlaceCode,
      returnAddress: ctx.returnAddress,
    },
  );

  const signed = signRequest({
    method: 'POST',
    pathWithQuery: '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products',
    body: payload,
    credentials: DEMO_CREDS,
  });

  return {
    mode: 'dry-run' as const,
    preview: {
      channel: row.channel,
      titleJa: row.titleJa,
      titleTranslated: row.titleTranslated,
      brand,
      ipBrand,
      category: category.displayCategoryName,
      images,
      source: row.source,
      sourceProductId: row.sourceProductId,
      sourcePriceJpy: row.lastPriceJpy ?? row.sourcePriceJpyAtList,
      inStock: row.lastInStock,
      listPrice: row.listPrice,
      listCurrency: row.listCurrency,
      floorPriceJpy: row.floorPriceJpy,
    },
    validation: { ready, warnings },
    payload,
    curl: toCurl(signed),
  };
}
