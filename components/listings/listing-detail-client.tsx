'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Trash2, Cog, Eye, Send, Loader2, AlertTriangle, Info, ShieldAlert, RotateCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatJPY, formatKRW, formatDateTime } from '@/lib/utils';
import { listingStatusView, listingActions } from '@/lib/listing-status';

type Detail = {
  id: string; channel: string; status: string;
  coupangApprovalStatus: string | null; coupangSalesStatus: string | null;
  titleJa: string | null; titleTranslated: string | null;
  listPrice: number | null; listCurrency: string; floorPriceJpy: number | null;
  rejectedReason: string | null;
  source: string; sourceProductId: string; sourceUrl: string | null;
  sourcePriceJpy: number | null; sourceInStock: boolean | null;
  sourceCheckedAt: string | null;
  batchQuery: string | null; batchCapturedAt: string | null;
  marginOverride: string | null; weightGOverride: number | null; coupangCategoryCode: number | null; coupangCategoryName: string | null;
  sourceRaw?: unknown;
};
type Preview = {
  preview: { brand: string; ipBrand: { brand: string; level: string } | null; category: string; images: string[] };
  validation: { ready: boolean; warnings: { level: 'block' | 'info'; msg: string }[] };
  payload: unknown;
};

export function ListingDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [d, setD] = React.useState<Detail | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [titleJa, setTitleJa] = React.useState('');
  const [titleKo, setTitleKo] = React.useState('');
  const [listPrice, setListPrice] = React.useState('');
  const [floor, setFloor] = React.useState('');
  const [marginPct, setMarginPct] = React.useState('');
  const [weightG, setWeightG] = React.useState('');
  const [catCode, setCatCode] = React.useState('');
  const [catName, setCatName] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [preview, setPreview] = React.useState<Preview | null>(null);

  const load = React.useCallback(() => {
    fetch('/api/listings/' + id, { cache: 'no-store' }).then(async (r) => {
      if (r.status === 404) { setNotFound(true); return; }
      const j = await r.json();
      const x: Detail = j.listing;
      setD(x);
      setTitleJa(x.titleJa ?? '');
      setTitleKo(x.titleTranslated ?? '');
      setListPrice(x.listPrice != null ? String(x.listPrice) : '');
      setFloor(x.floorPriceJpy != null ? String(x.floorPriceJpy) : '');
      setMarginPct(x.marginOverride != null ? String(Math.round(Number(x.marginOverride) * 1000) / 10) : '');
      setWeightG(x.weightGOverride != null ? String(x.weightGOverride) : '');
      setCatCode(x.coupangCategoryCode != null ? String(x.coupangCategoryCode) : '');
      setCatName(x.coupangCategoryName ?? '');
    });
  }, [id]);
  React.useEffect(load, [load]);

  const save = async () => {
    setBusy('save'); setSaved(false);
    await fetch('/api/listings/' + id, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titleJa, titleTranslated: titleKo, listPrice, floorPriceJpy: floor,
        marginOverride: marginPct.trim() === '' ? null : (Number(marginPct) || 0) / 100,
        weightGOverride: weightG.trim() === '' ? null : weightG,
        coupangCategoryCode: catCode.trim() === '' ? null : catCode,
        coupangCategoryName: catName.trim() === '' ? null : catName,
      }),
    });
    setBusy(null); setSaved(true); setTimeout(() => setSaved(false), 2000); load();
  };
  const act = async (kind: 'process' | 'submit' | 'reconcile') => {
    setBusy(kind);
    await fetch('/api/listings/' + id + '/' + kind, { method: 'POST' });
    setBusy(null); load(); if (kind === 'process') setPreview(null);
  };
  const doPreview = async () => {
    setBusy('preview');
    const r = await fetch('/api/listings/' + id + '/dry-run', { method: 'POST' });
    setPreview(r.ok ? await r.json() : null);
    setBusy(null);
  };
  const remove = async () => {
    if (!confirm('この出品を削除します。よろしいですか？')) return;
    setBusy('delete');
    await fetch('/api/listings/' + id, { method: 'DELETE' });
    router.push('/listings');
  };

  if (notFound) return <div className="max-w-2xl mx-auto p-8 text-center text-sm text-muted-foreground">出品が見つかりません（削除済み、または他店舗の出品です）。<div className="mt-3"><Link href="/listings" className="text-primary hover:underline">一覧へ戻る</Link></div></div>;
  if (!d) return <p className="text-sm text-muted-foreground">読み込み中…</p>;

  const st = listingStatusView(d);
  const a = listingActions(d);
  const loss = d.floorPriceJpy != null && d.sourcePriceJpy != null && d.sourcePriceJpy > d.floorPriceJpy;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Link href="/listings" className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" />一覧へ戻る</Link>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold truncate">{d.titleTranslated || d.titleJa || '（無題）'}</h1>
            <Badge variant={st.tone} title={st.hint}>{st.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 font-mono">{d.source}:{d.sourceProductId} → {d.channel}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {a.canProcess && (
            <Button variant="outline" size="sm" onClick={() => act('process')} disabled={!!busy} title="Amazon情報取得 → 翻訳 → 価格・赤字下限を計算">
              {busy === 'process' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cog className="h-4 w-4" />}出品準備
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={doPreview} disabled={!!busy}>
            {busy === 'preview' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}プレビュー
          </Button>
          {a.canSubmit && (
            <Button size="sm" onClick={() => act('submit')} disabled={!!busy}>
              {busy === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}送信
            </Button>
          )}
          {a.canReconcile && (
            <Button variant="outline" size="sm" onClick={() => act('reconcile')} disabled={!!busy}>
              {busy === 'reconcile' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}状態同期
            </Button>
          )}
        </div>
      </div>

      {d.rejectedReason && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 text-destructive text-sm p-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /><div><div className="font-medium">却下理由</div><div>{d.rejectedReason}</div></div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="text-sm font-medium">{a.canProcess ? '編集' : '内容（送信済みのため編集不可）'}</CardHeader>
            <CardContent className="space-y-3">
              {!a.canProcess && (
                <div className="flex items-start gap-2 rounded-md bg-muted/50 text-muted-foreground text-xs p-2">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  送信済み（審査中／販売中）のため編集できません。変更が必要な場合はCoupang側の操作（停止/修正）または却下後に対応します。
                </div>
              )}
              <Field label="商品名（日本語）"><Input value={titleJa} onChange={(e) => setTitleJa(e.target.value)} disabled={!a.canProcess} /></Field>
              <Field label="商品名（韓国語・翻訳後）"><Input value={titleKo} onChange={(e) => setTitleKo(e.target.value)} disabled={!a.canProcess} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={`販売価格（${d.listCurrency}）`}><Input value={listPrice} onChange={(e) => setListPrice(e.target.value)} disabled={!a.canProcess} /></Field>
                <Field label="赤字下限（円）"><Input value={floor} onChange={(e) => setFloor(e.target.value)} disabled={!a.canProcess} /></Field>
              </div>
              <div className="flex items-center gap-3">
                {a.canProcess && <Button onClick={save} disabled={!!busy}><Save className="h-4 w-4" />{busy === 'save' ? '保存中…' : '保存'}</Button>}
                {saved && <span className="text-sm text-green-600">保存しました</span>}
                <Button variant="destructive" size="sm" className="ml-auto" onClick={remove} disabled={!!busy}><Trash2 className="h-4 w-4" />削除</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-sm font-medium">出品調整（この商品だけ）</CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">利益率は空欄＝店舗の既定値。カテゴリは空欄＝自動推定。変更後は「出品準備」で売価/カテゴリに反映されます。</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="利益率上書き（%）"><Input value={marginPct} onChange={(e) => setMarginPct(e.target.value)} placeholder="既定" disabled={!a.canProcess} /></Field>
                <Field label="重量上書き（g）"><Input value={weightG} onChange={(e) => setWeightG(e.target.value)} placeholder={(() => { const w = (d.sourceRaw as { weightG?: number } | null)?.weightG; return w ? `取得 ${w}g` : '取得値'; })()} disabled={!a.canProcess} /></Field>
                <Field label="カテゴリコード"><Input value={catCode} onChange={(e) => setCatCode(e.target.value)} placeholder="自動推定" disabled={!a.canProcess} /></Field>
                <Field label="カテゴリ名"><Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="自動推定" disabled={!a.canProcess} /></Field>
              </div>
              {a.canProcess && (
                <Button onClick={save} disabled={!!busy} size="sm" variant="outline"><Save className="h-4 w-4" />保存</Button>
              )}
            </CardContent>
          </Card>

          {preview && (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm">Coupang プレビュー（dry-run）</CardTitle>
                <Badge variant={preview.validation.ready ? 'success' : 'destructive'}>{preview.validation.ready ? '送信可' : '送信不可'}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {preview.preview.ipBrand && (
                  <div className="flex items-center gap-2 text-sm"><ShieldAlert className="h-4 w-4 text-destructive" />知財監視: <Badge variant={preview.preview.ipBrand.level === 'block' ? 'destructive' : 'warning'}>{preview.preview.ipBrand.brand}</Badge></div>
                )}
                <div className="text-xs text-muted-foreground">ブランド: {preview.preview.brand} ／ カテゴリ: {preview.preview.category || '—'}</div>
                {preview.preview.images.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {preview.preview.images.slice(0, 5).map((u, i) => <img key={i} src={u} alt="" className="h-16 w-16 rounded border object-cover bg-muted" />)}
                  </div>
                )}
                <ul className="space-y-1">
                  {preview.validation.warnings.map((w, i) => (
                    <li key={i} className={`flex items-start gap-2 text-sm ${w.level === 'block' ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {w.level === 'block' ? <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> : <Info className="h-4 w-4 shrink-0 mt-0.5" />}{w.msg}
                    </li>
                  ))}
                </ul>
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">送信ペイロード（JSON）</summary>
                  <pre className="mt-2 overflow-auto rounded bg-muted/40 p-2 max-h-72">{JSON.stringify(preview.payload, null, 2)}</pre>
                </details>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="text-sm font-medium">価格</CardHeader>
            <CardContent className="text-sm space-y-1.5">
              <Row k="仕入値（現在）" v={d.sourcePriceJpy != null ? formatJPY(d.sourcePriceJpy) : '—'} />
              <Row k="赤字下限" v={d.floorPriceJpy != null ? formatJPY(d.floorPriceJpy) : '—'} />
              <hr className="my-1" />
              <Row k={`販売価格（${d.listCurrency}）`} v={d.listPrice != null ? formatKRW(d.listPrice) : '—'} bold />
              {loss && <div className="flex items-center gap-1 text-xs text-destructive mt-1"><AlertTriangle className="h-3.5 w-3.5" />仕入値が赤字下限を超過＝赤字</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="text-sm font-medium">仕入元</CardHeader>
            <CardContent className="text-sm space-y-1.5">
              <Row k="モール" v={d.source} />
              <Row k="商品コード" v={d.sourceProductId} />
              <Row k="検索KW" v={d.batchQuery || '（手動／商品ページ取得）'} />
              {d.batchCapturedAt && <Row k="取得日時" v={formatDateTime(d.batchCapturedAt)} />}
              <Row k="在庫" v={d.sourceInStock === false ? '欠品' : d.sourceInStock === true ? 'あり' : '—'} />
              <Row k="最終取得" v={d.sourceCheckedAt ? formatDateTime(d.sourceCheckedAt) : '未取得'} />
              {d.sourceUrl && <a href={d.sourceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs">仕入元ページを開く</a>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs text-muted-foreground">{label}</label><div className="mt-1">{children}</div></div>;
}
function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">{k}</span><span className={`text-right ${bold ? 'font-semibold' : ''} tabular-nums break-all`}>{v}</span></div>;
}
