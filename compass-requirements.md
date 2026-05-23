# Compass - 韓国越境EC自動化SaaS 要件定義書

**Version:** 1.0
**Target:** Claude Code による実装
**Stack:** Next.js 14 (App Router) + TypeScript + Supabase + Tailwind CSS + shadcn/ui

---

## 1. プロジェクト概要

### 1.1 目的
日本のEC仕入元（Amazon.co.jp、楽天、Yahoo!ショッピング等）から商品データを自動収集し、韓国の主要ECプラットフォーム（Coupang、Naver Smart Store、11st）へ自動出品・在庫同期・受注管理を行うSaaS型ツール。フランチャイズ加盟店が各自のアカウントで利用する。

### 1.2 ビジネスモデル
- **本部（Owner）**：フランチャイズ本部。全加盟店を横断管理。
- **加盟店（Tenant）**：各事業者。自社の仕入・販売データを運用。
- **加盟店スタッフ（Member）**：加盟店に所属する運用担当者。
- **外注（Operator）**：翻訳・画像加工等の限定機能のみアクセス可。

### 1.3 対応チャネル

| 販路 | 種別 | API | 備考 |
|------|------|-----|------|
| 仕入 | Amazon.co.jp | SP-API / スクレイピング | ASIN軸 |
| 仕入 | 楽天市場 | 楽天商品検索API | - |
| 仕入 | Yahoo!ショッピング | Yahoo!商品検索API | - |
| 販売 | Coupang | Coupang Wing OpenAPI | Vendor ID必須 |
| 販売 | Naver Smart Store | Naver Commerce API | - |
| 販売 | 11st (십일번가) | 11st Open API | - |

---

## 2. システム構成

### 2.1 アーキテクチャ
```
[Next.js Frontend (Vercel)]
        ↓
[Next.js Route Handlers / Server Actions]
        ↓
[Supabase (Auth / Postgres / Storage / RLS)]
        ↓
[Background Workers (Vercel Cron + Supabase Edge Functions)]
        ↓
[External APIs: Amazon/楽天/Yahoo/Coupang/Naver/11st/DeepL/為替API]
```

### 2.2 マルチテナント方式
- **Row Level Security (RLS)** による論理分離。
- 全テーブルに `tenant_id` を保持し、Supabase RLSポリシーで強制フィルタ。
- 本部ユーザーは `is_owner = true` で全テナント横断クエリ可能。

---

## 3. ユーザー・権限モデル

### 3.1 ロール

| ロール | 権限範囲 |
|--------|----------|
| `owner` | 全テナント閲覧、加盟店CRUD、課金管理、監査ログ閲覧 |
| `tenant_admin` | 自テナント全機能、メンバー招待、API鍵管理、設定変更 |
| `tenant_member` | 商品管理、出品、受注処理（設定変更不可） |
| `tenant_operator` | 翻訳・画像加工・商品名編集のみ |

### 3.2 認証
- Supabase Auth（メール+パスワード / Googleログイン）
- 2FA（TOTP）対応必須（本部・テナント管理者）
- 招待制オンボーディング（招待トークン方式）

---

## 4. 機能要件

### 4.1 ダッシュボード（HOME）
**目的：運用状況の一覧把握**

- KPIカード：本日の出品数 / 総出品数 / 販売中 / 出品待ち / エラー件数 / 本日の受注数 / 本日の売上（KRW・JPY）
- 直近30日の売上推移チャート
- エラー通知リスト（API失敗・翻訳失敗・在庫切れ等）
- 為替レート表示（JPY/KRW）
- お知らせ領域（本部からの通達）

### 4.2 商品データ収集

#### 4.2.1 データ収集ソース設定
- 仕入元URL、ASIN、商品IDのバルク入力
- CSVアップロードによる一括登録
- Chrome拡張連携（将来実装、仕様は別途）

#### 4.2.2 収集対象データ
- 商品名、ブランド、JAN/ASIN、カテゴリ
- 価格（税込・税抜）、在庫状況
- 画像URL（メイン + サブ最大10枚）
- 商品説明HTML
- スペック属性（サイズ・重量・素材等）
- レビュー数・評価（参考情報）

