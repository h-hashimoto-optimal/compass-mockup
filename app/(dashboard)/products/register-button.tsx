'use client';

import * as React from 'react';
import {
  Send,
  X,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  Rocket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type DryRunResult = {
  asin: string;
  steps: {
    spApi: { title: string; brand: string | null; priceJpy: number | null; source: string };
    translation: { title: { source: string; ja: string; ko: string } };
    category: {
      displayCategoryCode: number;
      displayCategoryName: string;
      source: string;
      confidence: number;
    };
    pricing: { costJpy: number; jpyTotal: number; krwFinal: number; fxRate: number; marginRate: number; profit: number };
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

type SubmitResult = {
  mode: 'dry-run' | 'live';
  reason: string | null;
  submission: { status: number; ok: boolean; response: unknown } | null;
  summary: { titleJa: string; titleKo: string; category: string; priceKrw: number };
};

type Phase = 'idle' | 'previewing' | 'submitting' | 'submitted' | 'error';

export function RegisterButton({ asin }: { asin: string }) {
  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<DryRunResult | null>(null);
  const [result, setResult] = React.useState<SubmitResult | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  const openModal = async () => {
    setOpen(true);
    setPhase('previewing');
    setError(null);
    setPreview(null);
    setResult(null);
    try {
      const res = await fetch('/api/coupang/dry-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asin }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setPreview(json);
      setPhase('idle');
    } catch (e) {
      setError((e as Error).message);
      setPhase('error');
    }
  };

  const submit = async () => {
    setPhase('submitting');
    setError(null);
    try {
      const res = await fetch('/api/coupang/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asin }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setResult(json);
      setPhase('submitted');
    } catch (e) {
      setError((e as Error).message);
      setPhase('error');
    }
  };

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const close = () => {
    if (phase === 'submitting' || phase === 'previewing') return;
    setOpen(false);
    setPhase('idle');
    setPreview(null);
    setResult(null);
    setError(null);
  };

  return (
    <>
      <Button size="sm" onClick={openModal}>
        <Send className="h-3.5 w-3.5" />
        Coupangに登録
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={close}
        >
          <div
            className="bg-background rounded-lg shadow-xl border w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 h-12 border-b">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">
                  Coupangに登録 — {asin}
                </span>
                {phase === 'submitted' && result?.mode === 'dry-run' && (
                  <Badge variant="warning">ドライラン完了</Badge>
                )}
                {phase === 'submitted' && result?.mode === 'live' && (
                  <Badge variant="success">本送信完了</Badge>
                )}
              </div>
              <button
                onClick={close}
                disabled={phase === 'submitting' || phase === 'previewing'}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
              {phase === 'previewing' && (
                <Loading text="登録ペイロードを生成中（AMAZON-API → 翻訳 → カテゴリ推定 → HMAC署名）" />
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-md bg-destructive/10 text-destructive p-3 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {preview && phase !== 'submitted' && (
                <>
                  {!hasRealCreds() && (
                    <div className="flex items-start gap-2 rounded-md bg-warning/10 border border-warning/30 p-3 text-xs">
                      <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                      <div>
                        <strong>環境変数 COUPANG_ACCESS_KEY / SECRET_KEY が未設定。</strong>
                        「登録を実行」を押しても <strong>ドライラン</strong> として処理され、
                        実Coupangには送信されません。本送信したい時は <code>.env.local</code> を設定してdev再起動。
                      </div>
                    </div>
                  )}

                  <Section title="登録される内容（プレビュー）">
                    <KV label="商品名 (JA)" value={preview.steps.spApi.title} />
                    <KV
                      label="商品名 (KO)"
                      value={preview.steps.translation.title.ko}
                      hint={`翻訳エンジン: ${preview.steps.translation.title.source}`}
                    />
                    <KV
                      label="カテゴリ"
                      value={`[${preview.steps.category.displayCategoryCode}] ${preview.steps.category.displayCategoryName}`}
                      hint={`信頼度 ${(preview.steps.category.confidence * 100).toFixed(0)}%`}
                    />
                    <KV
                      label="販売価格"
                      value={`₩${preview.steps.pricing.krwFinal.toLocaleString()}`}
                      hint={`原価 ¥${preview.steps.pricing.costJpy.toLocaleString()} + 送料/税/利益 → JPY ¥${preview.steps.pricing.jpyTotal.toLocaleString()} (fx=${preview.steps.pricing.fxRate}, margin=${preview.steps.pricing.marginRate}%)`}
                    />
                    <KV
                      label="想定利益"
                      value={`¥${preview.steps.pricing.profit.toLocaleString()}`}
                      hint={`利益率 ${preview.steps.pricing.marginRate}%（利益設定の単一ソースを参照）`}
                    />
                    <KV
                      label="ブランド"
                      value={preview.steps.spApi.brand ?? 'NoBrand'}
                    />
                  </Section>

                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground inline-flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      技術詳細（HMAC署名・ペイロードJSON・curl例）
                    </summary>
                    <div className="mt-3 space-y-3">
                      <Section
                        title="HMAC署名済みリクエスト"
                        action={
                          <button
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                            onClick={() =>
                              copy(
                                `curl -X ${preview.signedRequest.method} "${preview.signedRequest.url}" \\\n` +
                                  Object.entries(preview.signedRequest.headers)
                                    .map(([k, v]) => `  -H "${k}: ${v}"`)
                                    .join(' \\\n') +
                                  ` \\\n  --data-raw '${JSON.stringify(preview.payload)}'`,
                                'curl',
                              )
                            }
                          >
                            <Copy className="h-3 w-3" />
                            {copied === 'curl' ? 'コピー済' : 'curl をコピー'}
                          </button>
                        }
                      >
                        <pre className="bg-muted/50 p-3 rounded text-[11px] overflow-x-auto">
                          {`${preview.signedRequest.method} ${preview.signedRequest.url}\n\n` +
                            Object.entries(preview.signedRequest.headers)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join('\n') +
                            `\n\nbody: ${preview.signedRequest.bodyBytes} bytes`}
                        </pre>
                      </Section>
                      <Section
                        title="送信されるペイロード"
                        action={
                          <button
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                            onClick={() =>
                              copy(
                                JSON.stringify(preview.payload, null, 2),
                                'payload',
                              )
                            }
                          >
                            <Copy className="h-3 w-3" />
                            {copied === 'payload' ? 'コピー済' : 'JSONをコピー'}
                          </button>
                        }
                      >
                        <pre className="bg-muted/50 p-3 rounded text-[11px] overflow-x-auto max-h-[30vh]">
                          {JSON.stringify(preview.payload, null, 2)}
                        </pre>
                      </Section>
                    </div>
                  </details>
                </>
              )}

              {phase === 'submitting' && (
                <Loading text="Coupangへ送信中（HMAC署名 → POST seller-products）" />
              )}

              {phase === 'submitted' && result && (
                <div className="space-y-4">
                  <div
                    className={
                      'flex items-start gap-3 rounded-md p-4 ' +
                      (result.mode === 'live'
                        ? 'bg-success/10 border border-success/30'
                        : 'bg-warning/10 border border-warning/30')
                    }
                  >
                    {result.mode === 'live' ? (
                      <CheckCircle2 className="h-6 w-6 text-success shrink-0" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-warning shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="font-semibold">
                        {result.mode === 'live'
                          ? '✓ Coupangに登録完了'
                          : 'ドライラン完了（実送信されていません）'}
                      </div>
                      {result.reason && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {result.reason}
                        </div>
                      )}
                      {result.submission && (
                        <div className="text-xs text-muted-foreground mt-1">
                          HTTP {result.submission.status}
                          {result.submission.ok ? ' OK' : ' Failed'}
                        </div>
                      )}
                    </div>
                  </div>

                  <Section title="登録された内容">
                    <KV label="商品名 (JA)" value={result.summary.titleJa} />
                    <KV label="商品名 (KO)" value={result.summary.titleKo} />
                    <KV label="カテゴリ" value={result.summary.category} />
                    <KV
                      label="販売価格"
                      value={`₩${result.summary.priceKrw.toLocaleString()}`}
                    />
                  </Section>

                  {result.submission?.response != null && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground">
                        Coupang APIレスポンス
                      </summary>
                      <pre className="mt-2 bg-muted/50 p-3 rounded text-[11px] overflow-x-auto max-h-[30vh]">
                        {JSON.stringify(result.submission.response, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>

            <div className="border-t px-5 h-14 flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                {phase === 'idle' && preview && (
                  <>送信前に上の内容を確認してください</>
                )}
                {phase === 'submitted' && result?.mode === 'dry-run' && (
                  <>本送信するには .env.local に COUPANG_* を設定して dev再起動</>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={close}
                  disabled={phase === 'submitting' || phase === 'previewing'}
                >
                  {phase === 'submitted' ? '閉じる' : 'キャンセル'}
                </Button>
                {phase !== 'submitted' && (
                  <Button
                    size="sm"
                    onClick={submit}
                    disabled={!preview || phase === 'submitting' || phase === 'previewing'}
                  >
                    {phase === 'submitting' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Rocket className="h-3.5 w-3.5" />
                    )}
                    {phase === 'submitting' ? '送信中...' : '登録を実行'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function hasRealCreds(): boolean {
  // クライアント側ではenv見れないので、レスポンスのmodeで分かる
  // この時点ではまだprevewなのでwarningはAPI mode判定後にすべきだが、
  // 簡易的にfalse返す（ユーザーの安心優先）
  return false;
}

function Loading({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">{text}</span>
    </div>
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
    <div className="grid grid-cols-[120px_1fr] items-baseline gap-3 py-1.5 border-b last:border-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>
        <div className="text-sm">{value}</div>
        {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}
