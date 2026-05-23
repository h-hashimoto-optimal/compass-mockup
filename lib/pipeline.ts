// ASIN → Coupang化パイプライン。
// SP-API取得 → 翻訳 → カテゴリ推定 → 価格計算 → Coupangペイロード生成 までを一気通貫で実行。

import { fetchAmazonProduct, type AmazonProductDetail } from './channels/amazon/sp-api';
import { recommendCategory, type CategoryRecommendation } from './channels/coupang/category-mapper';
import {
  buildCoupangPayload,
  type CoupangProductPayload,
} from './channels/coupang/schema';
import { signRequest, toCurl, type CoupangSignedRequest } from './channels/coupang/hmac';
import { translateJaToKo, type TranslationResult } from './translation/translate';
import { calcPrice } from './pricing';

export type PipelineHint = {
  title?: string;
  brand?: string;
  priceJpy?: number | null;
  imageUrl?: string;
};

export type PipelineResult = {
  asin: string;
  steps: {
    spApi: AmazonProductDetail;
    translation: { title: TranslationResult };
    category: CategoryRecommendation;
    pricing: {
      costJpy: number;
      intlShipping: number;
      duty: number;
      vat: number;
      profit: number;
      marginRate: number;
      jpyTotal: number;
      fxRate: number;
      krwFinal: number;
    };
  };
  payload: CoupangProductPayload;
  signedRequest: CoupangSignedRequest;
  curl: string;
};

// 加盟店の事前登録情報（実環境では tenant_settings テーブルから読む）
function getCoupangContext() {
  return {
    vendorId: process.env.COUPANG_VENDOR_ID || 'A012345',
    vendorUserId: process.env.COUPANG_VENDOR_USER_ID || 'optimal_shop',
    returnCenterCode: process.env.COUPANG_RETURN_CENTER_CODE || 'RC-OPT-JP-001',
    outboundShippingPlaceCode:
      process.env.COUPANG_OUTBOUND_PLACE_CODE || 'OB-OPT-JP-001',
    returnAddress: {
      zip: '1000001',
      address: 'Tokyo, Chiyoda-ku, Chiyoda 1-1',
      detail: 'Optimal Shop Logistics Center',
      contactNumber: '+81-3-0000-0000',
      contactName: 'Hiroho Hashimoto',
    },
  };
}

function getCoupangCredentials() {
  return {
    vendorId: process.env.COUPANG_VENDOR_ID || 'A012345',
    accessKey: process.env.COUPANG_ACCESS_KEY || 'DEMO_ACCESS_KEY_NOT_REAL',
    secretKey: process.env.COUPANG_SECRET_KEY || 'DEMO_SECRET_KEY_NOT_REAL',
  };
}

export async function runAsinPipeline(
  asin: string,
  hint?: PipelineHint,
): Promise<PipelineResult> {
  // 1. SP-APIで詳細取得（モック or 本番）
  const spApi = await fetchAmazonProduct(asin, hint);

  // 2. 日→韓 翻訳
  const titleTr = await translateJaToKo(spApi.title);

  // 3. Coupangカテゴリ推定（日本語タイトルも結合して投げる：モック辞書のヒット率を上げるため）
  const category = await recommendCategory({
    productName: `${titleTr.ko} ${spApi.title}`,
    brand: spApi.brand ?? undefined,
  });

  // 4. 価格計算（利益率設定の単一ソース lib/pricing を参照。内部カテゴリで利益率上書き）
  const costJpy = spApi.priceJpy ?? 0;
  const pricing = calcPrice(costJpy, spApi.category ?? undefined);

  // 5. Coupangペイロード生成
  const ctx = getCoupangContext();
  const payload = buildCoupangPayload(
    {
      asin,
      titleJa: spApi.title,
      titleKo: titleTr.ko,
      brand: spApi.brand ?? 'NoBrand',
      category: spApi.category ?? '',
      priceJpy: costJpy,
      priceKrw: pricing.krwFinal,
      imageUrl: spApi.imageUrls[0] ?? '',
      marginRate: pricing.marginRate,
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

  // 6. HMAC署名
  const signed = signRequest({
    method: 'POST',
    pathWithQuery:
      '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products',
    body: payload,
    credentials: getCoupangCredentials(),
  });

  return {
    asin,
    steps: {
      spApi,
      translation: { title: titleTr },
      category,
      pricing: {
        costJpy: pricing.costJpy,
        intlShipping: pricing.intlShipping,
        duty: pricing.duty,
        vat: pricing.vat,
        profit: pricing.profit,
        marginRate: pricing.marginRate,
        jpyTotal: pricing.jpyTotal,
        fxRate: pricing.fxRate,
        krwFinal: pricing.krwFinal,
      },
    },
    payload,
    signedRequest: signed,
    curl: toCurl(signed),
  };
}

/**
 * パイプラインを実行し、Coupangへ実送信する。
 * 認証情報が DEMO のままなら送信を拒否してドライラン結果のみ返す。
 */
export async function submitToCoupang(asin: string, hint?: PipelineHint) {
  const result = await runAsinPipeline(asin, hint);
  const creds = getCoupangCredentials();

  if (
    creds.accessKey === 'DEMO_ACCESS_KEY_NOT_REAL' ||
    creds.secretKey === 'DEMO_SECRET_KEY_NOT_REAL'
  ) {
    return {
      mode: 'dry-run' as const,
      pipeline: result,
      submission: null,
      reason: 'COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY が未設定。本送信せずドライラン結果のみ返却。',
    };
  }

  const res = await fetch(result.signedRequest.url, {
    method: result.signedRequest.method,
    headers: result.signedRequest.headers,
    body: result.signedRequest.body,
  });
  const responseText = await res.text();
  let responseJson: unknown = null;
  try {
    responseJson = JSON.parse(responseText);
  } catch {
    /* keep null */
  }

  return {
    mode: 'live' as const,
    pipeline: result,
    submission: {
      status: res.status,
      ok: res.ok,
      response: responseJson ?? responseText,
    },
    reason: null,
  };
}