#### 4.2.3 収集ジョブ
- 即時実行 / スケジュール実行（日次・時次）
- ジョブキュー（Supabase `jobs` テーブル + Edge Function worker）
- 失敗時3回リトライ、失敗ログ保存

### 4.3 出品商品管理

#### 4.3.1 商品一覧
- ページング（20/50/100件）
- フィルタ：出品ステータス / 販路 / 仕入元 / カテゴリ / 価格帯 / 登録日
- ソート：登録日 / 更新日 / 価格 / 利益額 / 利益率
- 一括選択 → 一括操作（出品・削除・編集・エクスポート）
- 検索：商品名・SKU・ASIN・クーポンID部分一致

#### 4.3.2 商品詳細
- 基本情報 / 仕入元情報 / 販売先情報（チャネル別タブ）
- 画像ギャラリー（並び替え・差し替え・削除）
- 原文（日本語）と翻訳文（韓国語）の左右比較エディタ
- 価格シミュレーション（原価 + 関税 + VAT + 送料 + 利益率 = 販売価格）

#### 4.3.3 フィルタ・ソートテンプレート管理
- ユーザーごとに検索条件を保存・再利用
- テナント内で共有可否フラグ

#### 4.3.4 削除防止商品ID管理
- 主力商品を誤操作・一括処理から除外するホワイトリスト
- 一括削除時は必ず除外対象として扱う

### 4.4 翻訳・商品情報編集

#### 4.4.1 未翻訳一括更新
- DeepL API / Google Translate API 連携
- 翻訳対象：商品名 / 説明 / 属性値
- 翻訳メモリ（過去の翻訳を再利用しAPI費用削減）
- 禁止ワード置換辞書（商標・規制ワードを自動置換／除去）
- 翻訳失敗商品の再試行キュー

#### 4.4.2 商品名一括編集
- 正規表現による置換
- プレフィックス／サフィックス付与（SEOキーワード）
- テンプレート：`{ブランド} {商品名} {カラー} [당일발송]` 形式
- 変更前後のプレビュー → 承認後に反映

#### 4.4.3 仕入元商品情報一括更新
- 仕入元の最新価格・在庫を再取得し同期
- 差分サマリ（価格変動率 / 在庫変動）
- 自動リプライスのトリガー

### 4.5 出品データ生成・一括出品

#### 4.5.1 Coupang出品
- 出品データ一括作成：カテゴリ必須属性の自動マッピング
- Coupang Wing API経由で一括出品
- バーコード（JAN→Coupang barcode）変換
- カテゴリマッピングテーブル（日本カテゴリ↔Coupangカテゴリ）
- 出品ステータス：`draft / pending / approved / rejected / live / suspended`
- 却下理由の自動パース＆表示

#### 4.5.2 Naver Smart Store出品（PIB）
- Naver Commerce API経由
- スマートストア固有の必須項目：원산지（原産地）、제조사（製造社）、A/S 정보
- 카테고리ID必須

#### 4.5.3 11st出品（PIB）
- 11st Open API経由
- displayCategoryNo、sellerPrdCd、taxTypCd等の固有項目

#### 4.5.4 共通
- 出品前バリデーション（必須項目／文字数／画像サイズ）
- ドライラン（API送信せずにペイロードを確認）
- 送信ログ保存（request/response をS3/Supabase Storage）
- 失敗時の個別再送信

### 4.6 在庫・価格同期

#### 4.6.1 在庫同期ジョブ
- 仕入元在庫を時次／日次でポーリング
- 在庫切れ → 各販路で出品停止
- 在庫復活 → 自動再開（設定で無効化可）

#### 4.6.2 自動リプライス
- ルール例：
  - 仕入価格変動 > 5% で自動再計算
  - 為替レート変動 > 3% で自動再計算
  - 競合最安値 - X% の追従（オプション）
- 下限価格ガード（赤字防止）
- 改定履歴の保存

#### 4.6.3 出品商品データ一括更新
- CSVインポート／エクスポート
- 価格・在庫・タイトル・画像URLの一括変更
- 差分のみAPI送信（レート制限対策）

### 4.7 受注・配送管理（追加提案）

#### 4.7.1 受注取り込み
- 各販路APIから注文を定期取得
- 注文ステータス：`new / confirmed / shipped / delivered / cancelled / returned`
- 注文統合ビュー（販路横断）

