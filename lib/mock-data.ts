// モックデータ — Compass 越境ECツール
// スコープ：仕入＝Amazon.co.jp のみ / 販売＝Coupang のみ
// ASIN取得は Chrome拡張（chrome-extension/）経由で受信する想定。

export type ListingStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'live'
  | 'rejected'
  | 'suspended';

export type Channel = 'coupang' | 'naver' | '11st';
export type SourcePlatform = 'amazon' | 'rakuten' | 'yahoo';

export type Listing = {
  id: string;
  titleJa: string;
  titleKo: string;
  brand: string;
  source: SourcePlatform;
  asin: string;
  imageUrl: string;
  category: string;
  priceJpy: number;
  priceKrw: number;
  marginRate: number;
  channel: { status: ListingStatus; externalId?: string };
  isProtected: boolean;
  updatedAt: string;
};

const img = (seed: string, w = 80, h = 80) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;

export const listings: Listing[] = [
  {
    id: 'L-0001',
    titleJa: 'ナイキ エアマックス 90 ホワイト 27cm',
    titleKo: '나이키 에어맥스 90 화이트 27cm',
    brand: 'Nike',
    source: 'amazon',
    asin: 'B07XYZAB12',
    imageUrl: img('nike-airmax'),
    category: 'シューズ / スニーカー',
    priceJpy: 14800,
    priceKrw: 201400,
    marginRate: 28,
    channel: { status: 'live', externalId: 'CP-2389721' },
    isProtected: true,
    updatedAt: '2026-04-23T10:14:00+09:00',
  },
  {
    id: 'L-0002',
    titleJa: 'Anker PowerCore 10000 モバイルバッテリー',
    titleKo: 'Anker 파워코어 10000 보조배터리',
    brand: 'Anker',
    source: 'amazon',
    asin: 'B0194WDVHI',
    imageUrl: img('anker-power'),
    category: '家電 / モバイルバッテリー',
    priceJpy: 2980,
    priceKrw: 42700,
    marginRate: 32,
    channel: { status: 'live', externalId: 'CP-2389732' },
    isProtected: false,
    updatedAt: '2026-04-23T11:02:00+09:00',
  },
  {
    id: 'L-0003',
    titleJa: 'シャープ ヘルシオ ホットクック 2.4L',
    titleKo: '샤프 헬시오 핫쿡 2.4L',
    brand: 'SHARP',
    source: 'amazon',
    asin: 'B08ZYK3211',
    imageUrl: img('sharp-hotcook'),
    category: '家電 / 調理家電',
    priceJpy: 49800,
    priceKrw: 682600,
    marginRate: 22,
    channel: { status: 'pending' },
    isProtected: false,
    updatedAt: '2026-04-23T09:51:00+09:00',
  },
  {
    id: 'L-0004',
    titleJa: 'Pokemon ぬいぐるみ ピカチュウ 約30cm',
    titleKo: '포켓몬 인형 피카츄 약 30cm',
    brand: 'Pokemon',
    source: 'amazon',
    asin: 'B09PIKA001',
    imageUrl: img('pokemon-pikachu'),
    category: 'おもちゃ / キャラクター',
    priceJpy: 3200,
    priceKrw: 45700,
    marginRate: 40,
    channel: { status: 'live', externalId: 'CP-2389760' },
    isProtected: true,
    updatedAt: '2026-04-23T12:22:00+09:00',
  },
  {
    id: 'L-0005',
    titleJa: 'Sony WH-1000XM5 ワイヤレスヘッドホン ブラック',
    titleKo: '소니 WH-1000XM5 무선 헤드폰 블랙',
    brand: 'Sony',
    source: 'amazon',
    asin: 'B09Y2Q9P1S',
    imageUrl: img('sony-headphone'),
    category: '家電 / オーディオ',
    priceJpy: 41800,
    priceKrw: 526200,
    marginRate: 18,
    channel: { status: 'live', externalId: 'CP-2389781' },
    isProtected: true,
    updatedAt: '2026-04-23T13:45:00+09:00',
  },
  {
    id: 'L-0006',
    titleJa: '無印良品 アロマディフューザー 大',
    titleKo: '무인양품 아로마 디퓨저 대형',
    brand: 'MUJI',
    source: 'amazon',
    asin: 'B07MUJI001',
    imageUrl: img('muji-aroma'),
    category: '生活雑貨 / アロマ',
    priceJpy: 8990,
    priceKrw: 124800,
    marginRate: 25,
    channel: { status: 'rejected' },
    isProtected: false,
    updatedAt: '2026-04-22T18:43:00+09:00',
  },
  {
    id: 'L-0007',
    titleJa: 'ユニクロ ヒートテック クルーネックT 黒 M',
    titleKo: '유니클로 히트텍 크루넥 티셔츠 블랙 M',
    brand: 'UNIQLO',
    source: 'rakuten',
    asin: 'RK-484920-HT-M',
    imageUrl: img('uniqlo-heattech'),
    category: 'アパレル / インナー',
    priceJpy: 1500,
    priceKrw: 22400,
    marginRate: 35,
    channel: { status: 'live', externalId: 'CP-2389755' },
    isProtected: false,
    updatedAt: '2026-04-23T07:30:00+09:00',
  },
  {
    id: 'L-0008',
    titleJa: 'カルディ オリジナル コーヒー豆 マイルドカルディ 200g',
    titleKo: '칼디 오리지널 커피원두 마일드 200g',
    brand: 'KALDI',
    source: 'yahoo',
    asin: 'YH-kaldi-mild-200',
    imageUrl: img('kaldi-coffee'),
    category: '食品 / コーヒー',
    priceJpy: 750,
    priceKrw: 13200,
    marginRate: 45,
    channel: { status: 'draft' },
    isProtected: false,
    updatedAt: '2026-04-22T15:11:00+09:00',
  },
];

