'use client';

import * as React from 'react';
import Link from 'next/link';
import { KeyRound, Copy, Check, RefreshCw, Loader2, ArrowLeft, Send, FolderOpen, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

type Batch = {
  id: string;
  query: string | null;
  source: string;
  capturedAt: string | null;
  createdAt: string;
  total: number;
  drafts: number;
  advanced: number;
};
type Item = {
  id: string;
  status: string;
  titleJa: string | null;
  titleTranslated: string | null;
  sourceProductId: string;
  sourcePriceJpy: number | null;
  image: string | null;
};

const yen = (n: number | null) => (n == null ? '—' : `¥${n.toLocaleString('ja-JP')}`);
const dt = (s: string | null) => (s ? new Date(s).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const statusJa: Record<string, string> = { draft: '未処理', pending: '送信待ち', live: '出品中', stopped: '停止', rejected: '却下', error: 'エラー' };

export function InboxClient() {
  const [batches, setBatches] = React.useState<Batch[]>([]);
  const [loadingB, setLoadingB] = React.useState(true);
  const [open, setOpen] = React.useState<Batch | null>(null);
  const [items, setItems] = React.useState<Item[]>([]);
  const [loadingI, setLoadingI] = React.useState(false);
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);

  // token
  const [tokens, setTokens] = React.useState<{ id: string }[]>([]);
  const [newToken, setNewToken] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const loadBatches = React.useCallback(async () => {
    setLoadingB(true);
    const [b, t] = await Promise.all([
      fetch('/api/tenant/batches', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/tenant/token', { cache: 'no-store' }).then((r) => r.json()),
    ]);
    setBatches(b.items ?? []);
    setTokens(t.tokens ?? []);
    setLoadingB(false);
  }, []);
  React.useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const openBatch = async (b: Batch) => {
    setOpen(b);
    setSel(new Set());
    setDone(null);
    setLoadingI(true);
    const j = await fetch('/api/tenant/batches/' + b.id, { cache: 'no-store' }).then((r) => r.json());
    setItems(j.items ?? []);
    setLoadingI(false);
  };
  const reloadItems = async () => {
    if (!open) return;
    const j = await fetch('/api/tenant/batches/' + open.id, { cache: 'no-store' }).then((r) => r.json());
    setItems(j.items ?? []);
  };

  const genToken = async () => {
    const r = await fetch('/api/tenant/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const j = await r.json();
    if (r.ok) { setNewToken(j.token); loadBatches(); }
  };
  const copy = async (text: string) => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const draftItems = items.filter((i) => i.status === 'draft');
  const allSel = draftItems.length > 0 && draftItems.every((i) => sel.has(i.id));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSel(allSel ? new Set() : new Set(draftItems.map((i) => i.id)));

  const registerSelected = async () => {
    const ids = [...sel];
    if (ids.length === 0) return;
    setBusy(true);
    setDone(null);
    const r = await fetch('/api/listings/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, action: 'process' }) });
    const j = await r.json();
    const ok = (j.results ?? []).filter((x: { ok: boolean }) => x.ok).length;
    setBusy(false);
    setSel(new Set());
    setDone(`${ok}件を翻訳・価格計算しました（送信待ち）。まだCoupangには送信していません ―送信は「出品管理」/「一括出品」で。`);
    reloadItems();
    loadBatches();
  };

  // ── トークンカード（共通） ──
  const tokenCard = (
    <Card>
      <CardHeader className="text-sm font-medium">Chrome拡張の接続トークン</CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          拡張からこの店舗に取り込むためのトークンです。拡張の設定に貼り付けてください（送信先 <code>{origin}/api/ingest</code>）。発行済み {tokens.length} 件。
        </p>
        {newToken ? (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="text-xs font-medium">発行しました（この画面でしか表示されません）：</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-background px-2 py-1.5 text-xs">{newToken}</code>
              <Button size="sm" variant="outline" onClick={() => copy(newToken)}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'コピー済' : 'コピー'}
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" onClick={genToken}><KeyRound className="h-4 w-4" />トークンを発行</Button>
        )}
      </CardContent>
    </Card>
  );

  // ── グループ詳細（選別） ──
  if (open) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <button onClick={() => setOpen(null)} className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" />取得グループ一覧へ</button>
        <div>
          <h1 className="text-xl font-semibold">{open.query ? `検索「${open.query}」` : '（商品ページ取得）'}</h1>
          <p className="text-sm text-muted-foreground mt-1">{dt(open.capturedAt || open.createdAt)} 取得 ・ {open.total}件 ・ 出品したい商品を選んで「出品準備」（翻訳・価格計算）。実際のCoupang送信は出品管理で。</p>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={allSel} onChange={toggleAll} />未処理を全選択</label>
          <Button size="sm" className="ml-auto" disabled={busy || sel.size === 0} onClick={registerSelected}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}選択を出品準備（{sel.size}）
          </Button>
        </div>
        {done && (
          <div className="rounded-md bg-success/10 text-success-foreground border border-success/30 text-sm p-3 flex items-center gap-2">
            <Check className="h-4 w-4 text-success" />{done}<Link href="/listings" className="ml-auto text-primary underline">出品管理へ</Link>
          </div>
        )}

        {loadingI ? (
          <p className="text-sm text-muted-foreground">読み込み中…</p>
        ) : items.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">このグループに商品がありません。</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {items.map((it) => {
              const isDraft = it.status === 'draft';
              return (
                <Card key={it.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    {isDraft ? (
                      <Checkbox checked={sel.has(it.id)} onChange={() => toggle(it.id)} />
                    ) : (
                      <div className="w-4" />
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.image || `https://picsum.photos/seed/${it.sourceProductId}/80/80`} alt="" className="h-12 w-12 rounded border object-cover bg-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{it.titleTranslated || it.titleJa || '(タイトル未取得)'}</div>
                      <div className="text-xs text-muted-foreground"><code>{it.sourceProductId}</code> ・ 仕入 {yen(it.sourcePriceJpy)}</div>
                    </div>
                    <Badge variant={isDraft ? 'muted' : it.status === 'live' ? 'success' : it.status === 'rejected' || it.status === 'error' ? 'destructive' : 'info'}>{statusJa[it.status] ?? it.status}</Badge>
                    {!isDraft && <Link href={`/listings/${it.id}`} className="text-xs text-primary underline shrink-0">詳細</Link>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── グループ一覧 ──
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold">ASIN受信トレイ</h1>
        <p className="text-sm text-muted-foreground mt-1">Chrome拡張で取り込んだASINが「取得グループ」ごとに並びます。グループを開いて、出品したい商品を選んでCoupang出品へ進めます。<b>自店舗専用</b>です。</p>
      </div>

      {tokenCard}

      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">取得グループ{batches.length > 0 && <Badge variant="muted" className="ml-1">{batches.length}</Badge>}</h2>
        <Button variant="outline" size="sm" className="ml-auto" onClick={loadBatches}><RefreshCw className="h-3.5 w-3.5" />更新</Button>
      </div>

      {loadingB ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : batches.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">まだ取得グループがありません。Chrome拡張でAmazonからASINを送ると、ここに取得グループが作られます。</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {batches.map((b) => (
            <button key={b.id} onClick={() => openBatch(b)} className="w-full text-left">
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="grid place-items-center h-9 w-9 rounded-md bg-primary/10 text-primary shrink-0"><FolderOpen className="h-4 w-4" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{b.query || '（商品ページ取得）'}</div>
                    <div className="text-xs text-muted-foreground">{dt(b.capturedAt || b.createdAt)} ・ {b.total}件</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {b.drafts > 0 && <Badge variant="muted">未処理 {b.drafts}</Badge>}
                    {b.advanced > 0 && <Badge variant="info">出品へ {b.advanced}</Badge>}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