#### 4.7.2 配送手配
- 配送業者連携（CJ대한통운、한진택배等）— 将来拡張
- PCCC（個人通関固有符号）の必須チェック
- 追跡番号の自動登録

#### 4.7.3 CS・レビュー管理
- Q&A一元受信 → DeepL翻訳 → 返信テンプレート
- 低評価レビューのアラート

### 4.8 各種設定

#### 4.8.1 在庫・価格管理定義設定
- 在庫閾値（0 / 1 / 3 / カスタム）
- 価格改定ルール（手動 / 自動 / 半自動）
- 為替バッファ率

#### 4.8.2 仕入元設定
- 仕入元アカウント（Amazon SP-API Refresh Token、楽天APP ID等）
- プロキシ設定（スクレイピング用）
- クロール頻度

#### 4.8.3 利益設定
- 利益率（%）／利益額（固定）のどちらか
- カテゴリ別の利益率上書き
- 為替レート取得元（手動固定 / Open Exchange Rates等API）
- 為替安全マージン（例：実レート +2%）

#### 4.8.4 送料設定
- 重量帯別 / サイズ帯別
- 販路別
- 韓国国内配送込みパターン

#### 4.8.5 販売先設定
- Coupang Vendor ID、Access Key、Secret Key
- Naver Commerce API認証情報
- 11st API Key
- 接続テストボタン

#### 4.8.6 NG商品・禁制品フィルタ
- 韓国輸入禁止カテゴリ（食品・化粧品・医薬品・電波機器等）
- キーワードブラックリスト
- ブランド制限リスト（正規代理店必須ブランド）

### 4.9 フランチャイズ運営機能（本部専用）

#### 4.9.1 加盟店管理
- 加盟店CRUD、契約プラン、契約期間、ステータス（`active / suspended / terminated`）
- 加盟店ごとの利用状況ダッシュボード（出品数・売上・エラー率）

#### 4.9.2 売上・粗利レポート
- 加盟店別 / 期間別 / 販路別
- CSVエクスポート
- 本部ロイヤリティ計算（売上連動 or 定額）

#### 4.9.3 課金・プラン管理
- プラン：出品上限数、API呼出上限、同時ジョブ数
- 使用量メーター
- 請求書発行（Stripe連携想定、v2）

#### 4.9.4 お知らせ配信
- 全加盟店 / 特定加盟店へのメッセージ送信

#### 4.9.5 マニュアル・オンボーディング
- Notion風のマニュアル内蔵（Markdownベース）
- オンボーディングチェックリスト（API接続・最初の出品・決済等）

### 4.10 ログ・監査・通知

- **監査ログ**：全ての変更操作（誰が・いつ・何を）
- **APIコールログ**：外部API呼出の履歴（レート制限管理にも利用）
- **エラー通知**：Slack / LINE / メール（テナント単位で設定）
- **ジョブ実行履歴**：成功・失敗・所要時間

---

## 5. 非機能要件

| 項目 | 要件 |
|------|------|
| 可用性 | 月間稼働率 99.5% |
| 性能 | 商品一覧は100件を1秒以内で表示 / 一括出品1000件を10分以内 |
| セキュリティ | API鍵はSupabase Vault / pgcryptoで暗号化保存 |
| セキュリティ | RLS必須、service_role keyはサーバーサイドのみ |
| 国際化 | UI日本語/韓国語切替（i18n: next-intl） |
| レスポンシブ | PC優先、タブレット閲覧可能 |
| バックアップ | Supabase日次バックアップ + 重要テーブルの週次エクスポート |
| ログ保持 | 監査ログ2年、APIログ90日 |
| レート制限 | 外部API別にトークンバケット実装 |

---

## 6. データモデル（主要テーブル）