// HOME ダッシュボード KPI（チェさん要望：Coupang管理画面に行かなくて済むレベル）
export const dashboardKpi = {
  // 本日
  visitorsToday: 1284, // Coupang商品ページ訪問者数（韓国側からの流入）
  ordersToday: 38,
  revenueTodayKrw: 4_182_300,
  revenueTodayJpy: 380_209,
  // CS（顧客対応）
  csOpen: 4, // 未対応
  csResponded: 12, // 本日返信済
  // 商品
  totalListed: 1284,
  live: 921,
  pending: 142,
  rejected: 7,
  // 累計実績（運用開始からの累計）
  cumulativeOrders: 4821,
  cumulativeRevenueKrw: 412_350_000,
  cumulativeVisitors: 198_320,
};

// 直近30日の指標（売上・訪問数・注文数）
export const dailyMetrics = [
  { date: '03-29', revenue: 388000, visitors: 980, orders: 28 },
  { date: '03-30', revenue: 290000, visitors: 760, orders: 22 },
  { date: '03-31', revenue: 320000, visitors: 820, orders: 24 },
  { date: '04-01', revenue: 360000, visitors: 920, orders: 28 },
  { date: '04-02', revenue: 405000, visitors: 1080, orders: 31 },
  { date: '04-03', revenue: 380000, visitors: 980, orders: 29 },
  { date: '04-04', revenue: 420000, visitors: 1110, orders: 33 },
  { date: '04-05', revenue: 360000, visitors: 920, orders: 28 },
  { date: '04-06', revenue: 312000, visitors: 810, orders: 24 },
  { date: '04-07', revenue: 442000, visitors: 1180, orders: 34 },
  { date: '04-08', revenue: 388000, visitors: 1010, orders: 30 },
  { date: '04-09', revenue: 401000, visitors: 1050, orders: 31 },
  { date: '04-10', revenue: 460000, visitors: 1240, orders: 36 },
  { date: '04-11', revenue: 410000, visitors: 1080, orders: 32 },
  { date: '04-12', revenue: 350000, visitors: 910, orders: 27 },
  { date: '04-13', revenue: 380000, visitors: 990, orders: 29 },
  { date: '04-14', revenue: 432000, visitors: 1150, orders: 33 },
  { date: '04-15', revenue: 410000, visitors: 1080, orders: 32 },
  { date: '04-16', revenue: 470000, visitors: 1260, orders: 37 },
  { date: '04-17', revenue: 490000, visitors: 1310, orders: 38 },
  { date: '04-18', revenue: 388000, visitors: 1010, orders: 30 },
  { date: '04-19', revenue: 420000, visitors: 1110, orders: 33 },
  { date: '04-20', revenue: 460000, visitors: 1240, orders: 36 },
  { date: '04-21', revenue: 442000, visitors: 1180, orders: 34 },
  { date: '04-22', revenue: 488000, visitors: 1300, orders: 38 },
  { date: '04-23', revenue: 510000, visitors: 1370, orders: 40 },
  { date: '04-24', revenue: 488000, visitors: 1300, orders: 38 },
  { date: '04-25', revenue: 472000, visitors: 1240, orders: 37 },
  { date: '04-26', revenue: 502000, visitors: 1340, orders: 39 },
  { date: '04-27', revenue: 482000, visitors: 1284, orders: 38 },
];

