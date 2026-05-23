# Coupang Global Marketplace 加盟店オンボーディング

Compassフランチャイズに加盟して、日本から韓国Coupangへ商品を販売するための準備手順です。

> **Notion貼り付け前提**：このMDはそのままNotionにコピーして加盟店向け資料として配布できます。
> 本文中のリンクはNotion上でも有効です。

---

## TL;DR

- **韓国法人・韓国銀行口座・事業者登録番号は不要**。日本の事業者のまま参入できます
- 必要書類は **4点**（事業者証明・パスポート・オーナーシップ証明・銀行口座証明）
- 書類が揃って **最大5営業日** で承認
- 登録料は **無料**、月額固定費は GMV 100万KRW超のセラーのみ 50,000 KRW/月
- 参入トラックは「**Global Marketplace**」（Marketplace / Rocket Growth ではない）

---

## 1. Coupangで売る3つのトラック

| トラック | 在庫の置き場所 | 日本事業者の参入可否 |
|---|---|---|
| Marketplace（普通の出品） | 韓国国内 | △ 韓国法人/口座が必要 |
| Rocket Growth | Coupang韓国倉庫 | △ 同上＋在庫を韓国に送る |
| **Global Marketplace** | 海外（日本でOK） | ◎ **これを選ぶ** |

→ 加盟店は **Global Marketplace** を選びます。
公式：<https://globalsellers.coupang.com/en/>

---

## 2. 事前に揃える書類（4点）

| 書類 | 法人の場合 | 個人事業主の場合 | 補足 |
|---|---|---|---|
| **事業者証明** | 履歴事項全部証明書 | 開業届の控え | 英訳推奨 |
| **代表者パスポート** | 代表者本人 | 本人 | 有効期限6ヶ月以上 |
| **オーナーシップ証明** | 登記簿の役員欄 / 株主名簿 | 開業届で兼用可 | 代表者と事業体の関係を示す |
| **銀行口座証明** | 銀行発行の口座証明 or 残高証明 | 同左 | **SWIFTコード必須** |

加えて：
- 担当者の連絡先（メール・電話、英語/韓国語対応推奨）
- 取扱予定商品が **禁制品/KC認証対象** でないことの確認（→ 7章）

> **注意**：個人事業主の通過実績は公式情報未確認。フランチャイズ本部に確認してください。

---

## 3. 登録フロー

1. <https://globalsellers.coupang.com/> から **Sign up**
2. 上記4書類をアップロード
3. **最大5営業日**で承認連絡
4. 承認後、Wing（<https://wing.coupang.com>）にログインしてセラー設定
5. Wing内の「**OpenAPIキー発行**」メニューから API キー発行
6. 発行されたキーをCompassに登録（→ 5章）

---

## 4. 手数料・入金

| 項目 | 料率 / 金額 | 備考 |
|---|---|---|
| **登録料** | 無料 | — |
| **販売手数料** | カテゴリ別 4〜11% | 商品によって異なる |
| **配送料処理手数料** | 配送料の 3% | VAT別 |
| **月額サービス料** | 50,000 KRW/月 | GMVが月100万KRW超のセラーのみ。家電/PC/エレクトロニクスは月500万KRW超から |
| **入金サイクル** | 月次精算 | 当月売上を翌月の第15営業日に支払い |
| **入金通貨** | USD / GBP / EUR 等 | JPY建ての可否は要問合せ |
| **入金最低額** | 月100万KRW | 未満は翌月繰越 |

参考：<https://globalsellers.coupang.com/en/seller-university/coupang-settlement/>

---

## 5. API利用に必要なもの

承認後、Wingで発行する **3点** の認証情報：

| 種類 | 取得方法 | 注意 |
|---|---|---|
| **Vendor ID** | Wing登録時に自動採番（A00xxxxxx形式） | 公開可能ID |
| **Access Key** | Wing > OpenAPIキー発行画面 | サーバー設定として安全保管 |
| **Secret Key** | 同上 | **初回しか表示されない**。即保管必須 |

- 認証方式：**HMAC-SHA256**（CEA-HMAC-SHA256）
- レート制限：**10 req/sec**（超過で429。Compassでは5〜8 req/sec で自動スロットリング）
- 発行から実利用まで **最大24時間**

> Compassの「設定 → 販売先 (Coupang)」画面でこの3点を入力すれば連携完了。
> 平文ではDB保存せず、`pgcrypto` で暗号化されます。

公式：<https://developers.coupangcorp.com/hc/en-us/articles/20288952179993-Issue-Open-API-Key-NEW>

---

## 6. ASIN取得・出品の流れ（Compass）

```
[Amazon検索]
   │  Chrome拡張で自動収集
   ▼
[ASIN受信トレイ]  ←── /products
   │  SP-APIで詳細取得
   ▼
[商品マスター(listings)]
   │  DeepLで日→韓翻訳
   ▼
[Coupangカテゴリ自動推定]  ←── Category Recommendation API
   │  原産地・製造社・A/S情報を補完
   ▼
[Coupangへ一括登録]  ←── /publish/[jobId]
   │  HMAC署名でWing API呼出
   ▼
[Coupangで販売開始]
```

