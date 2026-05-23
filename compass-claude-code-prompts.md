# Claude Code 実装プロンプト集

**Version:** 1.0
**前提ドキュメント:** `compass-requirements.md`、`compass-screen-specs.md`

---

## 使い方

1. リポジトリ直下に `docs/` を作り、要件定義書と画面仕様書を配置：
   ```
   docs/
   ├── requirements.md
   └── screen-specs.md
   ```
2. 各プロンプトを順番に Claude Code へ投入する。
3. 各ステップ完了後にコミットし、次のプロンプトへ進む。
4. プロンプト内の `@docs/...` は Claude Code の `@` メンション機能でファイル参照させる。

**重要：** プロンプトは1つずつ実行する。複数同時実行しない（実装が混線するため）。

---

## STEP 0: プロジェクト初期化

```
あなたは韓国越境EC自動化SaaS「Compass」のシニアフルスタックエンジニアです。
@docs/requirements.md @docs/screen-specs.md を必ず精読してから作業してください。

このリポジトリでこれから本格的に開発を始めます。以下のセットアップを行ってください。

# やること
1. Next.js 14 (App Router, TypeScript strict, src/不使用) のプロジェクトを初期化
2. 以下を導入し設定:
   - Tailwind CSS + shadcn/ui (新York スタイル, Slate ベース)
   - lucide-react
   - @supabase/supabase-js, @supabase/ssr
   - react-hook-form + zod + @hookform/resolvers
   - @tanstack/react-query, @tanstack/react-table, @tanstack/react-virtual
   - zustand
   - next-intl (ja, ko の2言語、デフォルト ja)
   - dayjs (locale ja, ko)
   - sonner (トースト)
   - vitest + @testing-library/react + playwright
3. ESLint (next/core-web-vitals + typescript-eslint) と Prettier を設定。tabWidth=2、singleQuote=true、trailingComma=all
4. tsconfig: strict, noUncheckedIndexedAccess, paths で `@/*` を `./*` にマップ
5. requirements.md セクション9のディレクトリ構成に従ってフォルダを作成（空でよい）
6. .env.example を作成し以下を列挙:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY (サーバー専用と明記)
   - DEEPL_API_KEY
   - OPEN_EXCHANGE_RATES_APP_ID
   - SENTRY_DSN
7. README.md にセットアップ手順、コマンド一覧、規約の要点を記載
8. .gitignore, .editorconfig
9. GitHub Actions ワークフロー (.github/workflows/ci.yml): typecheck / lint / test / build
10. Husky + lint-staged で pre-commit フック

# 守ること
- requirements.md セクション11.1 の「必ず守ること」を厳守
- ハードコードされた日本語禁止 → messages/ja.json, messages/ko.json に置く
- service_role_key を含む処理は src（実装フェーズで作る）の `lib/supabase/server.ts` 経由とし、Client Componentから絶対に参照させない設計にする
- パッケージは最新安定版を使用

# 完了の定義
- `pnpm install && pnpm dev` が起動する
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` が全て通る
- README に従えば他の開発者が30分以内に環境構築できる

完了したら変更ファイル一覧と確認手順を提示してください。
```

---

## STEP 1: Supabase スキーマと RLS

```
@docs/requirements.md セクション6（データモデル）と11.1 を参照。

Supabase のスキーマとRLSポリシーを実装します。

# やること
1. supabase/migrations/ に SQL マイグレーションを作成
2. 以下のテーブルを定義（requirements.md 6章準拠、足りない列があれば理由をコメントで補足）
   - tenants, profiles, source_products, listings, channel_listings
   - orders, order_items, jobs, job_items（出品ジョブの子レコード）
   - translation_memory, tenant_settings, channel_credentials
   - filter_templates, protected_listings, category_mappings
   - ng_keywords, audit_logs, api_call_logs, fx_rates
   - announcements, invitations
3. 全テーブルに次を必須:
   - id (uuid, default gen_random_uuid())
   - tenant_id (profilesとtenantsを除く全テーブル)
   - created_at, updated_at (updated_atはトリガーで自動更新)
4. インデックス:
   - 全 tenant_id にインデックス
   - listings(status, channel_listings経由のクエリを想定して適切に)
   - orders(tenant_id, ordered_at desc)
   - jobs(tenant_id, status, scheduled_at)
   - audit_logs(tenant_id, created_at desc)
5. RLS:
   - 全テーブルで `ENABLE ROW LEVEL SECURITY`
   - 共通ポリシー: `tenant_id = (auth.jwt() ->> 'tenant_id')::uuid` または `(auth.jwt() ->> 'is_owner')::boolean = true`
   - profiles は `id = auth.uid()` も許可
   - service_roleはbypass
6. 暗号化:
   - pgcrypto 拡張を有効化
   - channel_credentials は jsonb ではなく bytea で encrypted_payload を保存
   - 暗号化/復号関数を `app_private` スキーマに作成し service_role のみ実行可
7. ヘルパ関数:
   - `app.current_tenant_id()` — JWTから取得
   - `app.is_owner()` — JWTから取得
   - `dashboard_summary(p_tenant_id uuid)` RPC — HOME 用集計
8. 監査トリガー:
   - listings, channel_listings, tenant_settings, channel_credentials の変更を audit_logs に自動記録
9. seed.sql:
   - 開発用テナント1社、本部ユーザー1名、テナント管理者1名、サンプル商品3件
10. supabase/README.md に「ローカルで supabase start → migration up → seed」の手順記載

# 守ること
- 命名は snake_case 複数形
- 外部キーは ON DELETE の挙動を明示（基本 CASCADE か RESTRICT）
- enum 型は CHECK 制約で代替（拡張しやすさ優先）
- 全 SQL に `-- なぜこの設計か` のコメントを最低1行ずつ
- マイグレーションは冪等にしない（Supabase migrationは順番管理されるため）

# 完了の定義
- `supabase db reset` でクリーンに作り直せる
- seed 投入後、dev用ユーザーでログインしたとき、自テナントのlistingsだけが見える（RLSテストSQLを supabase/tests/ に配置して `pnpm test:db` で確認）

完了したらERD（mermaid記法）を README に記載してください。
```

---

## STEP 2: 認証・テナント・プロフィール基盤

```
@docs/requirements.md セクション3 を参照。

Supabase Auth を使った認証基盤と、テナント・プロフィール周辺を実装します。

# やること
1. lib/supabase/
   - client.ts (ブラウザ用)
   - server.ts (Server Component / Server Action 用、cookies対応)
   - middleware.ts (セッションリフレッシュ)
2. middleware.ts (ルート直下):
   - 未認証は /login へ
   - 認証済みは /login, /signup から / へ
   - /admin/* は is_owner=true のみ
3. JWT カスタムクレーム:
   - Supabase の auth hook (Custom Access Token Hook) を使い tenant_id, role, is_owner を JWT に注入
   - hooksのSQLを supabase/migrations/ に追加
4. Server Action ベースの認証フロー:
   - signIn(email, password)
   - signInWithGoogle()
   - signOut()
   - signUpWithInvite(token, fullName, password)
   - requestPasswordReset(email)
   - 全て zod でバリデーション、Result型で返す
5. 画面実装:
   - SCR-AUTH-001 (ログイン)
   - SCR-AUTH-002 (招待サインアップ)
   - /forgot-password (リセット申請)
   - /reset-password (リセット実行)
6. 招待トークン:
   - invitations テーブルに token (random 32byte hex), email, tenant_id, role, expires_at, accepted_at
   - generateInvite() Server Action（tenant_admin/owner のみ）
   - acceptInvite(token) で profile 作成 + auth.users 作成
7. 2FA (TOTP):
   - tenant_admin と owner はサインアップ完了後に強制セットアップ
   - /settings/security ページで有効化/無効化
8. テスト:
   - Vitest: 認証Server Actionの単体テスト（Supabaseはモック）
   - Playwright: ログイン→HOMEまでのE2E

# 守ること
- service_role_key を Client Component で import しない（lint ルールも追加）
- パスワードは Supabase 側でハッシュ化、自前実装しない
- エラーメッセージはユーザー列挙攻撃を許さない汎用文言（screen-specs.md SCR-AUTH-001参照）
- 全認証イベントを audit_logs に記録（ただし password 等の値は記録しない）

# 完了の定義
- 招待 → サインアップ → ログイン → サインアウト → 再ログイン が動く
- 別テナントのデータが RLS で見えないことを Playwright で検証
- typecheck/lint/test 全通過

完了したら認証フローのシーケンス図 (mermaid) を README に追記してください。
```

---

## STEP 3: アプリ全体レイアウト・ナビゲーション・i18n

```
@docs/screen-specs.md セクション7（共通コンポーネント仕様）を参照。

ログイン後のアプリ本体レイアウトと共通コンポーネントを実装します。

# やること
1. app/(dashboard)/layout.tsx:
   - サイドバー（折りたたみ可）+ ヘッダー + メインエリア
   - サイドバーは screen-specs.md 7.1 の仕様
2. ヘッダー:
   - 左: 現在のテナント名、ロール badge
   - 右: 言語切替 (ja/ko)、為替バッジ、通知ベル、ユーザーメニュー
3. サイドバーメニュー（要件定義の画面構成準拠）:
   - HOME
   - 商品データ収集
   - 管理（アコーディオン）: 出品商品管理 / フィルタテンプレート / 削除防止 / 翻訳 / 商品名一括編集 / 仕入元一括更新 / クーパン出品 / Naver出品 / 11st出品 / 出品データ更新
   - 受注
   - 各種設定（アコーディオン）: 在庫・価格 / 仕入元 / 利益 / 送料 / 販売先 / セキュリティ
   - 本部専用（is_owner=true のみ）: 加盟店 / レポート / お知らせ
4. 共通コンポーネント (components/ui に shadcn 入れた上で components/common に):
   - DataTable (TanStack Table + 仮想スクロール + カラム設定保存)
   - EmptyState
   - ConfirmDialog（破壊的操作用、件数表示・"DELETE"入力対応）
   - Toaster (sonner ラップ)
   - PageHeader（タイトル + 右側アクション）
   - StatusBadge（出品ステータス用カラー定義）
   - PriceCell (KRW/JPY 両表示)
5. i18n:
   - next-intl セットアップ
   - messages/ja.json と messages/ko.json に最低限のキーを定義
   - 言語切替で URL prefix 不使用（cookie保存方式）
6. エラーバウンダリ:
   - app/(dashboard)/error.tsx
   - Sentry 連携、エラーIDをユーザー画面に表示
7. テーマ:
   - screen-specs.md 付録B のデザイントークンを tailwind.config.ts に反映
   - ダークモード対応（next-themes）
8. NotFound (app/not-found.tsx) と ローディング (loading.tsx) も整備

# 守ること
- ハードコード文字列禁止、必ず i18n キー経由
- ロールに応じた表示制御は <RoleGate role="owner"> のような宣言的コンポーネントで
- アクセシビリティ：landmarks (header/nav/main)、フォーカスリング、コントラスト

# 完了の定義
- ログイン後、サイドバー＋ダミー各ページが表示される
- 言語切替が動作（ja↔ko）
- ダークモード切替が動作
- typecheck/lint/test/build 全通過

完了したらスクリーンショットを README に追加してください。
```

---

## STEP 4: HOME ダッシュボード

```
@docs/screen-specs.md SCR-HOME-001 と @docs/requirements.md 4.1 を実装します。

# やること
1. RPC `dashboard_summary(p_tenant_id uuid)` を Supabase に追加（既存ならそれを使用）
   - KPI 7種、エラー一覧10件、為替最新、お知らせ3件 を1コールで返す
2. app/(dashboard)/page.tsx:
   - Server Component で RPC 呼出、初期描画
   - KPIカード（クリック可、該当一覧画面へ遷移、URLクエリ込み）
   - 売上推移チャート（recharts、販路タブ切替）
   - エラー通知リスト（Supabase Realtime 購読で更新）
   - 為替ウィジェット（fx_rates 最新）
   - お知らせウィジェット
3. オンボーディング状態:
   - listings 0件のときは KPI を隠してオンボーディングカードを表示
4. スケルトンとエラーフォールバック
5. 計測:
   - dashboard.viewed をログ（lib/analytics.ts ラッパ）

# 守ること
- 重い集計はRPC側で行う（Nアクセス回避）
- RealtimeはJobsの failed のみ購読、過剰購読禁止
- チャートは aria-label で要約を提供

# 完了の定義
- seed データで KPI、チャート、エラー一覧が表示される
- 別テナントとしてログインしたとき、自テナントのデータのみ表示
- Lighthouse パフォーマンススコア 85 以上

完了したらこの画面のスクリーンショットを README に追加してください。
```

---

## STEP 5: 商品データ収集（Amazon SP-API）

```
@docs/requirements.md 4.2 を実装します。MVP では Amazon.co.jp のみ対応。

# やること
1. lib/channels/amazon/
   - sp-api クライアント (auth: LWA refresh token、署名: AWS SigV4)
   - 商品検索/取得（GetCatalogItem, GetItemOffers）
   - レート制限（lib/channels/rate-limiter.ts のトークンバケット使用）
2. Server Action / Edge Function:
   - enqueueAmazonImport(asins[]) — 大量時は jobs に分割投入
   - importAmazonItem(asin) — 単体取得
3. UI:
   - /products (商品データ収集) ページ
   - ASIN複数行入力 + CSVアップロード
   - ジョブ進捗ページへ遷移
4. ジョブワーカー:
   - supabase/functions/jobs-runner/ を作成
   - 1分おきに pending jobs を pop し処理（Supabase Cron で起動）
   - 失敗3回までリトライ、attempt と last_error を更新
5. データ保存:
   - source_products に upsert（source_platform='amazon', source_id=ASIN）
   - 画像は Supabase Storage の `source-images/{tenant_id}/{asin}/` に保存
6. テスト:
   - sp-api クライアントのHTTP層をモックしたVitestテスト
   - 主要エラー（429, 5xx, タイムアウト）の挙動

# 守ること
- レート制限超過時は exponential backoff
- API 応答を api_call_logs に記録（パラメータは記録、認証情報は記録しない）
- 画像取得は Storage で重複排除
- Amazon の利用規約に反するスクレイピング的な使い方はしない

# 完了の定義
- 開発環境で 5 ASIN を入力 → ジョブ進行 → source_products に保存される
- 失敗時に再実行できる
- /products 一覧で取得済みデータが見える

完了したら api_call_logs のサンプル出力を README に貼ってください。
```

---

## STEP 6: 出品商品一覧・詳細

```
@docs/screen-specs.md SCR-LIST-001, SCR-LIST-002 と @docs/requirements.md 4.3 を実装します。

# やること
1. /listings 一覧ページ:
   - サーバーサイド・ページング/フィルタ/ソート（URL同期）
   - DataTable + 仮想スクロール
   - フィルタテンプレートの保存・呼出（filter_templates）
   - 一括選択 → 一括アクションバー
   - 一括アクション: 出品 / 編集モーダル / CSVエクスポート（ジョブ化）/ 削除
   - 削除時は protected_listings をスキップ + 結果トースト
2. /listings/[id] 詳細ページ:
   - タブ: 基本情報 / 画像 / 翻訳 / 価格 / Coupang / Naver / 11st
   - 画像は DnD 並び替え（dnd-kit）
   - 価格シミュレーター (lib/pricing/calculator.ts に純関数で切り出し)
   - 楽観的ロック（updated_at）で衝突検知
3. lib/pricing/calculator.ts:
   - 入力: 仕入JPY, 国際送料, 関税率, VAT率, 利益率, FXレート, 端数処理
   - 出力: 最終KRW, 内訳
   - 単体テスト網羅
4. ソースから listings を作成する Server Action:
   - createListingFromSource(source_product_id, channels[])
5. /listings/templates: フィルタテンプレート管理
6. /listings/protected: 削除防止商品ID管理

# 守ること
- 1000件超の選択は二重確認モーダル
- 一括処理は必ずジョブ化（同期処理しない）
- listing 編集は audit_logs に diff を保存

# 完了の定義
- seed の商品で一覧→絞込→詳細→価格試算→保存ができる
- 一括削除で保護対象がスキップされ、トーストでスキップ件数を通知
- pricing/calculator のテストカバレッジ100%

完了したらフィルタとページングのURL設計例を README に記載してください。
```

---

## STEP 7: 翻訳機能（DeepL）

```
@docs/screen-specs.md SCR-TRANS-001 と @docs/requirements.md 4.4 を実装します。

# やること
1. lib/translation/
   - deepl.ts: DeepL Pro/Free 両対応クライアント、レート制限対応
   - memory.ts: translation_memory ヒット検索（lower(source_text) で完全一致、なければ DeepL）
   - ng-replace.ts: ng_keywords 辞書で置換/ブロック
2. Server Action:
   - translateBatch(listingIds[]) — ジョブ投入
   - jobs-runner に translation worker を追加
3. UI:
   - /translations ページ
   - エンジン選択（DeepL のみで OK だが将来拡張のためセレクト）
   - 翻訳メモリ使用 toggle
   - 禁止ワード辞書セレクト
   - プレビューモード（API は呼ぶがDB更新しない）と本番モード
   - 結果テーブル（行ごと再実行・編集）
4. /listings/[id] の翻訳タブ:
   - 単体翻訳ボタン
   - 翻訳メモリ候補表示
5. 商品名一括編集 (/listings/title-edit):
   - 正規表現置換、プレフィックス/サフィックス、テンプレ
   - 必ずプレビューを挟む

# 守ること
- DeepL API key はテナント設定 or 共通鍵を選択可（tenant_settings.translation.api_key）
- 推定費用と推定時間を実行前に必ず表示
- メモリヒット時は API を呼ばない（コスト削減）
- 失敗行のみ再試行

# 完了の定義
- 5商品をプレビュー → 修正 → 本番実行 で翻訳が反映される
- メモリヒット時に DeepL を呼ばないことをモックで検証

完了したらコスト試算ロジックの説明を README に追加してください。
```

---

## STEP 8: Coupang 出品（一括）

```
@docs/requirements.md 4.5.1, 7.1 と @docs/screen-specs.md SCR-PUBLISH-001 を実装します。

# やること
1. lib/channels/coupang/
   - client.ts: HMAC-SHA256 署名、レート制限（10 req/sec）
   - schema.ts: zod でリクエスト/レスポンス型を定義
   - category-mapper.ts: category_mappings テーブル参照
   - publisher.ts: publish(listingId) → channel_listings 更新
2. ドライラン:
   - 実APIを呼ばずペイロードだけ生成し画面で確認
3. UI:
   - /listings 一括アクション「Coupang一括出品」→ 確認モーダル → ジョブ作成 → /publish/[jobId] へ
   - /publish/[jobId] (SCR-PUBLISH-001):
     - 進捗バー、サマリ、失敗一覧、再実行
     - Realtime購読でリアルタイム更新
4. ジョブワーカー拡張:
   - publish-coupang job タイプを追加
   - job_items 単位で並列実行（Promise.all + 同時実行数制御）
5. エラーハンドリング:
   - Coupang のエラーコードを日本語にマッピング（lib/channels/coupang/error-map.ts）
   - 再試行可能エラーと不可逆エラーを区別
6. 出品ステータス同期:
   - 30分おきに channel_listings の status を Coupang 側と同期するジョブ

# 守ること
- 出品前バリデーション必須（必須属性、文字数、画像数）
- バリデーション失敗は API 呼出前に阻止し、明確な理由を表示
- 1ジョブで100件超の場合は内部で分割

# 完了の定義
- ドライランで正しいペイロードが生成される
- ステージング環境で5件の実出品が成功する
- 失敗ケース（カテゴリ未マッピング）が明示される

完了したらサンプルペイロードJSONを README に貼ってください。
```

---

## STEP 9: 在庫・価格同期と自動リプライス

```
@docs/requirements.md 4.6 を実装します。

# やること
1. ジョブ:
   - sync-source-inventory: 仕入元の在庫・価格を再取得し source_products を更新
   - reprice-listings: 設定に基づいて listings.price_krw を再計算し各販路へ反映
   - sync-channel-status: 販路から最新ステータス取得
   - Supabase Cron で定期起動（時次/日次設定可）
2. リプライスルール (lib/pricing/reprice-rules.ts):
   - 仕入価格変動 > X%
   - 為替変動 > Y%
   - 下限価格ガード（赤字判定）
   - 設定は tenant_settings.pricing.rules に保存
3. UI:
   - /settings/pricing でルール編集
   - /listings/[id] の価格タブで価格改定履歴表示（price_history テーブルを追加）
4. 在庫切れ動作:
   - 仕入元 stock=0 → channel_listings の status=suspended で API 反映
   - 復活時は元のステータスへ（設定で無効化可）

# 守ること
- 改定履歴は必ず保存
- 一回の同期で全件処理せず、優先度（販売中 > 出品待ち）でバッチ化
- 為替APIのキャッシュ（fx_rates）を必ず経由

# 完了の定義
- 仕入価格を変更 → ジョブ実行 → KRW価格と販路反映が確認できる
- 下限ガードで損失が出る改定はスキップされる

完了したらリプライスのフローチャート (mermaid) を README に追加してください。
```

---

## STEP 10: Naver Smart Store / 11st 拡張

```
@docs/requirements.md 4.5.2, 4.5.3, 7.2, 7.3 を実装します。

# やること
1. lib/channels/naver/
   - OAuth2 (Client Credentials) クライアント
   - 카테고리, 원산지, 제조사, A/S 정보 のスキーマ定義
   - publisher.ts
2. lib/channels/11st/
   - API Key ヘッダ認証
   - displayCategoryNo, taxTypCd 等のスキーマ
   - publisher.ts
3. 設定画面 (/settings/channels) を Coupang から拡張:
   - Naver 接続フロー（OAuth or 既存トークン入力）
   - 11st API key 入力
   - 接続テストボタン
4. /listings/[id] の Naver/11st タブを実装
5. 一括出品 UI に販路選択を追加（複数販路同時出品可）

# 守ること
- 各プラットフォームの必須属性差異を吸収するため channel_listings.payload (jsonb) を活用
- 認証情報の暗号化（pgcrypto）を必ず通す
- 監査ログ: `channel.credential.updated`, `channel.publish.{success,failure}`

# 完了の定義
- Naver と 11st のステージング環境で出品成功
- 3販路同時出品ジョブが完走

完了したら各販路のスキーマ差分一覧を README に表で追加してください。
```

---

## STEP 11: 受注・本部機能・レポート

```
@docs/requirements.md 4.7, 4.9 と @docs/screen-specs.md SCR-ORDER-001, SCR-HQ-001 を実装します。

# やること
1. 受注取り込みジョブ:
   - 各販路の注文取得API
   - orders, order_items に upsert
   - 30分間隔
2. /orders 画面 (SCR-ORDER-001):
   - ステータスタブ、フィルタ、検索
   - 詳細ドロワー
   - 出荷登録（PCCC, 追跡番号バリデーション）
3. /admin/* 本部画面:
   - /admin/tenants (SCR-HQ-001)
   - /admin/reports（加盟店別売上・粗利、CSVエクスポート）
   - /admin/announcements（お知らせ配信）
4. 代理ログイン:
   - /admin/tenants の操作から impersonation 開始
   - JWT に impersonator_id を入れ、UI に常時警告バナー
   - 全操作を監査ログに記録（`impersonate.start/end`、配下の操作にも impersonator_id を付与）
5. レポート集計:
   - dashboard_summary とは別に admin_report(date_from, date_to, tenant_ids[]) RPC

# 守ること
- 代理ログインのセキュリティ：意図せず本番データを破壊しないよう、書き込み操作には追加確認モーダル
- レポートの大量データはサーバーサイドで集計後、CSVは Supabase Storage 経由で署名URL配布

# 完了の定義
- 受注取り込みからの出荷登録までが動く
- 本部ロールで全加盟店レポートを取得できる
- 加盟店ロールで本部ページにアクセスできない（middlewareで弾かれる）

完了したら本部ロイヤリティ計算の実装方針を README に追記してください。
```

---

## STEP 12: 仕上げ（運用・監視・ドキュメント）

```
本番運用に向けた仕上げを行います。

# やること
1. 監視:
   - Sentry の本番設定、ソースマップアップロード
   - Supabase の slow query ログ確認手順を docs/operations.md に
2. バックアップ:
   - Supabase 日次バックアップ + 週次の重要テーブルエクスポート（Edge Function + Storage 保存）
3. レート制限 / WAF:
   - Vercel の rate limiting を Server Action と Route Handler に
   - signup と forgot-password に IPベースの追加制限
4. 通知:
   - Slack / LINE Webhook 連携（テナント設定で URL を保存、暗号化）
   - エラー閾値超過時に通知
5. パフォーマンス:
   - 全ページの Lighthouse CI を GitHub Actions に追加
   - 主要画面で 85+
6. テスト:
   - E2E（Playwright）でクリティカルパス: ログイン → 商品取込 → 翻訳 → Coupang出品 → 受注 → 出荷
   - カバレッジ: ビジネスロジック（lib/）80% 以上
7. ドキュメント:
   - docs/operations.md: 障害時のRunbook、ジョブが詰まった時の対処、再送方法
   - docs/onboarding.md: 加盟店オンボーディング手順
   - docs/architecture.md: システム構成図 (mermaid)、データフロー、セキュリティ設計
   - CHANGELOG.md
8. セキュリティチェック:
   - npm audit, dependabot 設定
   - .env のリーク検出 (gitleaks) を CI に
   - OWASP Top 10 をチェックリスト化して docs/security.md

# 完了の定義
- 全テスト通過、Lighthouse CI 通過
- docs/ 配下が整い、新規メンバーが2日でキャッチアップできる
- 監視・通知が稼働、本番デプロイ手順が文書化されている
```

---

## 補助プロンプト（必要に応じて）

### A. バグ修正の標準フォーマット

```
バグ修正をお願いします。

## 現象
（再現手順 / 期待結果 / 実際の結果）

## 該当箇所
（推測でよい、ファイルパスや関数名）

## 制約
- 既存テストを壊さない
- 修正には必ず回帰テストを追加
- @docs/requirements.md の関連節があれば参照

## 完了の定義
- pnpm typecheck && pnpm lint && pnpm test 通過
- 追加したテストが現象を再現するものになっている
- 変更点を箇条書きで報告
```

### B. リファクタの標準フォーマット

```
リファクタをお願いします。

## 対象
（ファイル / モジュール）

## 目的
（可読性 / 重複排除 / パフォーマンス / 何）

## 制約
- 振る舞いを変えない（既存テストが全通過すること）
- 公開APIの破壊的変更は避ける、必要なら PR説明に明記
- 1コミットで完結する規模に分割

## 完了の定義
- before/after の差分サマリ
- どこが良くなったかの説明
- pnpm typecheck && pnpm lint && pnpm test 通過
```

### C. 新規画面追加の標準フォーマット

```
新規画面を追加します。

## 仕様
@docs/screen-specs.md の以下のテンプレートを埋めた仕様：

（ここに仕様を貼り付け、または別ファイルパスを指定）

## 制約
- screen-specs.md セクション7 の共通コンポーネント仕様に準拠
- i18n キー必須、ハードコード禁止
- 監査ログ要否を確認のうえ実装
- E2E テストを1本追加

## 完了の定義
- 画面が要素IDテーブル通りに動作
- スクリーンショットを PR に添付
- pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e 通過
```

---

## 進捗チェックリスト

実装中はこのチェックリストを `docs/progress.md` で管理することを推奨：

```
- [ ] STEP 0: プロジェクト初期化
- [ ] STEP 1: Supabase スキーマと RLS
- [ ] STEP 2: 認証・テナント・プロフィール
- [ ] STEP 3: レイアウト・ナビゲーション・i18n
- [ ] STEP 4: HOME ダッシュボード
- [ ] STEP 5: 商品データ収集（Amazon）
- [ ] STEP 6: 出品商品一覧・詳細
- [ ] STEP 7: 翻訳機能
- [ ] STEP 8: Coupang 一括出品
- [ ] STEP 9: 在庫・価格同期
- [ ] STEP 10: Naver / 11st 拡張
- [ ] STEP 11: 受注・本部機能
- [ ] STEP 12: 運用・監視・ドキュメント
```

---

**以上**
