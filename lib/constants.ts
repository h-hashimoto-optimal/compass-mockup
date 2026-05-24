// Compass 固定値（enum/既定値/初期データ）の単一ソース。
// スキーマの text 列に入る値は、マジックストリングを避けここを参照する。

export const SOURCES = ['amazon', 'rakuten', 'yahoo', 'mercari'] as const;
export type Source = (typeof SOURCES)[number];

export const CHANNELS = ['coupang', 'naver', '11st'] as const;
export type Channel = (typeof CHANNELS)[number];

export const LISTING_STATUS = [
  'draft',
  'pending',
  'live',
  'stopped',
  'rejected',
  'deleted',
  'error',
] as const;
export type ListingStatus = (typeof LISTING_STATUS)[number];

export const ALERT_TYPES = ['price_up_loss', 'out_of_stock'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ROLES = ['owner', 'tenant_admin', 'member', 'operator'] as const;
export type AppRole = (typeof ROLES)[number];

export const INTEGRATION_KINDS = [
  'coupang',
  'naver',
  '11st',
  'amazon_spapi',
  'rakuten',
  'yahoo',
] as const;
export type IntegrationKind = (typeof INTEGRATION_KINDS)[number];

export const NG_MODES = ['block', 'replace'] as const;
export const IP_LEVELS = ['warn', 'block'] as const;
export const TIERS = ['hot', 'warm', 'cold'] as const;

// 既定値（テナント作成時や計算の初期値）
export const DEFAULTS = {
  marginRate: 0.25, // 目標利益率
  fxBuffer: 0.03, // 為替バッファ
  domesticShippingJpy: 0,
  sellFeeRate: { coupang: 0.11, naver: 0.06, '11st': 0.12 } as Record<Channel, number>,
  priceRoundingKrw: 10,
  sessionDays: 30,
  inviteDays: 7,
  fxJpyToKrw: 9.5, // fx_ratesが無い時のフォールバック（1JPY=?KRW）
};

// 新規テナントに配布する禁止ワードの初期セット（Amazon JP由来=日本語想定。Coupang禁制/要注意の代表例）
export const STARTER_NG_WORDS: { word: string; mode: 'block' | 'replace'; replacement?: string }[] = [
  { word: '医薬品', mode: 'block' },
  { word: '処方薬', mode: 'block' },
  { word: '医療機器', mode: 'block' },
  { word: 'コンタクトレンズ', mode: 'block' },
  { word: '酒', mode: 'block' },
  { word: 'ワイン', mode: 'block' },
  { word: 'ビール', mode: 'block' },
  { word: 'たばこ', mode: 'block' },
  { word: '電子タバコ', mode: 'block' },
  { word: 'リチウム電池', mode: 'block' },
  { word: '花火', mode: 'block' },
  { word: '銃', mode: 'block' },
  { word: 'ナイフ', mode: 'block' },
  { word: '現金', mode: 'block' },
  { word: '商品券', mode: 'block' },
];

// 本部共有の知財警告ブランド初期リスト（ip_brands tenant_id=NULL に投入）
export const STARTER_IP_BRANDS: { brand: string; level: 'warn' | 'block' }[] = [
  { brand: 'Nike', level: 'warn' },
  { brand: 'adidas', level: 'warn' },
  { brand: 'Louis Vuitton', level: 'warn' },
  { brand: 'CHANEL', level: 'warn' },
  { brand: 'GUCCI', level: 'warn' },
  { brand: 'HERMES', level: 'warn' },
  { brand: 'ROLEX', level: 'warn' },
  { brand: 'Supreme', level: 'warn' },
  { brand: 'Disney', level: 'warn' },
  { brand: 'SANRIO', level: 'warn' },
  { brand: 'Pokemon', level: 'warn' },
  { brand: 'Apple', level: 'warn' },
];