export const recentErrors = [
  {
    id: 'E-2042',
    at: '2026-04-23T13:18:21+09:00',
    listingId: 'L-0003',
    title: 'シャープ ヘルシオ ホットクック',
    reason: 'カテゴリ未マッピング (가전 > 주방가전)',
    severity: 'error' as const,
  },
  {
    id: 'E-2041',
    at: '2026-04-23T12:51:08+09:00',
    listingId: 'L-0001',
    title: 'ナイキ エアマックス 90',
    reason: 'Coupang: 필수 속성 "원산지" 누락',
    severity: 'warning' as const,
  },
  {
    id: 'E-2040',
    at: '2026-04-23T11:03:12+09:00',
    listingId: 'L-0006',
    title: '無印良品 アロマディフューザー',
    reason: '商品名(KO)が100文字を超えています',
    severity: 'warning' as const,
  },
  {
    id: 'E-2039',
    at: '2026-04-23T10:32:49+09:00',
    listingId: 'L-0005',
    title: 'Sony WH-1000XM5',
    reason: 'Coupang Wing API: rate limit 429',
    severity: 'warning' as const,
  },
  {
    id: 'E-2038',
    at: '2026-04-23T09:11:02+09:00',
    listingId: 'L-0002',
    title: 'Anker PowerCore 10000',
    reason: 'AMAZON-API 在庫取得 timeout',
    severity: 'warning' as const,
  },
];

export const fxRate = {
  base: 'JPY',
  quote: 'KRW',
  rate: 9.21,
  buffer: 2.0,
  source: 'Open Exchange Rates',
  fetchedAt: '2026-04-24T08:00:00+09:00',
};

export const announcements = [
  {
    id: 'A-12',
    title: 'Coupang Wing API レート制限緩和のお知らせ',
    publishedAt: '2026-04-22',
    body: '4/25 09:00 より上限が 10→15 req/sec へ緩和されます。',
  },
  {
    id: 'A-11',
    title: '5月度ロイヤリティ計算の締め日について',
    publishedAt: '2026-04-20',
    body: '締め日は 5/31 23:59 (KST)。月次レポートは翌月3営業日以内に配信。',
  },
  {
    id: 'A-10',
    title: '韓国輸入禁制品リスト更新',
    publishedAt: '2026-04-15',
    body: '電波法対象機器3種を追加。NG辞書を更新済み。',
  },
];

// CS（顧客問い合わせ） — チェさん要望: 一次返信は自動化、アラートは別途通知
export type CsTicket = {
  id: string;
  receivedAt: string;
  channel: 'coupang';
  buyerName: string;
  productTitle: string;
  category: 'inquiry' | 'shipping' | 'return' | 'complaint';
  status: 'open' | 'auto_replied' | 'human_replied' | 'closed';
  preview: string;
};

export const csTickets: CsTicket[] = [
  {
    id: 'CS-2188',
    receivedAt: '2026-04-27T09:42:00+09:00',
    channel: 'coupang',
    buyerName: '김민수',
    productTitle: 'ナイキ エアマックス 90',
    category: 'shipping',
    status: 'auto_replied',
    preview: '배송이 언제쯤 도착할까요? 주문번호 확인 부탁드립니다.',
  },
  {
    id: 'CS-2187',
    receivedAt: '2026-04-27T08:11:00+09:00',
    channel: 'coupang',
    buyerName: '이지은',
    productTitle: 'Anker PowerCore 10000',
    category: 'inquiry',
    status: 'open',
    preview: '제품에 일본어 매뉴얼만 있나요? 한글 설명서가 필요합니다.',
  },
  {
    id: 'CS-2186',
    receivedAt: '2026-04-26T22:51:00+09:00',
    channel: 'coupang',
    buyerName: '박정훈',
    productTitle: 'Sony WH-1000XM5',
    category: 'return',
    status: 'open',
    preview: '제품 색상이 다릅니다. 반품 가능한가요?',
  },
  {
    id: 'CS-2185',
    receivedAt: '2026-04-26T19:14:00+09:00',
    channel: 'coupang',
    buyerName: '최서연',
    productTitle: 'ユニクロ ヒートテック',
    category: 'inquiry',
    status: 'open',
    preview: '사이즈 문의입니다. M사이즈 한국 사이즈로 95에 맞나요?',
  },
  {
    id: 'CS-2184',
    receivedAt: '2026-04-26T15:02:00+09:00',
    channel: 'coupang',
    buyerName: '정하늘',
    productTitle: 'Pokemon ぬいぐるみ',
    category: 'shipping',
    status: 'human_replied',
    preview: '주문 후 일주일째 배송 중인데 아직 도착하지 않았습니다.',
  },
];

