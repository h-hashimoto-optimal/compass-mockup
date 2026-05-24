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

- `.env.local`（gitignore済み）にのみ実値。**チャット・コミット・ログに出さない**。
- 必要キー: `DATABASE_URL` / `SESSION_SECRET` / `SECRETS_MASTER_KEY` / `OWNER_EMAIL` / `OWNER_NAME` / `OWNER_INITIAL_PASSWORD`（テンプレは `.env.example`）。

## 連携シークレットの暗号化（SECRETS_MASTER_KEY）

- 加盟店が登録する Amazon SP-API / Coupang のAPI鍵は **AES-256-GCM で暗号化**して `tenant_integrations.secrets_enc` に保存（平文保存しない）。鍵は env `SECRETS_MASTER_KEY`（base64 32byte）。
- 生成: `npm run set-secrets-key`（`.env.local` に未設定なら自動生成。値は表示しない）。**STG/PROD はデプロイ先の環境変数に別値を設定**。
- ⚠️ **運用開始後に鍵を変えると既存の暗号化データが復号不能**。回転する場合は「新鍵で全 `secrets_enc` を再暗号化（旧鍵で復号→新鍵で暗号化）」のマイグレーションが必須。
- ⚠️ 鍵が漏れると全テナントの連携鍵が漏れる。env管理・アクセス制限・定期ローテーション（再暗号化込み）を前提にする。
- クライアントへシークレット値は返さない（連携状態＝設定済みフィールド名と更新日時のみ）。書き込み専用フォーム。
