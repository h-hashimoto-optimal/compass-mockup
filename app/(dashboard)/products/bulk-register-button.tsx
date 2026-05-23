'use client';

import * as React from 'react';
import {
  Send,
  X,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Rocket,
  Eye,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type DryRunResult = {
  asin: string;
  steps: {
    spApi: { title: string; brand: string | null; priceJpy: number | null };
    translation: { title: { ja: string; ko: string } };
    category: { displayCategoryCode: number; displayCategoryName: string; confidence: number };
    pricing: { costJpy: number; jpyTotal: number; krwFinal: number; marginRate: number };
  };
};

type PreviewState =
  | { status: 'pending' }
  | { status: 'loading' }
  | { status: 'ok'; data: DryRunResult }
  | { status: 'error'; message: string };

type SubmitState =
  | { status: 'pending' }
  | { status: 'running' }
  | { status: 'ok'; mode: 'live' | 'dry-run' }
  | { status: 'error'; message: string };

type Phase = 'idle' | 'previewing' | 'review' | 'running' | 'done';

export function BulkRegisterButton({ asins }: { asins: string[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [previews, setPreviews] = React.useState<Record<string, PreviewState>>({});
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [submitStates, setSubmitStates] = React.useState<Record<string, SubmitState>>({});

  const total = asins.length;

  const previewCounts = Object.values(previews).reduce(
    (acc, s) => {
      if (s.status === 'ok') acc.ok++;
      else if (s.status === 'error') acc.err++;
      else if (s.status === 'loading') acc.loading++;
      return acc;
    },
    { ok: 0, err: 0, loading: 0 },
  );

  const submitCounts = Object.values(submitStates).reduce(
    (acc, s) => {
      if (s.status === 'ok') acc.ok++;
      else if (s.status === 'error') acc.err++;
      else if (s.status === 'running') acc.running++;
      return acc;
    },
    { ok: 0, err: 0, running: 0 },
  );
  const selectedCount = selected.size;
  const submittedCount = submitCounts.ok + submitCounts.err;
  const submitPct = selectedCount > 0 ? (submittedCount / selectedCount) * 100 : 0;

  const openModal = async () => {
    setOpen(true);
    setPhase('previewing');
    setSubmitStates({});
    setSelected(new Set());

    const initial: Record<string, PreviewState> = {};
    asins.forEach((a) => (initial[a] = { status: 'loading' }));
    setPreviews(initial);

    const results = await Promise.all(
      asins.map(async (asin): Promise<[string, PreviewState]> => {
        try {
          const res = await fetch('/api/coupang/dry-run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ asin }),
          });
          const json = await res.json();
          if (!res.ok) return [asin, { status: 'error', message: json.error ?? `HTTP ${res.status}` }];
          return [asin, { status: 'ok', data: json }];
        } catch (e) {
          return [asin, { status: 'error', message: (e as Error).message }];
        }
      }),
    );

    const next: Record<string, PreviewState> = {};
    const initSelected = new Set<string>();
    for (const [asin, state] of results) {
      next[asin] = state;
      if (state.status === 'ok') initSelected.add(asin);
    }
    setPreviews(next);
    setSelected(initSelected);
    setPhase('review');
  };

  const toggleSelect = (asin: string) => {
    if (previews[asin]?.status !== 'ok') return;
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(asin)) next.delete(asin);
      else next.add(asin);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const okAsins = asins.filter((a) => previews[a]?.status === 'ok');
    if (selected.size === okAsins.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(okAsins));
    }
  };

  const startSubmit = async () => {
    setPhase('running');
    const targets = asins.filter((a) => selected.has(a));
    const initial: Record<string, SubmitState> = {};
    targets.forEach((a) => (initial[a] = { status: 'pending' }));
    setSubmitStates(initial);

    for (const asin of targets) {
      setSubmitStates((s) => ({ ...s, [asin]: { status: 'running' } }));
      try {
        const res = await fetch('/api/coupang/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ asin }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        setSubmitStates((s) => ({ ...s, [asin]: { status: 'ok', mode: json.mode } }));
      } catch (e) {
        setSubmitStates((s) => ({
          ...s,
          [asin]: { status: 'error', message: (e as Error).message },
        }));
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    setPhase('done');
  };

  const close = () => {
    if (phase === 'previewing' || phase === 'running') return;
    setOpen(false);
    setPhase('idle');
    setPreviews({});
    setSelected(new Set());
    setSubmitStates({});
    router.refresh();
  };

  return (
    <>
      <Button size="sm" onClick={openModal} disabled={total === 0}>
        <Send className="h-4 w-4" />
        全 {total} 件をCoupangへ登録
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={close}
        >
          <div
            className="bg-background rounded-lg shadow-xl border w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 h-12 border-b shrink-0">
              <div className="flex items-center gap-2">
                {phase === 'running' || phase === 'done' ? (
                  <Send className="h-4 w-4 text-primary" />
                ) : (
                  <Eye className="h-4 w-4 text-primary" />
                )}
                <span className="font-semibold text-sm">
                  {phase === 'running' || phase === 'done'
                    ? `Coupang一括登録 — ${selectedCount}件`
                    : `登録内容プレビュー — ${total}件`}
                </span>
                {phase === 'previewing' && (
                  <Badge variant="info">プレビュー生成中</Badge>
                )}
                {phase === 'review' && (
                  <Badge variant="info">内容を確認してください</Badge>
                )}
                {phase === 'done' && (
                  <Badge variant={submitCounts.err > 0 ? 'warning' : 'success'}>
                    完了
                  </Badge>
                )}
              </div>
              <button
                onClick={close}
                disabled={phase === 'previewing' || phase === 'running'}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
              {phase === 'previewing' && (
                <div className="rounded-md bg-info/10 border border-info/30 p-3 text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-info" />
                    <strong>
                      {previewCounts.ok + previewCounts.err} / {total} 件
                    </strong>
                    プレビュー生成中（AMAZON-API → 翻訳 → カテゴリ推定 → 価格計算）
                  </div>
                  <div className="text-muted-foreground">
                    ※ この段階ではCoupangへの送信は行いません。内容を確認してから「登録を実行」を押してください。
                  </div>
                </div>
              )}

              {phase === 'review' && (
                <div className="rounded-md bg-warning/10 border border-warning/30 p-3 text-xs space-y-1">
                  <div>
                    <strong>{previewCounts.ok}件</strong> の登録内容を確認してください。チェックを外した行は送信されません。
                    {previewCounts.err > 0 && (
                      <span className="text-destructive">
                        {' '}（プレビュー失敗 {previewCounts.err}件は自動で除外）
                      </span>
                    )}
                  </div>
                </div>
              )}

              {(phase === 'running' || phase === 'done') && (
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-medium">
                      進捗 {submittedCount} / {selectedCount}
                    </span>
                    <span className="text-muted-foreground">
                      {submitPct.toFixed(0)}%
                    </span>
                  </div>
                  <Progress value={submitPct} />
                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                    <Stat
                      icon={<CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                      label="成功"
                      value={submitCounts.ok}
                    />
                    <Stat
                      icon={<XCircle className="h-3.5 w-3.5 text-destructive" />}
                      label="失敗"
                      value={submitCounts.err}
                    />
                    <Stat
                      icon={
                        <Loader2
                          className={`h-3.5 w-3.5 ${
                            phase === 'running' ? 'animate-spin' : ''
                          } text-info`}
                        />
                      }
                      label="残り"
                      value={selectedCount - submittedCount}
                    />
                  </div>
                </div>
              )}

              {(phase === 'review' || phase === 'previewing') && (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <input
                            type="checkbox"
                            checked={
                              previewCounts.ok > 0 &&
                              selected.size ===
                                asins.filter((a) => previews[a]?.status === 'ok').length
                            }
                            onChange={toggleSelectAll}
                            disabled={phase === 'previewing'}
                            className="h-3.5 w-3.5"
                          />
                        </TableHead>
                        <TableHead className="w-24">ASIN</TableHead>
                        <TableHead>韓国語タイトル / カテゴリ</TableHead>
                        <TableHead className="text-right w-24">仕入¥</TableHead>
                        <TableHead className="text-right w-28">販売₩</TableHead>
                        <TableHead className="text-right w-16">利益率</TableHead>
                        <TableHead className="w-20">状態</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {asins.map((asin) => {
                        const p = previews[asin];
                        const isOk = p?.status === 'ok';
                        return (
                          <TableRow key={asin} className={isOk ? '' : 'opacity-60'}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selected.has(asin)}
                                onChange={() => toggleSelect(asin)}
                                disabled={!isOk || phase === 'previewing'}
                                className="h-3.5 w-3.5"
                              />
                            </TableCell>
                            <TableCell>
                              <code className="text-xs text-primary font-semibold">
                                {asin}
                              </code>
                            </TableCell>
                            <TableCell>
                              <PreviewBody state={p} />
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {isOk
                                ? `¥${p.data.steps.spApi.priceJpy?.toLocaleString() ?? '—'}`
                                : '—'}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {isOk
                                ? `₩${p.data.steps.pricing.krwFinal.toLocaleString()}`
                                : '—'}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {isOk
                                ? `${p.data.steps.pricing.marginRate}%`
                                : '—'}
                            </TableCell>
                            <TableCell>
                              <PreviewBadge state={p} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {(phase === 'running' || phase === 'done') && (
                <div className="space-y-1 border rounded-md max-h-[50vh] overflow-y-auto">
                  {asins
                    .filter((a) => submitStates[a])
                    .map((a) => {
                      const s = submitStates[a];
                      const p = previews[a];
                      return (
                        <div
                          key={a}
                          className="flex items-center gap-3 px-3 py-1.5 border-b last:border-0 text-xs"
                        >
                          <code className="text-primary font-semibold w-24">{a}</code>
                          <div className="flex-1 truncate text-muted-foreground">
                            {p?.status === 'ok'
                              ? p.data.steps.translation.title.ko
                              : '—'}
                          </div>
                          <SubmitRowStatus state={s} />
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="border-t px-5 h-14 flex items-center justify-between gap-2 shrink-0">
              <div className="text-xs text-muted-foreground">
                {phase === 'done' && submitCounts.err > 0 && (
                  <span className="text-warning">
                    {submitCounts.err}件失敗。詳細は各行を確認してください。
                  </span>
                )}
                {phase === 'done' && submitCounts.err === 0 && (
                  <span className="text-success">
                    全 {submitCounts.ok} 件 完了
                  </span>
                )}
                {phase === 'review' && (
                  <span>
                    送信対象：<strong>{selectedCount}</strong> / {total}件
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={close}
                  disabled={phase === 'previewing' || phase === 'running'}
                >
                  {phase === 'done' ? '閉じる' : 'キャンセル'}
                </Button>
                {phase === 'review' && (
                  <Button
                    size="sm"
                    onClick={startSubmit}
                    disabled={selectedCount === 0}
                  >
                    <Rocket className="h-3.5 w-3.5" />
                    {selectedCount}件の登録を実行
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

function PreviewBody({ state }: { state: PreviewState | undefined }) {
  if (!state || state.status === 'pending') {
    return <span className="text-muted-foreground text-xs">待機中</span>;
  }
  if (state.status === 'loading') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-info">
        <Loader2 className="h-3 w-3 animate-spin" />
        生成中
      </span>
    );
  }
  if (state.status === 'error') {
    return (
      <span className="inline-flex items-start gap-1 text-xs text-destructive">
        <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
        <span>{state.message}</span>
      </span>
    );
  }
  const d = state.data;
  return (
    <div className="space-y-0.5">
      <div className="text-xs font-medium truncate max-w-[420px]" title={d.steps.translation.title.ko}>
        {d.steps.translation.title.ko}
      </div>
      <div className="text-[10px] text-muted-foreground truncate max-w-[420px]" title={d.steps.spApi.title}>
        {d.steps.spApi.title}
      </div>
      <div className="text-[10px] text-muted-foreground">
        <span className="inline-block bg-muted px-1.5 py-0.5 rounded">
          [{d.steps.category.displayCategoryCode}] {d.steps.category.displayCategoryName}
        </span>
        <span className="ml-2">
          信頼度 {(d.steps.category.confidence * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function PreviewBadge({ state }: { state: PreviewState | undefined }) {
  if (!state || state.status === 'pending') {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (state.status === 'loading') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-info">
        <Loader2 className="h-3 w-3 animate-spin" />
      </span>
    );
  }
  if (state.status === 'error') {
    return <Badge variant="destructive">エラー</Badge>;
  }
  return <Badge variant="success">準備OK</Badge>;
}

function SubmitRowStatus({ state }: { state: SubmitState | undefined }) {
  if (!state) return <span className="text-muted-foreground">—</span>;
  switch (state.status) {
    case 'pending':
      return <span className="text-muted-foreground">待機中</span>;
    case 'running':
      return (
        <span className="inline-flex items-center gap-1 text-info">
          <Loader2 className="h-3 w-3 animate-spin" />
          送信中
        </span>
      );
    case 'ok':
      return (
        <span className="inline-flex items-center gap-1 text-success">
          <CheckCircle2 className="h-3 w-3" />
          {state.mode === 'live' ? '本送信完了' : 'ドライラン完了'}
        </span>
      );
    case 'error':
      return (
        <span className="inline-flex items-start gap-1 text-destructive">
          <AlertCircle className="h-3 w-3 mt-0.5" />
          <span>{state.message}</span>
        </span>
      );
  }
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border p-2">
      {icon}
      <div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold tabular-nums">{value}</div>
      </div>
    </div>
  );
}
