import {
  CheckCircle2,
  KeyRound,
  Eye,
  Chrome,
  Download,
  ShoppingCart,
  AlertCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  amazonConnection,
  sourceConnections,
  type SourceConnection,
} from '@/lib/mock-data';

export default function SourceSettingsPage() {
  const a = amazonConnection;
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <PageHeader
        title="仕入元設定"
        description="登録元：Amazon（ASIN自動取得）／楽天・Yahoo!ショッピング（手動取得）"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Chrome className="h-4 w-4 text-primary" />
            {a.label}
            <Badge variant="success">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              接続済み
            </Badge>
            <span className="text-xs text-muted-foreground ml-auto">
              最終確認 {a.lastCheckedAt.slice(5, 16).replace('T', ' ')}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {a.fields.map((f) => (
            <div
              key={f.key}
              className="grid grid-cols-1 md:grid-cols-4 items-center gap-3"
            >
              <label className="text-sm text-muted-foreground md:col-span-1 flex items-center gap-1.5">
                {f.sensitive && <KeyRound className="h-3 w-3" />}
                {f.key}
              </label>
              <div className="md:col-span-2 flex items-center gap-2">
                <Input
                  defaultValue={f.value}
                  readOnly={f.sensitive}
                  className="font-mono text-sm"
                />
                {f.sensitive && (
                  <Button size="sm" variant="ghost">
                    <Eye className="h-3.5 w-3.5" />
                    変更
                  </Button>
                )}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button size="sm" variant="outline">
              接続テスト
            </Button>
            <Button size="sm">保存</Button>
          </div>
          <div className="text-xs text-muted-foreground pt-2 border-t">
            AMAZON-API は GetCatalogItem / GetItemOffers のみ呼出（GET系のみ）。書き込みAPIは使用しません。
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Chrome className="h-4 w-4 text-info" />
            Chrome 拡張（ASIN取得）
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Amazon.co.jp の検索結果ページで自動的にASINを抽出し、Compassへ送信する Chrome拡張です。
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-xs text-muted-foreground">
            <li>
              <code>chrome-extension/</code> フォルダを Chrome の「拡張機能 → デベロッパーモード → パッケージ化されていない拡張機能を読み込む」で読み込む
            </li>
            <li>
              <code>https://www.amazon.co.jp/s?k=...</code> を開くと自動でASINを検出
            </li>
            <li>
              拡張アイコンをクリック → 「Compassへ送信」で受信トレイに登録
            </li>
          </ol>
          <div className="flex items-center gap-2 pt-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" />
              chrome-extension をZIPダウンロード
            </Button>
            <Badge variant="info">送信先: http://localhost:3000/api/asins</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="pt-2 text-sm font-medium text-muted-foreground">
        その他の仕入元（手動取得）
      </div>
      {sourceConnections.map((s) => (
        <SourceConnectionCard key={s.source} conn={s} />
      ))}
    </div>
  );
}

function SourceConnectionCard({ conn }: { conn: SourceConnection }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          {conn.label}
          {conn.connected ? (
            <Badge variant="success">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              接続済み
            </Badge>
          ) : (
            <Badge variant="muted">
              <AlertCircle className="h-3 w-3 mr-1" />
              未接続
            </Badge>
          )}
          <Badge variant="outline">手動取得</Badge>
          <span className="text-xs text-muted-foreground ml-auto">
            最終確認 {conn.lastCheckedAt}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {conn.fields.map((f) => (
          <div
            key={f.key}
            className="grid grid-cols-1 md:grid-cols-4 items-center gap-3"
          >
            <label className="text-sm text-muted-foreground md:col-span-1 flex items-center gap-1.5">
              {f.sensitive && <KeyRound className="h-3 w-3" />}
              {f.key}
            </label>
            <div className="md:col-span-2 flex items-center gap-2">
              <Input
                defaultValue={f.value}
                readOnly={f.sensitive}
                className="font-mono text-sm"
              />
              {f.sensitive && (
                <Button size="sm" variant="ghost">
                  <Eye className="h-3.5 w-3.5" />
                  変更
                </Button>
              )}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button size="sm" variant="outline">
            接続テスト
          </Button>
          <Button size="sm">保存</Button>
        </div>
        <div className="text-xs text-muted-foreground pt-2 border-t">
          {conn.note}
        </div>
      </CardContent>
    </Card>
  );
}
