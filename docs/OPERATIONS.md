# Compass 運用ルール（データ事故を防ぐための必守事項）

> このファイルは「後からだとデータが壊れる/移行が激痛」を防ぐための運用ルール。
> 詳細設計は Notion「Compass 認証＋インフラ/DB アーキテクチャ設計書 §D」。

## 環境（local / STG / PROD）

| 環境 | DB（Neonブランチ） | アプリ | 用途 |
|------|-------------------|--------|------|
| local | `development` ブランチ | `npm run dev`（:3000） | 開発・検証 |
| STG | `staging` ブランチ | Vercel（stagingブランチ） | 受入確認 |
| PROD | `production` ブランチ | Vercel（main） | 本番 |

- **DBはNeonのブランチで分離**（copy-on-writeで安価・即時）。
- **`.env.local` は local 専用**。STG/PROD のシークレットはデプロイ先の環境変数で管理（リポジトリに入れない）。
- ⚠️ **PRODのDBに対して開発・テスト・実験をしない**。必ず development ブランチで。

## マイグレーション運用（必守）

1. スキーマ変更は `lib/db/schema.ts` を編集 → `npm run db:generate`（版管理SQLを生成）。
2. 生成された `drizzle/*.sql` を**必ず目視レビュー**（特に DROP / 型変更）。
3. development ブランチで `npm run db:migrate` を実行して検証。
4. PROD への適用は、検証済みの同じ migration のみ。**`drizzle-kit push`（自動差分・列削除リスク）はPRODで使わない**。
5. 破壊的変更（列削除・型変更）の前に **Neon PITR / バックアップ** を確認。

## データ不変条件（最初から守る）

- 全業務テーブルに `tenant_id NOT NULL` ＋ 複合索引 ＋ **RLSポリシー**。
- **金額は整数**（JPY=円, KRW=ウォン）。float禁止。
- 履歴（price_events）は**最初から月パーティション＋保持期間**。
- 外部IDにユニーク制約：`unique(tenant_id, asin)` / Coupang `sellerProductId` / `vendorItemId`。
- 削除は**ソフトデリート優先**（status等）。

## よく使うコマンド

```bash
npm run dev          # 開発サーバ :3000
npm run db:generate  # スキーマ→migration SQL生成
npm run db:migrate   # migration適用（.env.localのDATABASE_URL先）
npm run db:seed      # 本部(owner)初期投入（.env.localのOWNER_*）
```

## シークレット

- **local のみ** `.env.local`（gitignore済み）に実値。**チャット・コミット・ログに出さない**。
- **STG/PROD は AWS Secrets Manager を正とし、起動時（`instrumentation.ts`）に取得**（env に実値を置かない）。env はサプライチェーン攻撃（汚染された依存 npm が `process.env` を外部送信）の標的になりやすいため。env 経由は Secrets Manager が使えない場合の**次善策**。
- 必要キー: `DATABASE_URL` / `APP_DATABASE_URL` / `SESSION_SECRET` / `SECRETS_MASTER_KEY` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `AWS_REGION` / `COMPASS_SECRETS_ID` / `OWNER_EMAIL` / `OWNER_NAME`（テンプレは `.env.example`）。※Googleログイン移行に伴い `OWNER_INITIAL_PASSWORD` は廃止。

## 連携シークレットの暗号化（SECRETS_MASTER_KEY）

- 加盟店が登録する Amazon SP-API / Coupang のAPI鍵は **AES-256-GCM で暗号化**して `tenant_integrations.secrets_enc` に保存（平文保存しない）。マスター鍵は base64 32byte。
- **鍵の入手元**: STG/PROD は **AWS Secrets Manager から起動時に取得**（`instrumentation.ts` で一度だけ読み、`lib/crypto.ts` は同期のまま使う）。local のみ `SECRETS_MASTER_KEY` を `.env.local` に置く。生成: `npm run set-secrets-key`（未設定なら自動生成・値は表示しない）。
- ⚠️ **運用開始後に鍵を変えると既存の暗号化データが復号不能**。回すなら「新鍵で全 `secrets_enc` を再暗号化（旧鍵で復号→新鍵で暗号化）」のマイグレーションが必須。
- 鍵は Secrets Manager でアクセス制限・監査する。**定期ローテーションは任意**（漏洩時は上記の再暗号化で緊急ローテーション）。
- クライアントへシークレット値は返さない（連携状態＝設定済みフィールド名と更新日時のみ）。書き込み専用フォーム。

## RLS（Row-Level Security）＝多層防御

アプリ層の tenant_id 絞り込みに加え、**DBレベルでもテナント隔離**する（先行導入：`tenant_integrations` / `channel_listings` / `orders`）。

- **役割分担**：
  - 実行時アプリ＝**最小権限ロール `compass_app`**（非owner）で接続（env `APP_DATABASE_URL`）。RLSの対象になる。
  - migration / seed / 運用スクリプト / テスト＝**owner（`DATABASE_URL`）**で接続。owner は RLS を**bypass**するので従来通り。
- **しくみ**：`withTenant(tenantId, fn)`（lib/db）が トランザクション内で `SET LOCAL app.current_tenant` し、ポリシー `tenant_id = NULLIF(current_setting('app.current_tenant'),'')::uuid` で一致行のみ可視/書込可。GUC未設定は0件＝安全に遮断。
- **RLS対象テーブルへのアプリのアクセスは必ず `withTenant` 経由**にする（直 `db.` 禁止）。漏れると0件で空振り（E2E `verify-rls` がゲート）。
- **セットアップ（各環境で1回・owner権限で実行）**：
  1. `npm run db:app-role` … `compass_app` ロール作成/更新＋権限付与＋ `APP_DATABASE_URL` を .env.local に生成
  2. `npm run db:rls` … 対象テーブルに RLS 有効化＋ポリシー作成（冪等）
  3. アプリ（dev/STG/PROD）を**再起動**して `APP_DATABASE_URL` で接続させる
- ⚠️ **PROD/STG では `db:app-role`・`db:rls` を本番DBに対して実行**し、デプロイ先の環境変数に `APP_DATABASE_URL`（compass_app）を設定すること。未設定だと owner 接続＝RLS無効（アプリ層のみ）で動作する（フォールバックなので壊れはしないが多層防御が効かない）。
- ⚠️ ロールのパスワードを回す時は `db:app-role` 再実行→ `APP_DATABASE_URL` 更新→アプリ再起動。
- **未対応テーブル**（ng_words/source_blacklist/ip_brands/alerts/tenant_settings 等）は今はアプリ層のみ。同パターンで順次拡張予定。
