// Compass 実DB（Postgres）スキーマ。マルチテナント＋招待制認証。
// 設計: 越境ECフランチャイズ > Compass 認証＋インフラ/DB アーキテクチャ設計書
import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
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