// 受注（Coupangのみ）
export type Order = {
  id: string;
  orderedAt: string;
  externalOrderId: string;
  buyerName: string;
  productTitle: string;
  qty: number;
  totalKrw: number;
  pccc: string;
  status: 'new' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
};

export const orders: Order[] = [
  {
    id: 'O-1042',
    orderedAt: '2026-04-24T08:42:11+09:00',
    externalOrderId: 'CP-OR-2026042400142',
    buyerName: '김민수',
    productTitle: 'ナイキ エアマックス 90 ホワイト 27cm',
    qty: 1,
    totalKrw: 162900,
    pccc: 'P012345678901',
    status: 'new',
  },
  {
    id: 'O-1041',
    orderedAt: '2026-04-24T07:11:32+09:00',
    externalOrderId: 'CP-OR-2026042400138',
    buyerName: '이지은',
    productTitle: 'Anker PowerCore 10000',
    qty: 2,
    totalKrw: 65600,
    pccc: 'P998877665544',
    status: 'confirmed',
  },
  {
    id: 'O-1040',
    orderedAt: '2026-04-23T22:51:01+09:00',
    externalOrderId: 'CP-OR-2026042300988',
    buyerName: '박정훈',
    productTitle: 'Sony WH-1000XM5',
    qty: 1,
    totalKrw: 459800,
    pccc: 'P445566778899',
    status: 'shipped',
  },
  {
    id: 'O-1039',
    orderedAt: '2026-04-23T19:14:55+09:00',
    externalOrderId: 'CP-OR-2026042300821',
    buyerName: '최서연',
    productTitle: 'ユニクロ ヒートテック',
    qty: 3,
    totalKrw: 49500,
    pccc: 'P102030405060',
    status: 'shipped',
  },
  {
    id: 'O-1038',
    orderedAt: '2026-04-23T15:02:08+09:00',
    externalOrderId: 'CP-OR-2026042300714',
    buyerName: '정하늘',
    productTitle: 'Pokemon ぬいぐるみ ピカチュウ',
    qty: 1,
    totalKrw: 35200,
    pccc: 'P778899001122',
    status: 'delivered',
  },
  {
    id: 'O-1037',
    orderedAt: '2026-04-23T11:45:18+09:00',
    externalOrderId: 'CP-OR-2026042300712',
    buyerName: '강현우',
    productTitle: '無印良品 アロマディフューザー',
    qty: 1,
    totalKrw: 98900,
    pccc: 'P334455667788',
    status: 'cancelled',
  },
];

// 加盟店（本部用）
export type Tenant = {
  id: string;
  name: string;
  plan: 'starter' | 'standard' | 'pro';
  status: 'active' | 'suspended' | 'terminated';
  listingsCount: number;
  monthlyRevenueKrw: number;
  errorRate: number;
  contractEndsAt: string;
};

export const tenants: Tenant[] = [
  {
    id: 'T-001',
    name: 'optimal shop',
    plan: 'pro',
    status: 'active',
    listingsCount: 1284,
    monthlyRevenueKrw: 24_810_000,
    errorRate: 0.8,
    contractEndsAt: '2027-03-31',
  },
  {
    id: 'T-002',
    name: 'Sakura Trading',
    plan: 'standard',
    status: 'active',
    listingsCount: 612,
    monthlyRevenueKrw: 9_240_000,
    errorRate: 1.4,
    contractEndsAt: '2026-12-31',
  },
  {
    id: 'T-003',
    name: 'Kawaii Direct',
    plan: 'starter',
    status: 'active',
    listingsCount: 188,
    monthlyRevenueKrw: 2_140_000,
    errorRate: 2.1,
    contractEndsAt: '2026-09-30',
  },
  {
    id: 'T-004',
    name: 'Tokyo Mart KR',
    plan: 'standard',
    status: 'suspended',
    listingsCount: 421,
    monthlyRevenueKrw: 0,
    errorRate: 0,
    contractEndsAt: '2026-08-15',
  },
  {
    id: 'T-005',
    name: 'Osaka Wholesale',
    plan: 'pro',
    status: 'active',
    listingsCount: 1810,
    monthlyRevenueKrw: 32_550_000,
    errorRate: 0.5,
    contractEndsAt: '2027-06-30',
  },
];

