'use client';

import * as React from 'react';
import { Send, X, Copy, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Result = {
  asin: string;
  steps: {
    spApi: {
      title: string;
      brand: string | null;
      priceJpy: number | null;
      source: 'mock' | 'sp-api';
    };
    translation: {
      title: { source: 'deepl' | 'mock'; ja: string; ko: string };
    };
    category: {
      displayCategoryCode: number;
      displayCategoryName: string;
      source: string;
      confidence: number;
    };
    pricing: {
      costJpy: number;
      jpyTotal: number;
      krwFinal: number;
      fxRate: number;
      marginRate: number;
    };
  };
  payload: unknown;
  signedRequest: {
    url: string;
    method: string;
    headers: Record<string, string>;
    bodyBytes: number;
    debug: { signedDate: string; message: string };
  };
};

export function DryRunButton({ asin }: { asin: string }) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<Result | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  const run = async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/coupang/dry-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asin }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
      } else {
        setResult(json);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={run}>
        <Send className="h-3.5 w-3.5" />
        ドライラン
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            className="bg-background rounded-lg shadow-xl border w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 h-12 border-b">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">
                  Coupang ドライラン — {asin}
                </span>
                <Badge variant="info">ペイロード生成のみ</Badge>
              </div>
              <button
                onClick={() => !loading && setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
              {loading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  パイプライン実行中（AMAZON-API → 翻訳 → カテゴリ推定 → ペイロード生成 → HMAC署名）
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-md bg-destructive/10 text-destructive p-3 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {result && (
                <>
                  <Section title="✓ パイプライン結果">
                    <KV
                      label="AMAZON-API取得"
                      value={`${result.steps.spApi.title} (${result.steps.spApi.brand ?? 'NoBrand'}) ¥${result.steps.spApi.priceJpy?.toLocaleString() ?? '—'}`}
                      hint={`source=${result.steps.spApi.source}`}
                    />
                    <KV
                      label="翻訳 (KO)"
                      value={result.steps.translation.title.ko}
                      hint={`source=${result.steps.translation.title.source}`}
                    />
                    <KV
                      label="カテゴリ推定"
                      value={`[${result.steps.category.displayCategoryCode}] ${result.steps.category.displayCategoryName}`}
                      hint={`source=${result.steps.category.source} / confidence=${(result.steps.category.confidence * 100).toFixed(0)}%`}
                    />
                    <KV
                      label="価格"
                      value={`¥${result.steps.pricing.jpyTotal.toLocaleString()} → ₩${result.steps.pricing.krwFinal.toLocaleString()}`}
                      hint={`fx=${result.steps.pricing.fxRate} / margin=${result.steps.pricing.marginRate}%`}
                    />
                  </Section>

                  <Section
                    title="✓ HMAC署名済みリクエスト"
                    action={
                      <button
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                        onClick={() =>
                          copy(
                            `curl -X ${result.signedRequest.method} "${result.signedRequest.url}" \\\n` +
                              Object.entries(result.signedRequest.headers)
                                .map(([k, v]) => `  -H "${k}: ${v}"`)
                                .join(' \\\n') +
                              ` \\\n  --data-raw '${JSON.stringify(result.payload)}'`,
                            'curl',
                          )
                        }
                      >
                        <Copy className="h-3 w-3" />
                        {copied === 'curl' ? 'コピーしました' : 'curl をコピー'}
                      </button>
                    }
                  >
                    <pre className="bg-muted/50 p-3 rounded text-[11px] overflow-x-auto">
                      {`${result.signedRequest.method} ${result.signedRequest.url}\n\n` +
                        Object.entries(result.signedRequest.headers)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join('\n') +
                        `\n\nbody bytes: ${result.signedRequest.bodyBytes}\nsigned-date: ${result.signedRequest.debug.signedDate}\nmessage: ${result.signedRequest.debug.message}`}
                    </pre>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      ※ Authorization の access-key / signature は表示時にマスクされています。
                      env に COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY を設定するとマスク前の本物が生成されます。
                    </div>
                  </Section>

                  <Section
                    title="✓ Coupangへ送るペイロード（POST seller-products）"
                    action={
                      <button
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                        onClick={() =>
                          copy(
                            JSON.stringify(result.payload, null, 2),
                            'payload',
                          )
                        }
                      >
                        <Copy className="h-3 w-3" />
                        {copied === 'payload' ? 'コピーしました' : 'JSONをコピー'}
                      </button>
                    }
                  >
                    <pre className="bg-muted/50 p-3 rounded text-[11px] overflow-x-auto max-h-[40vh]">
                      {JSON.stringify(result.payload, null, 2)}
                    </pre>
                  </Section>

                  <div className="flex items-start gap-2 rounded-md bg-info/10 text-info-foreground border border-info/30 p-3 text-xs">
                    <CheckCircle2 className="h-4 w-4 text-info shrink-0 mt-0.5" />
                    <div className="text-foreground">
                      <strong>本番送信に切り替えるには</strong>：
                      <code>.env.local</code> に <code>COUPANG_VENDOR_ID</code> /
                      <code>COUPANG_ACCESS_KEY</code> /
                      <code>COUPANG_SECRET_KEY</code> を設定し、
                      <code>POST /api/coupang/submit</code> を呼ぶ。
                      ドライランのまま保たれるのは demo キーのまま動かしている時だけ。
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="border-t px-5 h-12 flex items-center justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => !loading && setOpen(false)}
              >
                閉じる
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-foreground">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function KV({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-baseline gap-3 py-1 border-b last:border-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>
        <div className="text-sm">{value}</div>
        {hint && (
          <div className="text-[10px] text-muted-foreground">{hint}</div>
        )}
      </div>
    </div>
  );
}
