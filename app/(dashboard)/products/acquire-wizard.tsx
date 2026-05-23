'use client';

import * as React from 'react';
import {
  Chrome,
  Search,
  Send,
  CheckCircle2,
  Copy,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const EXT_PATH = String.raw`C:\Users\h-hashimoto\Desktop\compass-mockup\chrome-extension`;

const SEARCH_PRESETS = [
  { label: 'Anker（モバイルバッテリー）', q: 'anker モバイルバッテリー' },
  { label: 'ユニクロ（ヒートテック）', q: 'ユニクロ ヒートテック' },
  { label: 'Sony（ヘッドホン）', q: 'sony ヘッドホン' },
  { label: '無印良品', q: '無印良品' },
];

export function AcquireWizard({ hasReceived }: { hasReceived: boolean }) {
  // 受信済みなら自動でたたむ
  const [open, setOpen] = React.useState(!hasReceived);
  const [copied, setCopied] = React.useState(false);
  const [customQuery, setCustomQuery] = React.useState('');

  const copy = async () => {
    await navigator.clipboard.writeText(EXT_PATH);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const openAmazon = (q: string) => {
    window.open(
      `https://www.amazon.co.jp/s?k=${encodeURIComponent(q)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
        aria-expanded={open}
      >
        <div className="grid place-items-center h-9 w-9 rounded-md bg-primary/10 text-primary">
          <Chrome className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold flex items-center gap-2">
            ASIN取得ガイド
            {hasReceived ? (
              <Badge variant="success">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                取得済
              </Badge>
            ) : (
              <Badge variant="info">3ステップで完了</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Chrome拡張で Amazon.co.jp の検索結果から ASIN を一括収集
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <CardContent className="border-t pt-5 space-y-5">
          {/* ステップ1: 拡張インストール */}
          <Step
            n={1}
            title="Chrome拡張をインストール（初回のみ）"
            done={hasReceived}
            help="Chromeに自作の収集ツールを読み込ませます。一度入れれば次回から不要。"
          >
            <ol className="space-y-2 text-xs text-muted-foreground list-decimal pl-5">
              <li>
                Chromeで <code className="text-foreground">chrome://extensions/</code> を開く
                <button
                  type="button"
                  onClick={() => copyText('chrome://extensions/')}
                  className="ml-1 text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  <Copy className="h-3 w-3" />
                  コピー
                </button>
              </li>
              <li>
                右上の「<strong className="text-foreground">デベロッパーモード</strong>」を ON
              </li>
              <li>
                「<strong className="text-foreground">パッケージ化されていない拡張機能を読み込む</strong>」をクリック
              </li>
              <li>
                以下のフォルダを選択：
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 bg-muted/50 px-2 py-1 rounded text-[11px] text-foreground break-all">
                    {EXT_PATH}
                  </code>
                  <Button size="sm" variant="outline" onClick={copy}>
                    <Copy className="h-3 w-3" />
                    {copied ? 'コピーしました' : 'パスをコピー'}
                  </Button>
                </div>
              </li>
            </ol>
          </Step>

          {/* ステップ2: Amazon を開く */}
          <Step
            n={2}
            title="Amazon.co.jp で検索"
            done={hasReceived}
            help="売りたい商品のキーワードで検索。検索結果ページに行くと拡張が自動でASINを検出します。"
          >
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                よく使うキーワードからすぐ開く：
              </div>
              <div className="flex flex-wrap gap-2">
                {SEARCH_PRESETS.map((p) => (
                  <Button
                    key={p.q}
                    size="sm"
                    variant="outline"
                    onClick={() => openAmazon(p.q)}
                  >
                    <Search className="h-3 w-3" />
                    {p.label}
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder="自由入力（例：bluetoothイヤホン）"
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                  className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customQuery.trim()) {
                      openAmazon(customQuery.trim());
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => customQuery.trim() && openAmazon(customQuery.trim())}
                  disabled={!customQuery.trim()}
                >
                  <Search className="h-3 w-3" />
                  Amazonで開く
                </Button>
              </div>
            </div>
          </Step>

          {/* ステップ3: 拡張から送信 */}
          <Step
            n={3}
            title="拡張から「Compassへ送信」"
            done={hasReceived}
            help="Amazonページ右下に「N ASIN 検出」バッジが出る → Chrome右上のパズルアイコン → Compass ASIN Collector → 「Compassへ送信」ボタン"
          >
            <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1.5">
              <Bullet>
                <span>
                  検索結果に切り替わると右下に <Badge variant="info">N ASIN 検出</Badge> バッジが出る（無限スクロールで自動加算）
                </span>
              </Bullet>
              <Bullet>
                <span>
                  Chrome右上 <strong>🧩 パズルアイコン</strong> →「Compass ASIN Collector」を選択
                </span>
              </Bullet>
              <Bullet>
                <span>
                  ポップアップで件数とプレビュー確認 → <strong>「Compassへ送信」</strong> ボタン
                </span>
              </Bullet>
              <Bullet>
                <span>
                  下のリストに届く → 各行の「ドライラン」で Coupang 登録ペイロードを確認
                </span>
              </Bullet>
            </div>
          </Step>

          <div className="flex items-start gap-2 rounded-md bg-info/10 border border-info/30 p-3 text-xs">
            <Send className="h-4 w-4 text-info shrink-0 mt-0.5" />
            <div>
              拡張なしでAPI動作だけ試したい時は curl で直接送れます（受信トレイ下の <strong>空状態の説明</strong> を参照）
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function Step({
  n,
  title,
  done,
  help,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-start gap-3 mb-2">
        <div
          className={
            'grid place-items-center h-7 w-7 rounded-full text-xs font-bold shrink-0 ' +
            (done
              ? 'bg-success text-success-foreground'
              : 'bg-primary/10 text-primary')
          }
        >
          {done ? <CheckCircle2 className="h-4 w-4" /> : n}
        </div>
        <div className="flex-1 pt-0.5">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{help}</div>
        </div>
      </div>
      <div className="ml-10">{children}</div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-primary mt-0.5">•</span>
      <span>{children}</span>
    </div>
  );
}

async function copyText(t: string) {
  try {
    await navigator.clipboard.writeText(t);
  } catch {
    /* ignore */
  }
}
