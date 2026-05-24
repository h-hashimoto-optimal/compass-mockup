'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus, ArrowLeft, Loader2, Check } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Result = { id: string; titleJa: string | null; titleKo: string | null; listPrice: number | null; listCurrency: string };

export function AsinAddClient() {
  const [asin, setAsin] = React.useState('');
  const [titleJa, setTitleJa] = React.useState('');
  const [priceJpy, setPriceJpy] = React.useState('');
  const [msg, setMsg] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<'idle' | 'adding' | 'processing'>('idle');
  const [result, setResult] = React.useState<Result | null>(null);

  const busy = phase !== 'idle';

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asin.trim()) return;
    setMsg(null);
    setResult(null);

    // 1) 登録
    setPhase('adding');
    const r1 = await fetch('/api/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'amazon', channel: 'coupang', sourceProductId: asin.trim(), titleJa: titleJa || undefined, priceJpy: priceJpy || undefined }),
    });
    const j1 = await r1.json().catch(() => ({}));
    if (!r1.ok) {
      setPhase('idle');
      setMsg(j1.status === 'blocked' ? 'ブラックリスト該当のため追加できません' : j1.error ?? '追加に失敗しました');
      return;
    }
    if (j1.status === 'exists') {
      setPhase('idle');
      setMsg('このASINは既に登録済みです（商品管理で確認してください）');
      return;
    }
    const id = j1.listing.id as string;

    // 2) Amazon取得 → 翻訳 → 価格計算（出品待ちにする）
    setPhase('processing');
    const r2 = await fetch('/api/listings/' + id + '/process', { method: 'POST' });
    const j2 = await r2.json().catch(() => ({}));
    setPhase('idle');
    if (!r2.ok) {
      // 商品情報が取得できなければ登録しない（中途半端なdraftを残さない）
      await fetch('/api/listings/' + id, { method: 'DELETE' });
      setMsg('商品情報を取得できませんでした。ASINをご確認ください（登録していません）。');
      return;
    }
    const l = j2.listing ?? {};
    setResult({ id, titleJa: l.titleJa ?? null, titleKo: l.titleTranslated ?? null, listPrice: l.listPrice ?? null, listCurrency: l.listCurrency ?? 'KRW' });
    setAsin(''); setTitleJa(''); setPriceJpy('');
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Link href="/listings" className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" />商品管理へ戻る</Link>
      <div>
        <h1 className="text-xl font-semibold">ASIN手動追加</h1>
        <p className="text-sm text-muted-foreground mt-1">ASINを入れると、Amazon取得→翻訳→価格計算まで実行し、完了後に「商品管理」の<b>出品待ち</b>へ追加します。通常はChrome拡張→受信トレイをご利用ください。</p>
      </div>

      <Card>
        <CardHeader className="text-sm font-medium">1件追加</CardHeader>
        <CardContent>
          <form onSubmit={add} className="space-y-3">
            <div><label className="text-xs text-muted-foreground">ASIN（必須）</label><Input className="mt-1" value={asin} onChange={(e) => setAsin(e.target.value)} placeholder="B0XXXXXXXX" disabled={busy} required /></div>
            <div><label className="text-xs text-muted-foreground">タイトル（任意・未入力ならAmazonから取得）</label><Input className="mt-1" value={titleJa} onChange={(e) => setTitleJa(e.target.value)} disabled={busy} /></div>
            <div><label className="text-xs text-muted-foreground">仕入価格 円（任意・未入力ならAmazonから取得）</label><Input className="mt-1" value={priceJpy} onChange={(e) => setPriceJpy(e.target.value)} placeholder="例 1980" disabled={busy} /></div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={busy}>
                {phase === 'adding' ? <><Loader2 className="h-4 w-4 animate-spin" />登録中…</> : phase === 'processing' ? <><Loader2 className="h-4 w-4 animate-spin" />Amazon取得・翻訳中…</> : <><Plus className="h-4 w-4" />追加して取得・翻訳</>}
              </Button>
              {msg && <span className="text-sm text-primary">{msg}</span>}
            </div>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="text-sm font-medium inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-success" />追加完了（出品待ち）</CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div className="font-medium">{result.titleJa ?? '(タイトル未取得)'}</div>
            <div className="text-xs text-muted-foreground">韓国語：{result.titleKo || '（未翻訳）'}</div>
            <div className="text-xs text-muted-foreground">売価：{result.listPrice != null ? `${result.listPrice.toLocaleString('ja-JP')} ${result.listCurrency}` : '—'}</div>
            <div className="flex gap-3 pt-1">
              <Link href={`/listings/${result.id}`} className="text-primary hover:underline text-xs">出品詳細を開く →</Link>
              <Link href="/listings" className="text-primary hover:underline text-xs">商品管理で確認 →</Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
