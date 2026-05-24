'use client';

import * as React from 'react';
import { Plus, RefreshCw, Eye, Send, Trash2, Loader2, X } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { listingStatusView } from '@/lib/listing-status';

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
};

type PreviewData = {
  preview: { images: string[]; titleTranslated: string | null; titleJa: string | null; category: string; listPrice: number | null; listCurrency: string; floorPriceJpy: number | null; sourcePriceJpy: number | null; inStock: boolean | null };
  validation: { ready: boolean; warnings: { level: 'block' | 'info'; msg: string }[] };
};

const yen = (n: number | null) => (n == null ? '—' : `¥${n.toLocaleString('ja-JP')}`);
const krw = (n: number | null, c = 'KRW') => (n == null ? '—' : `${n.toLocaleString('ja-JP')} ${c}`);


export function ListingsClient() {
  const [items, setItems] = React.useState<Listing[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState<Set<string>>(new Set());
  const [preview, setPreview] = React.useState<{ id: string; data: PreviewData } | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  // ASIN追加フォーム
  const [asin, setAsin] = React.useState('');
  const [titleJa, setTitleJa] = React.useState('');
  const [priceJpy, setPriceJpy] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/listings', { cache: 'no-store' });
    const j = await r.json();
    setItems(j.listings ?? []);
    setLoading(false);
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);

  const mark = (id: string, on: boolean) =>
    setBusy((s) => {
      const n = new Set(s);
      on ? n.add(id) : n.delete(id);
      return n;
    });

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
    setAsin('');
    setTitleJa('');
    setPriceJpy('');
    setMsg(j.status === 'exists' ? '既に登録済みのASINです' : 'ASINを追加しました');
    load();
  };

  const act = async (id: string, path: string) => {
    mark(id, true);
    try {
      const r = await fetch(`/api/listings/${id}${path}`, { method: 'POST' });
      return { ok: r.ok, json: await r.json().catch(() => ({})) };
    } finally {
      mark(id, false);
    }
  };

  const doProcess = async (id: string) => {
    const r = await act(id, '/process');
    setMsg(r.ok ? '処理しました（翻訳・価格・赤字下限を更新）' : 'r' in r ? '処理に失敗' : '処理に失敗');
    load();
  };

  const doPreview = async (id: string) => {
    const r = await act(id, '/dry-run');
    if (r.ok) setPreview({ id, data: r.json as PreviewData });
    else setMsg((r.json as { error?: string }).error ?? 'プレビュー失敗');
  };

  const doSubmit = async (id: string) => {
    const r = await act(id, '/submit');
    const j = r.json as { mode?: string; warnings?: string[]; reason?: string };
    if (j.mode === 'blocked') setMsg('送信不可：' + (j.warnings ?? []).join(' / '));
    else if (j.mode === 'dry-run') setMsg('dry-run（' + (j.reason ?? '認証情報未設定') + '）');
    else setMsg('Coupangへ送信しました');
    load();
  };

  const doDelete = async (id: string) => {
    if (!confirm('この出品を削除しますか？')) return;
    mark(id, true);
    await fetch(`/api/listings/${id}`, { method: 'DELETE' });
    mark(id, false);
    load();
  };

  const saveField = async (id: string, field: 'titleTranslated' | 'listPrice', value: string) => {
    await fetch(`/api/listings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const bulk = async (action: 'process' | 'submit') => {
    const ids = [...selected];
    if (!ids.length) return;
    setMsg(`一括${action === 'process' ? '処理' : '送信'}中…（${ids.length}件）`);
    const r = await fetch('/api/listings/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, action }),
    });
    const j = await r.json();
    const ok = (j.results ?? []).filter((x: { ok: boolean }) => x.ok).length;
    setMsg(`一括${action === 'process' ? '処理' : '送信'}完了：${ok}/${ids.length} 成功`);
    setSelected(new Set());
    load();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold">出品管理（Amazon → Coupang）</h1>
        <p className="text-sm text-muted-foreground mt-1">ASINを追加 → 処理（詳細取得・翻訳・価格）→ プレビュー → Coupang送信。単一・一括どちらも可。</p>
      </div>

      <Card>
        <CardHeader className="text-sm font-medium">＋ ASINを追加</CardHeader>
        <CardContent>
          <form onSubmit={addAsin} className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs text-muted-foreground">ASIN</label>
              <Input className="mt-1" value={asin} onChange={(e) => setAsin(e.target.value)} placeholder="B0XXXXXXXX" required />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs text-muted-foreground">タイトル（任意）</label>
              <Input className="mt-1" value={titleJa} onChange={(e) => setTitleJa(e.target.value)} placeholder="（拡張取込時は自動）" />
            </div>
            <div className="w-28">
              <label className="text-xs text-muted-foreground">仕入(円・任意)</label>
              <Input className="mt-1" value={priceJpy} onChange={(e) => setPriceJpy(e.target.value)} placeholder="例 1980" />
            </div>
            <Button type="submit">
              <Plus className="h-4 w-4" />
              追加
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5" />
          更新
        </Button>
        {selected.size > 0 && (
          <>
            <span className="text-sm text-muted-foreground">{selected.size}件選択</span>
            <Button size="sm" onClick={() => bulk('process')}>一括処理</Button>
            <Button size="sm" variant="outline" onClick={() => bulk('submit')}>
              <Send className="h-3.5 w-3.5" />
              一括送信
            </Button>
          </>
        )}
        {msg && <span className="ml-auto text-xs text-primary">{msg}</span>}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">出品がありません。上のフォームでASINを追加してください。</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((l) => (
            <Card key={l.id}>
              <CardContent className="p-3 flex gap-3 items-start">
                <input type="checkbox" className="mt-1.5" checked={selected.has(l.id)} onChange={() => toggle(l.id)} />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {(() => { const sv = listingStatusView(l); return <Badge variant={sv.tone} title={sv.hint}>{sv.label}</Badge>; })()}
                    <code className="text-xs text-muted-foreground">{l.sourceProductId}</code>
                    {l.batchQuery && <Badge variant="muted">検索「{l.batchQuery}」</Badge>}
                    {l.sourceInStock === false && <Badge variant="destructive">在庫なし</Badge>}
                    {l.floorPriceJpy != null && l.sourcePriceJpy != null && l.sourcePriceJpy > l.floorPriceJpy && <Badge variant="destructive">赤字</Badge>}
                  </div>
                  <div className="text-sm font-medium truncate">{l.titleJa ?? '(未取得)'}</div>
                  <Input
                    className="h-7 text-xs"
                    defaultValue={l.titleTranslated ?? ''}
                    placeholder="韓国語タイトル（処理で自動／手動編集可）"
                    onBlur={(e) => e.target.value !== (l.titleTranslated ?? '') && saveField(l.id, 'titleTranslated', e.target.value)}
                  />
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>仕入 {yen(l.sourcePriceJpy)}</span>
                    <span className="flex items-center gap-1">売価
                      <Input
                        className="h-6 w-24 text-xs"
                        defaultValue={l.listPrice ?? ''}
                        onBlur={(e) => Number(e.target.value.replace(/[^0-9]/g, '')) !== (l.listPrice ?? 0) && saveField(l.id, 'listPrice', e.target.value)}
                      />
                      {l.listCurrency}
                    </span>
                    <span>下限 {yen(l.floorPriceJpy)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="sm" variant="outline" disabled={busy.has(l.id)} onClick={() => doProcess(l.id)}>
                    {busy.has(l.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    処理
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy.has(l.id)} onClick={() => doPreview(l.id)}>
                    <Eye className="h-3.5 w-3.5" />
                    プレビュー
                  </Button>
                  <Button size="sm" disabled={busy.has(l.id)} onClick={() => doSubmit(l.id)}>
                    <Send className="h-3.5 w-3.5" />
                    送信
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => doDelete(l.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
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
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>カテゴリ：{preview.data.preview.category}</div>
                <div>仕入：{yen(preview.data.preview.sourcePriceJpy)}</div>
                <div>売価：{krw(preview.data.preview.listPrice, preview.data.preview.listCurrency)}</div>
                <div>赤字下限：{yen(preview.data.preview.floorPriceJpy)}</div>
              </div>
              <div className="space-y-1">
                <div className={`text-xs font-bold ${preview.data.validation.ready ? 'text-green-600' : 'text-red-600'}`}>
                  {preview.data.validation.ready ? '✓ 送信可能' : '✕ 必須項目に不足あり'}
                </div>
                {preview.data.validation.warnings.map((w, i) => (
                  <div key={i} className={`text-xs ${w.level === 'block' ? 'text-red-600' : 'text-amber-600'}`}>
                    {w.level === 'block' ? '⛔' : '⚠️'} {w.msg}
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setPreview(null)}>閉じる</Button>
                <Button size="sm" disabled={!preview.data.validation.ready} onClick={() => { const id = preview.id; setPreview(null); doSubmit(id); }}>
                  <Send className="h-3.5 w-3.5" />
                  この内容で送信
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