ASINをそのまま渡せるAPIはありません。Coupang独自スキーマ（カテゴリID・必須属性・韓国語商品名・PCCC等）への変換はCompass側で自動化されます。

---

## 7. 取扱商品ガイド

### ❌ 禁制品（販売不可）

- 冷蔵・冷凍食品
- アルコール
- タバコ
- 医薬品

### ⚠️ KC認証必要（事実上ハードル高）

韓国で技術基準適合認証が必要なカテゴリ：
- 子供用品
- 電気電子製品（無線含む）
- 一部生活用品

KCマーク取得には認証費用・時間がかかるため、**初期は避ける**のが安全。

### ✅ 推奨カテゴリ

KC対象外で禁制品でないもの：
- 雑貨・キッチン用品
- アパレル（ライセンス品でないもの）
- 文具
- ホビー / フィギュア
- ペット用品

### 化粧品

韓国の薬事法（화장품법）対象。機能性化粧品は別途認証が必要。**初期は避ける**を推奨。

公式：
- <https://globalsellers.coupang.com/en/rules-and-policies/restricted-products/>
- <https://globalsellers.coupang.com/en/rules-and-policies/kc-guidelines-for-coupang-global-sellers/>

---

## 8. PCCC（個人通関固有符号）について

韓国の購入者は、海外商品の個人輸入時に **PCCC（13桁の英数字）** を入力する必要があります。

- 取得は **バイヤー責任**（セラーが取得する必要なし）
- Compass では商品作成時に `pccNeeded: true` を自動セット
- 購入時にCoupang画面でPCCC入力が要求される

---

## 9. 物流

- 国際配送業者は加盟店が選定（DHL / FedEx / EMS / 佐川グローバル等、追跡番号が確実に取れるもの）
- 出荷地住所・返品受付住所は **日本国内でOK**
- Wing/API で事前登録が必要（Compass の「設定 → 送料」で設定可）
- USA→韓国で30kg以下が3〜4日が目安（日本からはより短いはず）

> **未確認**：Coupang指定フォワーダーの有無。フランチャイズ本部からおすすめの業者リストを別途共有予定。

---

## 10. 準備チェックリスト

加盟前に揃えるもの：

- [ ] 法人登記簿謄本 or 個人事業の開業届控え（英訳）
- [ ] 代表者パスポート（有効期限6ヶ月以上）
- [ ] 事業オーナーシップ証明
- [ ] 銀行残高証明 or 口座証明書（SWIFTコード必須）
- [ ] 担当者の英語/韓国語対応可能なメールアドレス・電話番号
- [ ] 取扱商品が禁制品/KC対象外であることの確認
- [ ] 商品画像（白背景・正方形・商品95%占有）の作成体制
- [ ] 韓国語商品名・商品説明の翻訳体制（CompassがDeepL自動翻訳を提供）
- [ ] 出荷地住所・返品受付住所（日本国内）の決定
- [ ] 受取用の外貨対応銀行口座（USD推奨）
- [ ] 国際配送業者の選定

加盟後（Coupang承認後）：

- [ ] Wing登録 → OpenAPIキー発行
- [ ] **Secret Keyを発行直後にコピー保管**（再表示不可）
- [ ] Compassの「設定 → 販売先 (Coupang)」に Vendor ID / Access Key / Secret Key を登録
- [ ] 接続テスト → 成功確認
- [ ] 「設定 → 仕入元 (Amazon)」で SP-API 認証
- [ ] Chrome拡張をインストールしてASIN収集テスト
- [ ] テスト商品1件をCoupangへ出品し、却下されないか確認

---

## 11. サポート連絡先

- **Coupang Global Seller サポート**: helpseller_global@coupang.com
- **Compassフランチャイズ本部**: （本部連絡先を入れる）
- **Coupang Wing 公式ヘルプ**: <https://developers.coupangcorp.com/hc/en-us>

---

## 付録：公式リソース

| URL | 内容 |
|---|---|
| <https://globalsellers.coupang.com/en/> | Global Marketplace 公式 |
| <https://globalsellers.coupang.com/en/faq/> | FAQ（必要書類・審査期間） |
| <https://wing.coupang.com> | セラー管理画面（要ログイン、韓国語/英語） |
| <https://developers.coupangcorp.com/hc/en-us> | OpenAPI公式ドキュメント |
| <https://developers.coupangcorp.com/hc/en-us/articles/20288952179993-Issue-Open-API-Key-NEW> | OpenAPIキー発行手順 |
| <https://developers.coupangcorp.com/hc/en-us/articles/360033461914-Creating-HMAC-Signature> | HMAC署名生成 |
| <https://globalsellers.coupang.com/en/seller-university/coupang-settlement/> | 入金・精算ルール |
| <https://globalsellers.coupang.com/en/rules-and-policies/restricted-products/> | 販売禁止商品 |
| <https://globalsellers.coupang.com/en/rules-and-policies/kc-guidelines-for-coupang-global-sellers/> | KC認証ガイド |

---

**最終更新：2026-04-25**
情報の鮮度は3ヶ月で再確認推奨（Coupang仕様変更頻度が高めのため）