// 翻訳エディタ用
export const untranslated = listings.slice(0, 5).map((l) => ({
  id: l.id,
  titleJa: l.titleJa,
  titleKoSuggest: l.titleKo,
  charCount: l.titleKo.length,
}));

// 一括出品ジョブ
export const publishJob = {
  id: 'J-2026-04-25-0042',
  total: 234,
  succeeded: 138,
  warnings: 2,
  failed: 2,
  pending: 92,
  startedAt: '2026-04-24T14:23:01+09:00',
  elapsed: '4分18秒',
  estimatedRemaining: '2分30秒',
  status: 'running' as 'queued' | 'running' | 'paused' | 'succeeded' | 'failed',
  failures: [
    {
      n: 1,
      listingId: 'L-0003',
      product: 'シャープ ヘルシオ ホットクック',
      reason: 'カテゴリ未マッピング',
      action: 'mapping' as const,
    },
    {
      n: 2,
      listingId: 'L-0006',
      product: '無印良品 アロマディフューザー',
      reason: '必須属性「素材」未入力',
      action: 'edit' as const,
    },
  ],
};

// 販売先設定（Coupangのみ）
export const coupangConnection = {
  channel: 'coupang' as Channel,
  label: 'Coupang Wing',
  connected: true,
  lastCheckedAt: '2026-04-24T12:34:00+09:00',
  fields: [
    { key: 'Vendor ID', value: 'A012345', sensitive: false },
    { key: 'Access Key', value: '••••••••••••••••', sensitive: true },
    { key: 'Secret Key', value: '••••••••••••••••', sensitive: true },
  ],
};

// 仕入元設定（Amazon SP-APIのみ）
export const amazonConnection = {
  source: 'amazon' as SourcePlatform,
  label: 'AMAZON-API',
  connected: true,
  lastCheckedAt: '2026-04-24T11:50:00+09:00',
  fields: [
    { key: 'Marketplace ID', value: 'A1VC38T7YXB528 (JP)', sensitive: false },
    { key: 'LWA Client ID', value: 'amzn1.application-oa2-client.•••', sensitive: true },
    { key: 'LWA Client Secret', value: '••••••••••••••••', sensitive: true },
    { key: 'Refresh Token', value: 'Atzr|••••••••••••••••', sensitive: true },
  ],
};

export const marginSettings = {
  defaultRate: 30,
  fxSource: 'Open Exchange Rates' as const,
  fxBuffer: 2.0,
  rounding: 'round_up_100_krw' as
    | 'ceil'
    | 'floor'
    | 'round_up_100_krw'
    | 'round_up_1000_krw',
  categoryOverrides: [
    { category: '家電 / オーディオ', rate: 18 },
    { category: '食品 / コーヒー', rate: 45 },
    { category: 'シューズ / スニーカー', rate: 28 },
  ],
};

export const channelLabel: Record<Channel, string> = {
  coupang: 'Coupang',
  naver: 'NAVER Smartstore',
  '11st': '11번가（11番街）',
};

// 出品先の連携方式（busoken準拠：CoupangはAPI自動、Naver/11stはCSV連携）
export const channelIntegration: Record<Channel, 'api' | 'csv'> = {
  coupang: 'api',
  naver: 'csv',
  '11st': 'csv',
};

export const sourceLabel: Record<SourcePlatform, string> = {
  amazon: 'Amazon',
  rakuten: '楽天市場',
  yahoo: 'Yahoo!ショッピング',
};

// 仕入元の取得方式（busoken準拠：AmazonはASIN自動取得、楽天/Yahooは手動取得）
export const sourceAcquisition: Record<SourcePlatform, 'auto' | 'manual'> = {
  amazon: 'auto',
  rakuten: 'manual',
  yahoo: 'manual',
};