```sql
-- テナント
tenants (id, name, plan, status, owner_email, created_at, ...)

-- ユーザー（auth.users を拡張）
profiles (id, tenant_id, role, full_name, email, is_owner, totp_enabled, ...)

-- 仕入元商品（原本）
source_products (
  id, tenant_id, source_platform, source_id, source_url,
  title_ja, description_ja, price_jpy, stock, images jsonb,
  attributes jsonb, last_crawled_at, ...
)

-- 出品商品（販路横断の親レコード）
listings (
  id, tenant_id, source_product_id, status,
  title_ko, description_ko, price_krw, margin_rate,
  is_protected boolean, -- 削除防止フラグ
  created_at, updated_at
)

-- 販路別出品
channel_listings (
  id, listing_id, channel, -- 'coupang' | 'naver' | '11st'
  external_id, -- クーポンID / 상품번호 等
  status, category_id, payload jsonb,
  last_synced_at, last_error text
)

-- 注文
orders (
  id, tenant_id, channel, external_order_id,
  buyer_name, shipping_address jsonb, pccc,
  total_krw, status, ordered_at, ...
)

order_items (id, order_id, channel_listing_id, qty, price_krw)

-- ジョブ
jobs (
  id, tenant_id, type, status, payload jsonb,
  result jsonb, attempts, scheduled_at, started_at, finished_at
)

-- 翻訳メモリ
translation_memory (id, tenant_id, source_text, target_text, lang_pair, usage_count)

-- 設定
tenant_settings (tenant_id, key, value jsonb)

-- API認証情報（暗号化）
channel_credentials (tenant_id, channel, encrypted_payload, updated_at)

-- テンプレート
filter_templates (id, tenant_id, user_id, name, conditions jsonb, is_shared)

-- 削除防止
protected_listings (listing_id, tenant_id, reason, created_by)

-- カテゴリマッピング
category_mappings (id, channel, source_category, target_category_id, confidence)

-- 禁止ワード
ng_keywords (id, tenant_id, keyword, action) -- 'block' | 'replace'

-- 監査ログ
audit_logs (id, tenant_id, actor_id, action, target_type, target_id, diff jsonb, created_at)

-- APIコールログ
api_call_logs (id, tenant_id, channel, endpoint, status_code, latency_ms, created_at)

-- 為替レート
fx_rates (base, quote, rate, source, fetched_at)
```

**RLS ポリシー原則**
- 全テーブル：`tenant_id = auth.jwt() ->> 'tenant_id'` または `is_owner = true`
- `profiles` のみ `id = auth.uid()` も許可

---

## 7. 外部API連携仕様

### 7.1 Coupang Wing OpenAPI
- 認証：HMAC-SHA256署名
- 主要エンドポイント：
  - 商品登録 `POST /v2/providers/seller_api/apis/api/v1/marketplace/seller-products`
  - 商品修正 `PUT`
  - 在庫更新 `PUT /.../inventories`
  - 注文取得 `GET /.../orders`
- レート制限：10 req/sec

### 7.2 Naver Commerce API
- 認証：OAuth2 (Client Credentials)
- 主要エンドポイント：상품 등록 / 주문 조회 / 문의 조회

### 7.3 11st Open API
- 認証：API Key (Header)
- 주요 엔드포인트：상품 등록 / 주문 / 배송

### 7.4 DeepL API
- プラン：Pro / Freeに応じたクォータ管理
- テナント毎のAPIキー

### 7.5 為替レートAPI
- Open Exchange Rates / ExchangeRate-API 等
- 1時間ごとにキャッシュ更新

---

## 8. 技術スタック詳細

| レイヤ | 採用技術 |
|--------|----------|
| フレームワーク | Next.js 14 (App Router, RSC) |
| 言語 | TypeScript (strict) |
| UI | Tailwind CSS + shadcn/ui + lucide-react |
| フォーム | react-hook-form + zod |
| 状態管理 | TanStack Query (サーバー状態) / Zustand (UI状態) |
| DB / Auth | Supabase (Postgres + Auth + Storage + Realtime) |
| バックグラウンド | Supabase Edge Functions + Vercel Cron |
| 監視 | Sentry + Vercel Analytics |
| テスト | Vitest + Playwright |
| E2E翻訳 | DeepL API |
| i18n | next-intl |
| デプロイ | Vercel (Frontend) + Supabase (Backend) |
| CI/CD | GitHub Actions |

---

## 9. 推奨ディレクトリ構成

