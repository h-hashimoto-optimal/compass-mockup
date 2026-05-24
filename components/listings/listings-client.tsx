'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus, RefreshCw, Eye, Send, Trash2, Loader2, X, Cog, RotateCw } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { listingStatusView, listingActions } from '@/lib/listing-status';

type Listing = {
  id: string;
  channel: string;
  status: string;
  coupangApprovalStatus: string | null;
  coupangSalesStatus: string | null;
  titleJa: string | null;
  titleTranslated: string | null;
  listPrice: number | null;
  listCurrency: string;
  floorPriceJpy: number | null;
  source: string;
  sourceProductId: string;
  sourcePriceJpy: number | null;
  sourceInStock: boolean | null;
  batchQuery: string | null;
  batchCapturedAt: string | null;
  image: string | null;
};

type PreviewData = {
  preview: { images: string[]; titleTranslated: string | null; titleJa: string | null; brand?: string; ipBrand?: { brand: string; level: string } | null; category: string; listPrice: number | null; listCurrency: string; floorPriceJpy: number | null; sourcePriceJpy: number | null; inStock: boolean | null };
  validation: { ready: boolean; warnings: { level: 'block' | 'info'; msg: string }[] };
};

const yen = (n: number | null) => (n == null ? '—' : `¥${n.toLocaleString('ja-JP')}`);
const krw = (n: number | null, c = 'KRW') => (n == null ? '—' : `${n.toLocaleString('ja-JP')} ${c}`);

// ステータス→フィルタ群
type Group = 'draft' | 'ready' | 'review' | 'selling' | 'attention' | 'other';
function groupOf(l: Listing): Group {
  if (l.status === 'draft') return 'draft';
  if (l.status === 'ready') return 'ready';
  if (l.status === 'error') return 'attention';
  if (l.status === 'submitted') {
    const ap = l.coupangApprovalStatus;
    if (ap === 'rejected' || ap === 'deleted') return 'attention';
    if (ap === 'requested' || ap == null) return 'review';
    // approved / partial_approved
    if (l.coupangSalesStatus === 'suspended' || l.coupangSalesStatus === 'soldout') return 'attention';
    return 'selling';
  }
  return 'other';
}
const FILTERS: { key: 'all' | Group; label: string }[] = [
  { key: 'all', label: 'すべて' },
  { key: 'draft', label: '未処理' },
  { key: 'ready', label: '送信待ち' },
  { key: 'review', label: '審査中' },
  { key: 'selling', label: '販売中' },
  { key: 'attention', label: '要対応' },
];

