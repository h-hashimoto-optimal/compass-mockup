// Compass 実DB（Postgres）スキーマ。マルチテナント＋招待制認証＋多モール対応。
// 設計: 越境ECフランチャイズ > Compass 認証＋インフラ/DB アーキテクチャ設計書
import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  jsonb,
  bigserial,
  numeric,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';

// 加盟店（テナント）
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  status: text('status').notNull().default('active'), // active | suspended
  plan: text('plan'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ユーザー（owner=本部 は tenant_id NULL）
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'), // 招待受諾までは NULL
    fullName: text('full_name'),
    role: text('role').notNull(), // owner | tenant_admin | member | operator
    status: text('status').notNull().default('invited'), // invited | active | suspended
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('users_tenant_idx').on(t.tenantId),
  }),
);

// 招待（本部が発行 → 加盟者がトークンでPW設定）
export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull().default('tenant_admin'),
    tokenHash: text('token_hash').notNull(), // 生トークンはメール/URL、DBはSHA-256
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenIdx: uniqueIndex('invitations_token_idx').on(t.tokenHash),
    tenantIdx: index('invitations_tenant_idx').on(t.tenantId),
  }),
);

// セッション（生トークンはCookie、DBはハッシュ）
// impersonatedTenantId: 本部の代理ログイン用（将来）。通常は NULL。
export const sessions = pgTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    impersonatedTenantId: uuid('impersonated_tenant_id').references(() => tenants.id, {
      onDelete: 'set null',
    }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('sessions_user_idx').on(t.userId),
    expiresIdx: index('sessions_expires_idx').on(t.expiresAt),
  }),
);

export type Tenant = typeof tenants.$inferSelect;
export type User = typeof users.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type Session = typeof sessions.$inferSelect;

// ───────────────────────────────────────────────────────────
// 商品ドメイン（多モール対応：仕入元 source × 販売チャネル channel）
// §D: 金額=整数 / 一意制約で冪等 / ソフト削除 / tenant_id（RLSは後続）
// ───────────────────────────────────────────────────────────

// 仕入元の商品（amazon/rakuten/yahoo/mercari…）。全社共通＝重複排除。クロール対象。
export const sourceProducts = pgTable(
  'source_products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: text('source').notNull(), // amazon / rakuten / yahoo / mercari
    sourceProductId: text('source_product_id').notNull(), // ASIN / 商品コード / itemId
    url: text('url'),
    lastPriceJpy: integer('last_price_jpy'), // 円・整数
    lastInStock: boolean('last_in_stock'),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    nextCheckAt: timestamp('next_check_at', { withTimezone: true }),
    tier: text('tier').notNull().default('warm'), // hot / warm / cold
    raw: jsonb('raw'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sourceUq: uniqueIndex('source_products_source_id_uq').on(t.source, t.sourceProductId),
    nextCheckIdx: index('source_products_next_check_idx').on(t.nextCheckAt),
  }),
);

// 販売出品（coupang/naver/11st…）。テナント×仕入商品×チャネル。
export const channelListings = pgTable(
  'channel_listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    sourceProductId: uuid('source_product_id')
      .notNull()
      .references(() => sourceProducts.id, { onDelete: 'cascade' }),
    ingestBatchId: uuid('ingest_batch_id').references(() => ingestBatches.id, {
      onDelete: 'set null',
    }), // 取得グループ（拡張1回分）。手動追加はnull
    channel: text('channel').notNull(), // coupang / naver / 11st
    channelProductId: text('channel_product_id'),
    channelItemId: text('channel_item_id'), // coupang vendorItemId 等（停止/再開に使用）
    titleJa: text('title_ja'),
    titleTranslated: text('title_translated'),
    listPrice: integer('list_price'), // チャネル通貨・整数
    listCurrency: text('list_currency').notNull().default('KRW'),
    sourcePriceJpyAtList: integer('source_price_jpy_at_list'),
    floorPriceJpy: integer('floor_price_jpy'), // 赤字下限（円）
    status: text('status').notNull().default('draft'), // draft/pending/live/stopped/rejected/deleted/error
    rejectedReason: text('rejected_reason'),
    channelMeta: jsonb('channel_meta'), // チャネル固有（고시정보/원산지/A/S 等）
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }), // ソフト削除
  },
  (t) => ({
    // ソフト削除を除外した部分ユニーク（論理削除→再出品で詰まらない）
    uq: uniqueIndex('channel_listings_uq')
      .on(t.tenantId, t.sourceProductId, t.channel)
      .where(sql`${t.deletedAt} is null`),
    tenantStatusIdx: index('channel_listings_tenant_status_idx').on(t.tenantId, t.status),
    sourceIdx: index('channel_listings_source_idx').on(t.sourceProductId),
  }),
);

