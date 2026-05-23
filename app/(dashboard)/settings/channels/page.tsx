import {
  CheckCircle2,
  Plug,
  KeyRound,
  Eye,
  AlertTriangle,
  ExternalLink,
  Globe,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  coupangConnection,
  csvChannelConnections,
  type CsvChannelConnection,
} from '@/lib/mock-data';

export default function ChannelSettingsPage() {
  const c = coupangConnection;
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <PageHeader
        title="販売先設定"
        description="Coupang（API自動出品）／NAVER Smartstore・11番街（CSV連携）"
      />

      <Card className="border-info/30 bg-info/5">
        <CardContent className="p-4 flex items-start gap-3 text-sm">
          <Globe className="h-5 w-5 text-info shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <div className="font-medium">Coupang Global Marketplace 想定</div>
            <p className="text-xs text-muted-foreground">
              Compassは越境セラー（Global Marketplace）として日本事業者がそのまま参入する設計です。
              韓国法人・韓国銀行口座・事業者登録番号は不要。事業者証明・代表者パスポート・銀行口座証明（SWIFTコード必須）の4書類で
              <strong className="text-foreground">最大5営業日</strong>で承認されます。
            </p>
            <a
              href="https://globalsellers.coupang.com/en/faq/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-info hover:underline inline-flex items-center gap-1"
            >
              Global Sellers FAQ <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plug className="h-4 w-4 text-primary" />
            {c.label}
            <Badge variant="success">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              接続済み
            </Badge>
            <span className="text-xs text-muted-foreground ml-auto">
              最終確認 {c.lastCheckedAt.slice(5, 16).replace('T', ' ')}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {c.fields.map((f) => {
            const helper =
              f.key === 'Vendor ID'
                ? 'Wing登録時に自動採番（A00xxxxxx形式）'
                : f.key === 'Access Key'
                  ? 'Wing > OpenAPIキー発行で取得'
                  : f.key === 'Secret Key'
                    ? '※ 初回発行時のみ表示。再表示不可'
                    : undefined;
            return (
              <div
                key={f.key}
                className="grid grid-cols-1 md:grid-cols-4 items-start gap-3"
              >
                <label className="text-sm text-muted-foreground md:col-span-1 flex items-center gap-1.5 mt-2">
                  {f.sensitive && <KeyRound className="h-3 w-3" />}
                  {f.key}
                </label>
                <div className="md:col-span-3 space-y-1">
                  <div className="flex items-center gap-2">
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
                  {helper && (
                    <p className="text-[11px] text-muted-foreground">{helper}</p>
                  )}
                </div>
              </div>
            );
          })}

          <div className="flex items-start gap-2 rounded-md bg-warning/10 text-warning-foreground border border-warning/30 p-3 text-xs">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div className="text-foreground">
              <strong>Secret Key は Wing で発行した瞬間しか表示されません。</strong>
              発行直後にコピーし、ここまたはパスワードマネージャに保管してください。
              紛失時は Wing から再発行が必要で、発行から実利用可能まで最大24時間かかります。
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t">
            <Button size="sm" variant="outline">
              接続テスト
            </Button>
            <Button size="sm">保存</Button>
            <Button size="sm" variant="ghost" className="text-destructive">
              連携解除
            </Button>
          </div>

          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
            <div>
              <strong className="text-foreground">認証方式：</strong> HMAC-SHA256（CEA-HMAC-SHA256）独自署名。
              Refresh Token概念なし。
            </div>
            <div>
              <strong className="text-foreground">レート制限：</strong> 10 req/sec を超えると 429。
              一括出品時は <code>5〜8 req/sec</code> でスロットリング。
            </div>
            <div>
              <strong className="text-foreground">DB保存時：</strong> <code>pgcrypto</code> で暗号化。平文では一切保持しません。
            </div>
            <div>
              <a
                href="https://developers.coupangcorp.com/hc/en-us/articles/360033461914-Creating-HMAC-Signature"
                target="_blank"
                rel="noopener noreferrer"
                className="text-info hover:underline inline-flex items-center gap-1"
              >
                HMAC署名の生成手順（公式） <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">手数料・入金</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label="販売手数料" value="4〜11%" hint="カテゴリ別" />
          <Stat label="配送料処理" value="3%" hint="VAT別" />
          <Stat label="月額" value="50,000 KRW" hint="GMV 100万KRW超" />
          <Stat label="入金" value="月次" hint="翌月15営業日" />
        </CardContent>
      </Card>

      <div className="pt-2 text-sm font-medium text-muted-foreground">
        CSV連携の出品先（NAVER Smartstore／11番街）
      </div>
      {csvChannelConnections.map((c) => (
        <CsvChannelCard key={c.channel} conn={c} />
      ))}
    </div>
  );
}

function CsvChannelCard({ conn }: { conn: CsvChannelConnection }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
          {conn.label}
          {conn.connected ? (
            <Badge variant="success">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              連携設定済み
            </Badge>
          ) : (
            <Badge variant="muted">未設定</Badge>
          )}
          <Badge variant="info">CSV連携</Badge>
          <span className="text-xs text-muted-foreground ml-auto">
            最終出力 {conn.lastExportAt.slice(5, 16).replace('T', ' ')}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat
            label="累計エクスポート"
            value={`${conn.exportedCount.toLocaleString()} 件`}
            hint="このチャネルへ出力済み"
          />
          <div className="rounded-md border p-3 md:col-span-2">
            <div className="text-xs text-muted-foreground">CSV様式</div>
            <div className="text-sm font-medium mt-1">{conn.csvSpec}</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{conn.note}</p>
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button size="sm">
            <Download className="h-4 w-4" />
            出品CSVを生成
          </Button>
          <Button size="sm" variant="outline">
            様式テンプレートDL
          </Button>
          <Button size="sm" variant="ghost" className="text-muted-foreground">
            カテゴリマッピング
          </Button>
        </div>
        <div className="flex items-start gap-2 rounded-md bg-info/10 border border-info/30 p-3 text-xs text-foreground">
          <FileSpreadsheet className="h-4 w-4 text-info shrink-0 mt-0.5" />
          <div>
            CoupangのようなAPI自動出品ではなく、整形済みCSVを生成 → 各モールの一括登録画面から取込む運用です。
            出力時に禁止ワード辞書・知財警告ブランドDBのチェックが自動適用されます。
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums mt-1">{value}</div>
      <div className="text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}