export const sourceBadgeVariant: Record<
  SourcePlatform,
  'muted' | 'info' | 'warning' | 'secondary'
> = {
  amazon: 'secondary',
  rakuten: 'info',
  yahoo: 'warning',
};

export const statusLabel: Record<ListingStatus, string> = {
  draft: '下書き',
  pending: '出品待ち',
  approved: '承認済み',
  live: '販売中',
  rejected: '却下',
  suspended: '停止',
};

export const statusColor: Record<
  ListingStatus,
  'muted' | 'info' | 'success' | 'warning' | 'destructive' | 'secondary'
> = {
  draft: 'muted',
  pending: 'info',
  approved: 'secondary',
  live: 'success',
  rejected: 'destructive',
  suspended: 'warning',
};

// ── 仕入元 追加チャネル（busoken準拠：楽天=手動／Yahoo!=手動）───────────────
export type SourceConnection = {
  source: SourcePlatform;
  label: string;
  connected: boolean;
  acquisition: 'auto' | 'manual';
  lastCheckedAt: string;
  fields: { key: string; value: string; sensitive: boolean }[];
  note: string;
};

export const rakutenConnection: SourceConnection = {
  source: 'rakuten',
  label: '楽天市場（楽天商品検索API）',
  connected: true,
  acquisition: 'manual',
  lastCheckedAt: '2026-04-24T10:05:00+09:00',
  fields: [
    { key: 'Application ID', value: '102••••••••••••••', sensitive: true },
    { key: 'Affiliate ID', value: '（未設定）', sensitive: false },
  ],
  note: '楽天は商品URL／商品コードを手動入力 → 楽天商品検索APIで詳細を取得します。ASINのような自動収集はありません。',
};

export const yahooConnection: SourceConnection = {
  source: 'yahoo',
  label: 'Yahoo!ショッピング（商品検索API）',
  connected: false,
  acquisition: 'manual',
  lastCheckedAt: '—',
  fields: [
    { key: 'Client ID (アプリケーションID)', value: '（未設定）', sensitive: true },
  ],
  note: 'Yahoo!は商品URLを手動入力 → ItemSearch APIで詳細を取得します。未接続のため接続テストで疎通確認してください。',
};

export const sourceConnections: SourceConnection[] = [
  rakutenConnection,
  yahooConnection,
];

// ── 出品先 CSV連携チャネル（busoken準拠：NAVER／11番街 はCSV連携）─────────
export type CsvChannelConnection = {
  channel: Channel;
  label: string;
  connected: boolean;
  lastExportAt: string;
  exportedCount: number;
  csvSpec: string;
  note: string;
};

export const csvChannelConnections: CsvChannelConnection[] = [
  {
    channel: 'naver',
    label: 'NAVER Smartstore',
    connected: true,
    lastExportAt: '2026-04-26T18:20:00+09:00',
    exportedCount: 412,
    csvSpec: '스마트스토어 대량등록 양식 v3（원산지・제조사・A/S정보 必須）',
    note: 'NAVERはCSV一括登録方式。Compassが스마트스토어 양식に整形したCSVを出力 → 판매자센터から取込。',
  },
  {
    channel: '11st',
    label: '11번가（11番街）',
    connected: true,
    lastExportAt: '2026-04-25T14:02:00+09:00',
    exportedCount: 263,
    csvSpec: '11번가 대량상품등록 엑셀（displayCategoryNo・sellerPrdCd 必須）',
    note: '11번가もCSV一括登録方式。displayCategoryNoのマッピング後にCSVを出力 → 셀러오피스から取込。',
  },
];

// ── 禁止ワード辞書（busoken準拠：禁止ワード機能）──────────────────────────
export type NgKeyword = {
  id: string;
  keyword: string;
  action: 'block' | 'replace';
  replaceWith?: string;
  scope: 'title' | 'description' | 'all';
  reason: string;
  hits: number;
};