// 価格/在庫の履歴（仕入元単位。変化時のみ。P3でバッチ前に月パーティション化）
export const priceEvents = pgTable(
  'price_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    sourceProductId: uuid('source_product_id').notNull(),
    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
    sourcePriceJpy: integer('source_price_jpy'),
    sourceInStock: boolean('source_in_stock'),
  },
  (t) => ({ srcTimeIdx: index('price_events_source_time_idx').on(t.sourceProductId, t.checkedAt) }),
);

// アラート（テナント）：欠品＝仕入元単位 / 赤字＝出品単位
export const alerts = pgTable(
  'alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    channelListingId: uuid('channel_listing_id').references(() => channelListings.id, {
      onDelete: 'cascade',
    }),
    sourceProductId: uuid('source_product_id'),
    type: text('type').notNull(), // price_up_loss / out_of_stock
    detail: jsonb('detail'),
    status: text('status').notNull().default('open'), // open / ack / resolved
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ tenantStatusIdx: index('alerts_tenant_status_idx').on(t.tenantId, t.status) }),
);

// ジョブキュー（FOR UPDATE SKIP LOCKED で並列）
export const jobs = pgTable(
  'jobs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    type: text('type').notNull(),
    tenantId: uuid('tenant_id'),
    payload: jsonb('payload'),
    status: text('status').notNull().default('queued'),
    attempts: integer('attempts').notNull().default(0),
    runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ dueIdx: index('jobs_due_idx').on(t.status, t.runAt) }),
);

// 為替（日次）。レートはnumeric（floatを避ける）
export const fxRates = pgTable('fx_rates', {
  date: text('date').primaryKey(), // YYYY-MM-DD
  jpyToKrw: numeric('jpy_to_krw', { precision: 12, scale: 6 }),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── テナント別の連携・設定 ──

// API鍵/連携（多チャネル汎用。kind＝coupang/naver/11st/amazon_spapi/rakuten/yahoo…）。暗号化保存
export const tenantIntegrations = pgTable(
  'tenant_integrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    label: text('label'),
    secretsEnc: text('secrets_enc'), // 暗号化JSON（複数キーをまとめて）
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ kindUq: uniqueIndex('tenant_integrations_kind_uq').on(t.tenantId, t.kind) }),
);

// 設定（仕入側：利益率・為替バッファ・国内送料）
export const tenantSettings = pgTable('tenant_settings', {
  tenantId: uuid('tenant_id')
    .primaryKey()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  marginRate: numeric('margin_rate', { precision: 6, scale: 4 }).notNull().default('0.25'),
  fxBuffer: numeric('fx_buffer', { precision: 6, scale: 4 }).notNull().default('0.03'),
  domesticShippingJpy: integer('domestic_shipping_jpy').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 設定（販売側：チャネルごとの手数料・丸め・通貨）
export const tenantChannelSettings = pgTable(
  'tenant_channel_settings',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(),
    sellFeeRate: numeric('sell_fee_rate', { precision: 6, scale: 4 }).notNull().default('0.11'),
    priceRounding: integer('price_rounding').notNull().default(10),
    currency: text('currency').notNull().default('KRW'),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.tenantId, t.channel] }) }),
);

