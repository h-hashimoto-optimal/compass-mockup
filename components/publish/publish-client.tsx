'use client';

import * as React from 'react';
import Link from 'next/link';
import { Cog, Send, Loader2, RefreshCw, CheckCircle2, XCircle, Ban } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatKRW } from '@/lib/utils';

type Listing = {
  id: string;
  status: string;
  titleJa: string | null;
  titleTranslated: string | null;
  listPrice: number | null;
  listCurrency: string;
  source: string;
  sourceProductId: string;
};

const statusMap: Record<string, { label: string; variant: 'muted' | 'info' | 'success' | 'warning' | 'destructive' }> = {
  draft: { label: '下書き', variant: 'muted' },
  pending: { label: '送信待ち', variant: 'info' },
  live: { label: '出品中', variant: 'success' },
  stopped: { label: '停止', variant: 'warning' },
  rejected: { label: '却下', variant: 'destructive' },
  deleted: { label: '削除', variant: 'muted' },
  error: { label: 'エラー', variant: 'destructive' },
};

type Result = { ok: boolean; mode?: string; error?: string };

export function PublishClient() {
  const [items, setItems] = React.useState<Listing[]>([]);
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [results, setResults] = React.useState<Record<string, Result>>({});
  const [lastAction, setLastAction] = React.useState<'process' | 'submit' | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  const load = React.useCallback(() => {
    fetch('/api/listings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setItems(j.listings ?? []))
      .finally(() => setLoaded(true));
  }, []);
  React.useEffect(load, [load]);

  // 出品作業対象（出品中・削除以外）。送信待ち→送信、下書き→処理してから送信。
  const actionable = items.filter((l) => l.status !== 'live' && l.status !== 'deleted');
  const counts = {
    total: items.length,
    pending: items.filter((l) => l.status === 'pending').length,
    draft: items.filter((l) => l.status === 'draft').length,
    live: items.filter((l) => l.status === 'live').length,
    ng: items.filter((l) => l.status === 'rejected' || l.status === 'error').length,
  };

  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const allSelected = actionable.length > 0 && actionable.every((l) => sel.has(l.id));
  const toggleAll = () =>
    setSel(allSelected ? new Set() : new Set(actionable.map((l) => l.id)));
  const selectByStatus = (status: string) =>
    setSel(new Set(items.filter((l) => l.status === status).map((l) => l.id)));

  const run = async (action: 'process' | 'submit') => {
    const ids = [...sel];
    if (ids.length === 0) return;
    setBusy(action);
    setLastAction(action);
    setResults({});
    const r = await fetch('/api/listings/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, action }),
    });
    const j = await r.json();
    const map: Record<string, Result> = {};
    for (const x of j.results ?? []) map[x.id] = { ok: x.ok, mode: x.mode, error: x.error };
    setResults(map);
    setBusy(null);
    load();
  };

  const okCount = Object.values(results).filter((r) => r.ok).length;
  const ngCount = Object.values(results).filter((r) => !r.ok).length;
  const doneTotal = okCount + ngCount;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">Coupang 一括出品</h1>
          <p className="text-sm text-muted-foreground mt-1">自店舗の出品をまとめて処理・送信します。下書きは「処理」→「送信」の順です。</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={!!busy}><RefreshCw className="h-4 w-4" />更新</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="合計" value={counts.total} />
        <Stat label="下書き" value={counts.draft} onClick={() => selectByStatus('draft')} />
        <Stat label="送信待ち" value={counts.pending} onClick={() => selectByStatus('pending')} />
        <Stat label="出品中" value={counts.live} tone="ok" />
        <Stat label="却下/エラー" value={counts.ng} tone={counts.ng > 0 ? 'bad' : undefined} onClick={() => selectByStatus('rejected')} />
      </div>

      {doneTotal > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">実行結果 {doneTotal} 件</span>
              <span className="text-muted-foreground">成功 {okCount} ／ 失敗・除外 {ngCount}</span>
            </div>
            <Progress value={(okCount / doneTotal) * 100} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">出品対象（{actionable.length}）</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => run('process')} disabled={!!busy || sel.size === 0}>
              {busy === 'process' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cog className="h-4 w-4" />}選択を処理（{sel.size}）
            </Button>
            <Button size="sm" onClick={() => run('submit')} disabled={!!busy || sel.size === 0}>
              {busy === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}選択を送信（{sel.size}）
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><Checkbox checked={allSelected} onChange={toggleAll} /></TableHead>
                <TableHead>商品</TableHead>
                <TableHead className="text-right">販売価格</TableHead>
                <TableHead className="w-24">状態</TableHead>
                <TableHead className="w-28">結果</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loaded ? (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">読み込み中…</TableCell></TableRow>
              ) : actionable.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">出品対象がありません。<Link href="/products" className="text-primary hover:underline">受信トレイ</Link>からASINを取り込んでください。</TableCell></TableRow>
              ) : (
                actionable.map((l) => {
                  const st = statusMap[l.status] ?? { label: l.status, variant: 'muted' as const };
                  const res = results[l.id];
                  return (
                    <TableRow key={l.id}>
                      <TableCell><Checkbox checked={sel.has(l.id)} onChange={() => toggle(l.id)} /></TableCell>
                      <TableCell className="max-w-[320px]">
                        <Link href={`/listings/${l.id}`} className="font-medium truncate block hover:underline">{l.titleTranslated || l.titleJa || '（無題）'}</Link>
                        <div className="text-[11px] text-muted-foreground font-mono">{l.source}:{l.sourceProductId}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{l.listPrice != null ? formatKRW(l.listPrice) : '—'}</TableCell>
                      <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                      <TableCell>
                        {res ? (
                          res.ok ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="h-3.5 w-3.5" />{lastAction === 'process' ? '処理済' : res.mode === 'dry-run' ? 'ドライラン' : '送信'}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-destructive" title={res.error}>
                              {res.mode === 'blocked' ? <><Ban className="h-3.5 w-3.5" />送信不可</> : <><XCircle className="h-3.5 w-3.5" />失敗</>}
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone, onClick }: { label: string; value: number; tone?: 'ok' | 'bad'; onClick?: () => void }) {
  const cls = tone === 'bad' ? 'border-destructive/40 bg-destructive/5' : '';
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className={`text-left rounded-md border p-3 ${cls} ${onClick ? 'hover:border-primary cursor-pointer' : 'cursor-default'}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </button>
  );
}