export function ListingsClient() {
  const [items, setItems] = React.useState<Listing[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<'all' | Group>('all');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [preview, setPreview] = React.useState<{ id: string; data: PreviewData } | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  const [asin, setAsin] = React.useState('');
  const [titleJa, setTitleJa] = React.useState('');
  const [priceJpy, setPriceJpy] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/listings', { cache: 'no-store' });
    const j = await r.json();
    setItems(j.listings ?? []);
    setSelected(new Set());
    setLoading(false);
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);

  // busyキーは `${id}:${action}`（アクション別にスピナーを出すため）
  const setB = (key: string, on: boolean) =>
    setBusy((s) => {
      const n = new Set(s);
      on ? n.add(key) : n.delete(key);
      return n;
    });
  const rowBusy = (id: string) => {
    for (const k of busy) if (k.startsWith(id + ':')) return true;
    return false;
  };

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: items.length, draft: 0, ready: 0, review: 0, selling: 0, attention: 0, other: 0 };
    for (const l of items) c[groupOf(l)]++;
    return c;
  }, [items]);

  const filtered = filter === 'all' ? items : items.filter((l) => groupOf(l) === filter);

  const addAsin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asin.trim()) return;
    setMsg(null);
    const r = await fetch('/api/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'amazon', channel: 'coupang', sourceProductId: asin.trim(), titleJa: titleJa || undefined, priceJpy: priceJpy || undefined }),
    });
    const j = await r.json();
    if (!r.ok) return setMsg(j.error ?? '追加に失敗');
    setAsin(''); setTitleJa(''); setPriceJpy('');
    setMsg(j.status === 'exists' ? '既に登録済みのASINです' : 'ASINを追加しました');
    load();
  };

  const PATHS = { process: '/process', preview: '/dry-run', submit: '/submit', reconcile: '/reconcile' } as const;
  const act = async (id: string, action: keyof typeof PATHS) => {
    const key = `${id}:${action}`;
    setB(key, true);
    try {
      const r = await fetch(`/api/listings/${id}${PATHS[action]}`, { method: 'POST' });
      return { ok: r.ok, json: await r.json().catch(() => ({})) };
    } finally {
      setB(key, false);
    }
  };
  const doProcess = async (id: string) => { const r = await act(id, 'process'); setMsg(r.ok ? '出品準備しました（取得・翻訳・価格）' : (r.json as { error?: string }).error === 'NOT_PROCESSABLE' ? '審査中／販売中は再処理できません' : '処理に失敗'); load(); };
  const doPreview = async (id: string) => { const r = await act(id, 'preview'); if (r.ok) setPreview({ id, data: r.json as PreviewData }); else setMsg((r.json as { error?: string }).error ?? 'プレビュー失敗'); };
  const doSubmit = async (id: string) => {
    const r = await act(id, 'submit');
    const j = r.json as { mode?: string; warnings?: string[]; reason?: string };
    if (j.mode === 'blocked') setMsg('送信不可：' + (j.warnings ?? []).join(' / '));
    else if (j.mode === 'already_submitted') setMsg('既に送信済み（審査中／販売中）です');
    else if (j.mode === 'mock') setMsg('擬似送信しました（審査中）');
    else if (j.mode === 'dry-run') setMsg('dry-run（' + (j.reason ?? '認証情報未設定') + '）');
    else setMsg('Coupangへ送信しました');
    load();
  };
  const doSync = async (id: string) => { const r = await act(id, 'reconcile'); setMsg(r.ok ? '状態同期しました' : '同期：対象外（送信済みのみ）'); load(); };
  const doDelete = async (id: string) => { if (!confirm('この出品を削除しますか？')) return; setB(`${id}:delete`, true); await fetch(`/api/listings/${id}`, { method: 'DELETE' }); setB(`${id}:delete`, false); load(); };

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSel = filtered.length > 0 && filtered.every((l) => selected.has(l.id));
  const toggleAll = () => setSelected(allSel ? new Set() : new Set(filtered.map((l) => l.id)));

  const bulk = async (action: 'process' | 'submit' | 'reconcile' | 'delete') => {
    const ids = [...selected];
    if (!ids.length) return;
    if (action === 'delete' && !confirm(`${ids.length}件を削除しますか？`)) return;
    setBulkBusy(true);
    const label = { process: '処理', submit: '送信', reconcile: '状態同期', delete: '削除' }[action];
    setMsg(`一括${label}中…（${ids.length}件）`);
    if (action === 'delete') {
      await Promise.all(ids.map((id) => fetch(`/api/listings/${id}`, { method: 'DELETE' })));
      setMsg(`一括削除：${ids.length}件`);
    } else if (action === 'reconcile') {
      const r = await fetch('/api/tenant/reconcile', { method: 'POST' });
      const j = await r.json();
      setMsg(`状態同期：${j.updated ?? 0}/${j.scanned ?? 0}件を更新`);
    } else {
      const r = await fetch('/api/listings/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, action }) });
      const j = await r.json();
      const ok = (j.results ?? []).filter((x: { ok: boolean }) => x.ok).length;
      setMsg(`一括${label}：${ok}/${ids.length} 成功`);
    }
    setBulkBusy(false);
    load();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">商品管理（Amazon → Coupang）</h1>
          <p className="text-sm text-muted-foreground mt-1">ステータスで絞り込んで、まとめて処理・送信・状態同期できます。</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5" />更新</Button>
          <Button variant="outline" size="sm" onClick={() => bulk('reconcile')} title="送信済みのCoupang承認/販売を取り込む"><RotateCw className="h-3.5 w-3.5" />状態同期</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="text-sm font-medium">＋ ASINを手動追加（通常はChrome拡張→受信トレイ）</CardHeader>
        <CardContent>
          <form onSubmit={addAsin} className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[180px]"><label className="text-xs text-muted-foreground">ASIN</label><Input className="mt-1" value={asin} onChange={(e) => setAsin(e.target.value)} placeholder="B0XXXXXXXX" required /></div>
            <div className="flex-1 min-w-[160px]"><label className="text-xs text-muted-foreground">タイトル（任意）</label><Input className="mt-1" value={titleJa} onChange={(e) => setTitleJa(e.target.value)} /></div>
            <div className="w-28"><label className="text-xs text-muted-foreground">仕入(円・任意)</label><Input className="mt-1" value={priceJpy} onChange={(e) => setPriceJpy(e.target.value)} placeholder="例 1980" /></div>
            <Button type="submit"><Plus className="h-4 w-4" />追加</Button>
          </form>
        </CardContent>
      </Card>

      {/* ステータスフィルタ */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setSelected(new Set()); }}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filter === f.key ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
          >
            {f.label} {counts[f.key] ?? 0}
          </button>
        ))}
      </div>

      {/* 一括バー */}
      <div className="flex items-center gap-2 flex-wrap min-h-8">
        {filtered.length > 0 && (
          <label className="flex items-center gap-1.5 text-sm"><Checkbox checked={allSel} onChange={toggleAll} />全選択</label>
        )}
        {selected.size > 0 && (
          <>
            <span className="text-sm text-muted-foreground">{selected.size}件</span>
            <Button size="sm" disabled={bulkBusy} onClick={() => bulk('process')} title="Amazon取得→翻訳→価格計算"><Cog className="h-3.5 w-3.5" />出品準備</Button>
            <Button size="sm" disabled={bulkBusy} onClick={() => bulk('submit')}><Send className="h-3.5 w-3.5" />送信</Button>
            <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulk('reconcile')}><RotateCw className="h-3.5 w-3.5" />同期</Button>
            <Button size="sm" variant="ghost" disabled={bulkBusy} onClick={() => bulk('delete')}><Trash2 className="h-3.5 w-3.5" />削除</Button>
          </>
        )}
        {msg && <span className="ml-auto text-xs text-primary">{msg}</span>}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{filter === 'all' ? '商品がありません。受信トレイから取り込むか、上のフォームでASINを追加してください。' : 'この絞り込みに該当する商品はありません。'}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((l) => {
            const sv = listingStatusView(l);
            const a = listingActions(l);
            return (
              <Card key={l.id}>
                <CardContent className="p-3 flex gap-3 items-start">
                  <Checkbox className="mt-1.5" checked={selected.has(l.id)} onChange={() => toggle(l.id)} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.image || `https://picsum.photos/seed/${l.sourceProductId}/80/80`} alt="" className="h-14 w-14 rounded border object-cover bg-muted shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={sv.tone} title={sv.hint}>{sv.label}</Badge>
                      <code className="text-xs text-muted-foreground">{l.sourceProductId}</code>
                      {l.batchQuery && <Badge variant="muted">検索「{l.batchQuery}」</Badge>}
                      {l.sourceInStock === false && <Badge variant="destructive">在庫なし</Badge>}
                      {l.floorPriceJpy != null && l.sourcePriceJpy != null && l.sourcePriceJpy > l.floorPriceJpy && <Badge variant="destructive">赤字</Badge>}
                    </div>
                    <Link href={`/listings/${l.id}`} className="text-sm font-medium truncate block hover:underline">{l.titleJa || '(未取得)'}</Link>
                    <div className="text-xs truncate">
                      <span className="text-muted-foreground">韓国語：</span>
                      {l.titleTranslated ? l.titleTranslated : <span className="text-amber-600">（未翻訳・出品準備で翻訳）</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>仕入 {yen(l.sourcePriceJpy)}</span>
                      <span>売価 {krw(l.listPrice, l.listCurrency)}</span>
                      <span>下限 {yen(l.floorPriceJpy)}</span>
                      <Link href={`/listings/${l.id}`} className="text-primary hover:underline">編集</Link>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {a.canProcess && <Button size="sm" variant="outline" disabled={rowBusy(l.id)} onClick={() => doProcess(l.id)} title="Amazon情報取得 → 翻訳 → 価格・赤字下限を計算（送信待ちにする）">{busy.has(`${l.id}:process`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cog className="h-3.5 w-3.5" />}出品準備</Button>}
                    <Button size="sm" variant="outline" disabled={rowBusy(l.id)} onClick={() => doPreview(l.id)}>{busy.has(`${l.id}:preview`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}プレビュー</Button>
                    {a.canSubmit && <Button size="sm" disabled={rowBusy(l.id)} onClick={() => doSubmit(l.id)}>{busy.has(`${l.id}:submit`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}送信</Button>}
                    {a.canReconcile && <Button size="sm" variant="outline" disabled={rowBusy(l.id)} onClick={() => doSync(l.id)}>{busy.has(`${l.id}:reconcile`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}同期</Button>}
                    <Button size="sm" variant="ghost" disabled={rowBusy(l.id)} onClick={() => doDelete(l.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setPreview(null)}>
          <Card className="w-full max-w-lg max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between text-sm font-medium">
              出品プレビュー（Coupang dry-run）
              <button onClick={() => setPreview(null)}><X className="h-4 w-4" /></button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 overflow-x-auto">
                {preview.data.preview.images.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt="" className="h-20 w-20 rounded object-cover bg-muted shrink-0" />
                ))}
              </div>
              <div className="text-sm font-medium">{preview.data.preview.titleTranslated || '(未翻訳)'}</div>
              <div className="text-xs text-muted-foreground">{preview.data.preview.titleJa}</div>
              {preview.data.preview.ipBrand && (
                <div className="text-xs text-destructive">⚠️ 知財監視ブランド該当：{preview.data.preview.ipBrand.brand}</div>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>ブランド：{preview.data.preview.brand ?? '—'}</div>
                <div>カテゴリ：{preview.data.preview.category}</div>
                <div>仕入：{yen(preview.data.preview.sourcePriceJpy)}</div>
                <div>売価：{krw(preview.data.preview.listPrice, preview.data.preview.listCurrency)}</div>
                <div>赤字下限：{yen(preview.data.preview.floorPriceJpy)}</div>
                <div>在庫：{preview.data.preview.inStock === false ? '欠品' : 'あり'}</div>
              </div>
              <div className="space-y-1">
                <div className={`text-xs font-bold ${preview.data.validation.ready ? 'text-green-600' : 'text-red-600'}`}>{preview.data.validation.ready ? '✓ 送信可能' : '✕ 必須項目に不足あり'}</div>
                {preview.data.validation.warnings.map((w, i) => (
                  <div key={i} className={`text-xs ${w.level === 'block' ? 'text-red-600' : 'text-amber-600'}`}>{w.level === 'block' ? '⛔' : '⚠️'} {w.msg}</div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Link href={`/listings/${preview.id}`} className="mr-auto text-xs text-primary hover:underline">詳細を開く →</Link>
                <Button variant="outline" size="sm" onClick={() => setPreview(null)}>閉じる</Button>
                <Button size="sm" disabled={!preview.data.validation.ready} onClick={() => { const id = preview.id; setPreview(null); doSubmit(id); }}><Send className="h-3.5 w-3.5" />この内容で送信</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