// 禁止ワード辞書（テナント別。block=除外 / replace=置換）
export const ngWords = pgTable(
  'ng_words',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    word: text('word').notNull(),
    mode: text('mode').notNull().default('block'),
    replacement: text('replacement'),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ tenantWordUq: uniqueIndex('ng_words_tenant_word_uq').on(t.tenantId, t.word) }),
);

// 仕入ブラックリスト（多モール。取込時に自動除外）
export const sourceBlacklist = pgTable(
  'source_blacklist',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    sourceProductId: text('source_product_id').notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uq: uniqueIndex('source_blacklist_uq').on(t.tenantId, t.source, t.sourceProductId),
  }),
);

// 知財警告ブランドDB（tenant_id NULL=本部共有 / 非NULL=自社追加）
export const ipBrands = pgTable(
  'ip_brands',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    brand: text('brand').notNull(),
    level: text('level').notNull().default('warn'), // warn / block
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ tenantIdx: index('ip_brands_tenant_idx').on(t.tenantId) }),
);

// Chrome拡張用のテナント別トークン（拡張からの取込認証）。生トークンはハッシュ保存。
export const tenantTokens = pgTable(
  'tenant_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    label: text('label'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenUq: uniqueIndex('tenant_tokens_token_idx').on(t.tokenHash),
    tenantIdx: index('tenant_tokens_tenant_idx').on(t.tenantId),
  }),
);

// ASIN取得グループ（拡張の1回分の収集＝検索語＋取得日時で束ねる）。受信トレイの管理単位。
export const ingestBatches = pgTable(
  'ingest_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    source: text('source').notNull().default('amazon'),
    query: text('query'), // 検索キーワード（商品ページ取得なら空）
    url: text('url'), // 取得元URL
    capturedAt: timestamp('captured_at', { withTimezone: true }),
    itemCount: integer('item_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ tenantIdx: index('ingest_batches_tenant_idx').on(t.tenantId, t.createdAt) }),
);

// 受注（販売チャネルからの注文。Coupang注文API連携後に同期）
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(),
    channelOrderId: text('channel_order_id').notNull(),
    status: text('status').notNull().default('new'),
    buyerName: text('buyer_name'),
    totalAmount: integer('total_amount'),
    currency: text('currency').notNull().default('KRW'),
    orderedAt: timestamp('ordered_at', { withTimezone: true }),
    raw: jsonb('raw'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uq: uniqueIndex('orders_uq').on(t.tenantId, t.channel, t.channelOrderId),
    tenantIdx: index('orders_tenant_status_idx').on(t.tenantId, t.status),
  }),
);

// 監視設定（テナント別。scanAlertsのしきい値・通知先）
export const tenantMonitoringSettings = pgTable('tenant_monitoring_settings', {
  tenantId: uuid('tenant_id')
    .primaryKey()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  detectLoss: boolean('detect_loss').notNull().default(true),
  detectOos: boolean('detect_oos').notNull().default(true),
  // floor*(1-buffer) を仕入値が超えたら赤字（予備軍）として検知。0=実赤字のみ
  lossBufferPct: numeric('loss_buffer_pct', { precision: 6, scale: 4 }).notNull().default('0'),
  notifyEmail: boolean('notify_email').notNull().default(false),
  notifyChatwork: boolean('notify_chatwork').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Order = typeof orders.$inferSelect;
export type IngestBatch = typeof ingestBatches.$inferSelect;
export type TenantMonitoringSettings = typeof tenantMonitoringSettings.$inferSelect;
export type TenantToken = typeof tenantTokens.$inferSelect;
export type SourceProduct = typeof sourceProducts.$inferSelect;
export type ChannelListing = typeof channelListings.$inferSelect;
export type PriceEvent = typeof priceEvents.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type FxRate = typeof fxRates.$inferSelect;
export type TenantIntegration = typeof tenantIntegrations.$inferSelect;
export type TenantSettings = typeof tenantSettings.$inferSelect;
export type TenantChannelSettings = typeof tenantChannelSettings.$inferSelect;
export type NgWord = typeof ngWords.$inferSelect;
export type SourceBlacklist = typeof sourceBlacklist.$inferSelect;
export type IpBrand = typeof ipBrands.$inferSelect;