```
compass/
├── app/
│   ├── (auth)/                 # 認証レイアウト
│   │   ├── login/
│   │   └── signup/
│   ├── (dashboard)/            # アプリ本体レイアウト
│   │   ├── page.tsx            # HOME
│   │   ├── products/           # 商品管理
│   │   ├── listings/           # 出品管理
│   │   ├── orders/             # 受注
│   │   ├── translations/       # 翻訳
│   │   ├── settings/           # 各種設定
│   │   └── admin/              # 本部専用
│   └── api/                    # Route Handlers
├── components/
│   ├── ui/                     # shadcn/ui
│   └── features/               # 機能別コンポーネント
├── lib/
│   ├── supabase/               # クライアント・サーバー分離
│   ├── channels/               # coupang / naver / 11st / amazon / rakuten
│   ├── jobs/                   # ジョブキュー
│   ├── translation/
│   ├── pricing/                # 価格計算・為替
│   └── validation/             # zodスキーマ
├── supabase/
│   ├── migrations/             # SQL
│   ├── functions/              # Edge Functions
│   └── seed.sql
├── types/
├── messages/                   # i18n
│   ├── ja.json
│   └── ko.json
└── tests/
```

---

## 10. 開発フェーズ（推奨ロードマップ）

### Phase 1（MVP / 約6〜8週間）
- 認証・マルチテナント基盤
- 商品データ収集（Amazon.co.jpのみ）
- 翻訳（DeepL）
- Coupang一括出品
- 基本的な在庫・価格同期
- HOMEダッシュボード
- 基本設定画面

### Phase 2（+4週）
- Naver Smart Store対応
- 11st対応
- 楽天・Yahoo仕入対応
- 自動リプライス
- 受注取り込み
- 本部管理画面

### Phase 3（+4週）
- CS・Q&A管理
- レポート機能
- Stripe課金
- 画像加工自動化
- Chrome拡張（別リポジトリ）

---

## 11. Claude Codeへの指示事項

### 11.1 必ず守ること
1. **Supabase RLSを全テーブルで有効化**。テスト時も含めてservice_role_keyはサーバー側のみで使用。
2. **API鍵は必ずSupabase Vaultまたは `pgcrypto` で暗号化**してから保存。平文での`channel_credentials`保存は禁止。
3. **外部API呼出は必ずレート制限ミドルウェアを経由**させる（`lib/channels/rate-limiter.ts`）。
4. **Zodスキーマで全ての入力をバリデーション**。Server Actions、Route Handlers、フォームで共通スキーマを使い回す。
5. **全ての変更操作で`audit_logs`にレコードを作成**（デコレータ or middleware化）。
6. **エラーは `Result<T, E>` パターン**で扱い、throwは境界層のみ。
7. **i18n**：ハードコードされた日本語文字列は禁止。`messages/ja.json`・`messages/ko.json` に集約。
8. **テスト**：主要ビジネスロジック（価格計算・翻訳・カテゴリマッピング）は単体テスト必須。

### 11.2 段階的実装の指示
Claude Codeには以下の順で実装を依頼：
1. Supabaseスキーマ（マイグレーション）とRLS
2. 認証・テナント・プロフィール
3. レイアウト・ナビゲーション・i18n
4. 商品データ収集（Amazon SP-API）
5. 商品一覧・詳細
6. 翻訳機能
7. Coupang出品
8. 在庫・価格同期
9. Naver・11st拡張
10. 受注・レポート・本部機能

### 11.3 命名規約
- ファイル：kebab-case (`channel-listing-form.tsx`)
- コンポーネント：PascalCase
- DBテーブル：snake_case、複数形
- ブランチ：`feat/xxx`, `fix/xxx`, `chore/xxx`

---

## 12. 未決事項・確認ポイント

| # | 項目 | 備考 |
|---|------|------|
| 1 | ユーザー規模感 | スケール設計前に確定したい（DBインスタンスサイズ等） |
| 2 | 法人化・インボイス対応 | 課金フェーズで必要 |
| 3 | Chrome拡張の仕様 | 別ドキュメント化予定 |
| 4 | 配送業者API連携の有無 | Phase 3以降の検討 |
| 5 | 本部ロイヤリティの計算ルール | 売上連動 / 定額 / 混合 |
| 6 | 画像加工ロジック | ウォーターマーク除去は著作権配慮必要 |

---

**以上**
