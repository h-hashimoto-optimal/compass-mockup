# Compass — モックアップ

韓国越境EC自動化ツール「Compass」のUIモックアップです。
バックエンド・認証は未接続で、すべてモックデータで動作します。

**スコープ（v0.3.0 — busoken準拠に拡張）**
- 仕入元：**Amazon.co.jp（ASIN自動取得）／楽天・Yahoo!ショッピング（手動取得）**
- 販売先：**Coupang（API自動出品）／NAVER Smartstore・11番街（CSV連携）**
- ASIN取得：**Chrome拡張**で Amazon検索結果から自動収集
- 付加機能：禁止ワード辞書 / ASINブラックリスト / 知財警告ブランドDB / Instagram投稿データ生成

仕様の出典：
- `compass-requirements.md`（要件定義）
- `compass-screen-specs.md`（画面仕様書）
- `compass-claude-code-prompts.md`（実装プロンプト集）
- `https://content.busoken.com/compass-yt-1`（busoken版 機能セット — v0.2→v0.3の拡張根拠）

## 起動

```bash
cd compass-mockup
npm install   # 初回のみ
npm run dev
```

ブラウザで <http://localhost:3000> を開く。

## Chrome 拡張のセットアップ

ASIN取得は Chrome 拡張経由が前提です。

1. Chrome で `chrome://extensions/` を開く
2. 右上「**デベロッパーモード**」を ON
3. 「**パッケージ化されていない拡張機能を読み込む**」→ `compass-mockup/chrome-extension/` を選択
4. Amazon.co.jp で検索（例: <https://www.amazon.co.jp/s?k=anker>）
5. 右下に「N ASIN 検出」バッジが表示される
6. 拡張アイコンをクリック → プレビュー → 「Compassへ送信」
7. Compass の `/products`（ASIN受信トレイ）に届く

詳細は `chrome-extension/README.md` を参照。

## 画面

| パス | 画面 | 仕様書ID |
|------|------|---------|
| `/login` | ログイン | SCR-AUTH-001 |
| `/` | HOME ダッシュボード | SCR-HOME-001 |
| `/products` | **ASIN受信トレイ**（Chrome拡張からの受信） | 4.2 |
| `/listings` | 出品商品一覧 | SCR-LIST-001 |
| `/listings/L-0001` | 商品詳細・編集（タブ5枚） | SCR-LIST-002 |
| `/listings/templates` | フィルタテンプレート（スタブ） | 4.3.3 |
| `/listings/protected` | 削除防止商品（スタブ） | 4.3.4 |
| `/translations` | 翻訳エディタ | SCR-TRANS-001 |
| `/publish/J-2026-04-25-0042` | Coupang一括出品ジョブ | SCR-PUBLISH-001 |
| `/marketing/instagram` | **Instagram投稿データ生成** | busoken |
| `/orders` | 受注一覧（Coupang） | SCR-ORDER-001 |
| `/settings/source` | 仕入元設定（Amazon／**楽天**／**Yahoo!**） | 4.8.2 |
| `/settings/channels` | 販売先設定（Coupang／**NAVER**／**11番街** CSV） | SCR-SET-001 |
| `/settings/margin` | 利益設定 | SCR-SET-002 |
| `/settings/ng-words` | **禁止ワード辞書** | busoken |
| `/settings/blacklist` | **ASINブラックリスト** | busoken |
| `/settings/ip-brands` | **知財警告ブランドDB** | busoken |
| `/settings/shipping` | 送料設定（スタブ） | 4.8.4 |
| `/settings/security` | セキュリティ（スタブ） | 3.2 |
| `/admin/tenants` | 加盟店管理（本部） | SCR-HQ-001 |
| `/admin/reports` | 本部レポート（スタブ） | 4.9.2 |
| `/admin/announcements` | お知らせ配信（スタブ） | 4.9.4 |

## API（モック実装）

| エンドポイント | 用途 |
|--------------|------|
| `POST /api/asins` | Chrome拡張がASINを送信 |
| `GET  /api/asins` | 受信済みASIN一覧（受信トレイで使用） |
| `DELETE /api/asins` | 受信トレイをクリア |

データは `tmp/captured-asins.json` に保存（gitignored）。本番ではSupabaseに置き換え。

### 拡張なしでAPIを試す

```bash
curl -X POST http://localhost:3000/api/asins \
  -H "Content-Type: application/json" \
  -d '{
    "source":"amazon-jp",
    "query":"anker",
    "items":[
      {"asin":"B0194WDVHI","title":"Anker PowerCore 10000","priceJpy":2980,
       "imageUrl":"","url":"https://www.amazon.co.jp/dp/B0194WDVHI"}
    ]
  }'
```

その後 <http://localhost:3000/products> をリロード。

## 技術スタック（モックフェーズ）

- Next.js 14 (App Router) + TypeScript strict
- Tailwind CSS（デザイントークンは `compass-screen-specs.md` 付録Bに準拠）
- shadcn/ui 風コンポーネント（手書き軽量版）
- lucide-react / recharts
- Chrome 拡張（Manifest V3）

## コアA 実装状況（2026-05-17 / モック前提）

A→B順次方針のコアA「アカウント発行/ログイン → Amazon ASIN取得 → Coupang自動出品 → 利益率管理」を実装・検証済み（`next build` 全22ルートgreen＋dev スモーク通過）。

- アカウント発行 `/signup`＋ロール選択ログイン（モック認証）
- ASIN受信トレイ → ブラックリスト**自動除外**（`/api/asins`）
- 受信トレイ → 翻訳→禁止ワード→**価格計算→HMAC署名→Coupang dry-run** 一気通貫（`COUPANG_*` 設定で即live化）
- **利益率の単一ソース** `lib/pricing.ts`：利益設定がパイプライン・出品一覧の想定利益/赤字判定に即反映（`/settings/margin` で編集・`/api/settings/margin` で保存。在メモリのためサーバ再起動でリセット）

## 未実装（次フェーズ）

- Supabase（Auth / Postgres / Storage / Realtime）— 現状の在メモリ/ファイル保持を置換
- Coupang Wing API / Amazon SP-API の実接続
- DeepL / 為替API
- i18n（next-intl / ja↔ko切替）
- 監査ログ・RLS・暗号化
- E2E / 単体テスト

## ディレクトリ

```
compass-mockup/
├── app/
│   ├── (dashboard)/        # サイドバー＋ヘッダー配下の画面
│   ├── api/asins/          # ASIN受信API
│   ├── login/
│   └── layout.tsx
├── components/
│   ├── ui/                 # 基本UI
│   ├── common/             # サイドバー・ヘッダー・PageHeader
│   └── features/           # 売上チャート等
├── lib/
│   ├── mock-data.ts
│   ├── asin-store.ts       # ASIN受信トレイのファイルストア
│   └── utils.ts
├── chrome-extension/       # Chrome 拡張（MV3）
└── tmp/                    # 受信ASINのJSON（gitignored）
```
