'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function AsinAddClient() {
  const [asin, setAsin] = React.useState('');
  const [titleJa, setTitleJa] = React.useState('');
  const [priceJpy, setPriceJpy] = React.useState('');
  const [msg, setMsg] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asin.trim()) return;
    setBusy(true);
    setMsg(null);
    const r = await fetch('/api/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'amazon', channel: 'coupang', sourceProductId: asin.trim(), titleJa: titleJa || undefined, priceJpy: priceJpy || undefined }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg(j.error ?? '追加に失敗しました');
    setAsin(''); setTitleJa(''); setPriceJpy('');
    setMsg(j.status === 'exists' ? '既に登録済みのASINです' : 'ASINを追加しました（商品管理の「未処理」に入ります）');
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Link href="/listings" className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" />商品管理へ戻る</Link>
      <div>
        <h1 className="text-xl font-semibold">ASIN手動追加</h1>
        <p className="text-sm text-muted-foreground mt-1">通常はChrome拡張→受信トレイで取り込みます。ここは個別に1件登録したいときの補助です。</p>
      </div>
      <Card>
        <CardHeader className="text-sm font-medium">1件追加</CardHeader>
        <CardContent>
          <form onSubmit={add} className="space-y-3">
            <div><label className="text-xs text-muted-foreground">ASIN（必須）</label><Input className="mt-1" value={asin} onChange={(e) => setAsin(e.target.value)} placeholder="B0XXXXXXXX" required /></div>
            <div><label className="text-xs text-muted-foreground">タイトル（任意）</label><Input className="mt-1" value={titleJa} onChange={(e) => setTitleJa(e.target.value)} placeholder="（出品準備で自動取得）" /></div>
            <div><label className="text-xs text-muted-foreground">仕入価格 円（任意）</label><Input className="mt-1" value={priceJpy} onChange={(e) => setPriceJpy(e.target.value)} placeholder="例 1980" /></div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={busy}><Plus className="h-4 w-4" />{busy ? '追加中…' : '追加'}</Button>
              {msg && <span className="text-sm text-primary">{msg}</span>}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