export const ngKeywords: NgKeyword[] = [
  { id: 'NG-01', keyword: '正規品', action: 'block', scope: 'all', reason: '真贋トラブル誘発・Coupang規約抵触', hits: 38 },
  { id: 'NG-02', keyword: '最安値', action: 'block', scope: 'title', reason: '景表法（最大級表現）リスク', hits: 21 },
  { id: 'NG-03', keyword: '完全', action: 'replace', replaceWith: '', scope: 'title', reason: '誇大表現の抑制', hits: 12 },
  { id: 'NG-04', keyword: '医薬品', action: 'block', scope: 'all', reason: '韓国通関：医薬品は出品不可カテゴリ', hits: 7 },
  { id: 'NG-05', keyword: '並行輸入', action: 'replace', replaceWith: '해외구매대행', scope: 'description', reason: 'バイヤー誤認防止・韓国側表現に統一', hits: 54 },
  { id: 'NG-06', keyword: '日本製', action: 'replace', replaceWith: '일본정품', scope: 'title', reason: '韓国バイヤー向け訴求語へ統一', hits: 96 },
];

// ── ASINブラックリスト（busoken準拠：ASINブラックリスト機能）──────────────
export type BlacklistEntry = {
  id: string;
  source: SourcePlatform;
  code: string; // ASIN / 楽天商品コード / Yahoo商品ID
  title: string;
  reason: string;
  addedAt: string;
  addedBy: string;
};

export const asinBlacklist: BlacklistEntry[] = [
  { id: 'BL-018', source: 'amazon', code: 'B07RIFLE99', title: 'エアソフトガン 電動ガン M4', reason: '武器類：韓国輸入不可', addedAt: '2026-04-20', addedBy: 'optimal_shop' },
  { id: 'BL-017', source: 'amazon', code: 'B08SUPP123', title: '海外サプリメント 高濃度ビタミン', reason: '健康食品：通関リスク高', addedAt: '2026-04-18', addedBy: 'optimal_shop' },
  { id: 'BL-016', source: 'rakuten', code: 'RK-knife-7720', title: 'アウトドアナイフ 刃渡り15cm', reason: '刃物：規制対象', addedAt: '2026-04-15', addedBy: 'optimal_shop' },
  { id: 'BL-015', source: 'amazon', code: 'B09DRONE01', title: 'ドローン 4Kカメラ付き', reason: '電波法/航空法：KC未対応', addedAt: '2026-04-12', addedBy: 'optimal_shop' },
  { id: 'BL-014', source: 'yahoo', code: 'YH-perfume-55', title: 'インポート香水 100ml', reason: '化粧品扱い：通関書類が重い', addedAt: '2026-04-09', addedBy: 'optimal_shop' },
];

// ── 知財警告ブランドDB（busoken準拠：知財警告ブランドデータベース）────────
export type IpBrand = {
  id: string;
  brand: string;
  level: 'prohibited' | 'restricted';
  reason: string;
  source: '本部共有' | '自社追加';
  updatedAt: string;
};

export const ipWarningBrands: IpBrand[] = [
  { id: 'IP-31', brand: 'Nintendo / 任天堂', level: 'prohibited', reason: '知財権利者からの警告実績あり。出品不可。', source: '本部共有', updatedAt: '2026-04-22' },
  { id: 'IP-30', brand: 'Pokemon / ポケモン', level: 'restricted', reason: '正規ライセンス品のみ可。グッズ全般は要確認。', source: '本部共有', updatedAt: '2026-04-22' },
  { id: 'IP-29', brand: 'Nike', level: 'restricted', reason: '真贋審査が厳しい。並行品の警告事例あり。', source: '本部共有', updatedAt: '2026-04-19' },
  { id: 'IP-28', brand: 'SONY', level: 'restricted', reason: '電子機器はKC・知財の二重リスク。要個別判断。', source: '自社追加', updatedAt: '2026-04-17' },
  { id: 'IP-27', brand: 'Disney', level: 'prohibited', reason: 'ライセンス管理が厳格。出品不可。', source: '本部共有', updatedAt: '2026-04-10' },
];

// listings の brand と知財DB を突合するためのマップ（モック）
export const ipBrandLevelByName: Record<string, IpBrand['level']> = {
  Nike: 'restricted',
  Pokemon: 'restricted',
  Sony: 'restricted',
};

// ── Instagram投稿データ生成（busoken準拠：Instagram投稿データ作成）────────
export const instagramHashtagPool = [
  '#일본직구', '#해외직구', '#일본구매대행', '#직구추천', '#일본쇼핑',
  '#가성비템', '#일본정품', '#배송대행', '#직구꿀템', '#일본브랜드',
];

export type InstagramPostDraft = {
  listingId: string;
  caption: string;
  hashtags: string[];
  imageUrl: string;
};
