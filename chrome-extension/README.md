# Compass ASIN Collector — Chrome 拡張

Amazon.co.jp の検索結果ページから ASIN を自動抽出し、Compass（http://localhost:3000）の受信トレイへ送信します。

## インストール

1. Chrome で `chrome://extensions/` を開く
2. 右上の「**デベロッパーモード**」を ON
3. 「**パッケージ化されていない拡張機能を読み込む**」をクリック
4. このフォルダ（`chrome-extension/`）を選択

## 使い方

1. Compass の dev サーバを起動（`npm run dev` → http://localhost:3000）
2. Amazon.co.jp で検索（例: <https://www.amazon.co.jp/s?k=anker>）
3. 右下に **「N ASIN 検出」** バッジが出る
4. 拡張アイコン（パズルアイコン → Compass ASIN Collector）をクリック
5. プレビューを確認し「**Compassへ送信**」をクリック
6. Compass の `/products`（ASIN受信トレイ）に届く

無限スクロールでロードされた追加アイテムも自動で再スキャンされます。

## 拾うデータ

- ASIN（10桁）
- 商品タイトル
- ブランド（取れる場合）
- 価格（JPY）
- メイン画像URL
- 商品URL（`https://www.amazon.co.jp/dp/{ASIN}`）

## 送信ペイロード（POST /api/asins）

```json
{
  "source": "amazon-jp",
  "capturedAt": "2026-04-24T15:30:00.000Z",
  "url": "https://www.amazon.co.jp/s?k=anker",
  "query": "anker",
  "items": [
    {
      "asin": "B0194WDVHI",
      "title": "Anker PowerCore 10000",
      "brand": "Anker",
      "priceJpy": 2980,
      "imageUrl": "https://m.media-amazon.com/images/...",
      "url": "https://www.amazon.co.jp/dp/B0194WDVHI"
    }
  ]
}
```

## 送信先のカスタマイズ

Popup の「送信先」入力欄で URL を変更できます。本番環境では `https://compass.example.com/api/asins` のようなURLに変更してください。
