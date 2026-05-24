'use client';

import * as React from 'react';
import Link from 'next/link';
import { KeyRound, Copy, Check, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Listing = {
  id: string;
  status: string;
  titleJa: string | null;
  sourceProductId: string;
  sourcePriceJpy: number | null;
};
type TokenRow = { id: string; label: string | null; lastUsedAt: string | null; createdAt: string };

const yen = (n: number | null) => (n == null ? '—' : `¥${n.toLocaleString('ja-JP')}`);

export function InboxClient() {
  const [drafts, setDrafts] = React.useState<Listing[]>([]);
  const [tokens, setTokens] = React.useState<TokenRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [newToken, setNewToken] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [busy, setBusy] = React.useState<Set<string>>(new Set());
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const load = React.useCallback(async () => {
    setLoading(true);
    const [l, t] = await Promise.all([
      fetch('/api/listings', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/tenant/token', { cache: 'no-store' }).then((r) => r.json()),
    ]);
    setDrafts((l.listings ?? []).filter((x: Listing) => x.status === 'draft'));
    setTokens(t.tokens ?? []);
    setLoading(false);
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);

  const genToken = async () => {
    const r = await fetch('/api/tenant/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const j = await r.json();
    if (r.ok) {
      setNewToken(j.token);
      load();
    }
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const process = async (id: string) => {
    setBusy((s) => new Set(s).add(id));
    await fetch(`/api/listings/${id}/process`, { method: 'POST' });
    setBusy((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    load();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold">ASIN受信トレイ</h1>
        <p className="text-sm text-muted-foreground mt-1">Chrome拡張で取り込んだASINがここ（draft）に入ります。処理すると出品管理へ進みます。<b>この受信トレイは自店舗専用</b>です。</p>
      </div>

      <Card>
        <CardHeader className="text-sm font-medium">Chrome拡張の接続トークン</CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            拡張からこの店舗に取り込むためのトークンです。拡張の設定に貼り付けてください（送信先 <code>{origin}/api/ingest</code> ／ ヘッダ <code>X-Compass-Token</code>）。発行済み: {tokens.length} 件。
          </p>
          {newToken ? (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="text-xs font-medium">発行しました（この画面でしか表示されません）：</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-background px-2 py-1.5 text-xs">{newToken}</code>
                <Button size="sm" variant="outline" onClick={() => copy(newToken)}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'コピー済' : 'コピー'}
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" onClick={genToken}>
              <KeyRound className="h-4 w-4" />
              トークンを発行
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">受信したASIN（draft）{drafts.length > 0 && <Badge variant="muted" className="ml-1">{drafts.length}</Badge>}</h2>
        <Button variant="outline" size="sm" className="ml-auto" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5" />
          更新
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : drafts.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">受信トレイは空です。拡張で取り込むか、<Link href="/listings" className="text-primary underline">出品管理</Link>でASINを手動追加できます。</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {drafts.map((d) => (
            <Card key={d.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{d.titleJa ?? '(タイトル未取得)'}</div>
                  <div className="text-xs text-muted-foreground">
                    <code>{d.sourceProductId}</code> ・ 仕入 {yen(d.sourcePriceJpy)}
                  </div>
                </div>
                <Button size="sm" disabled={busy.has(d.id)} onClick={() => process(d.id)}>
                  {busy.has(d.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  処理
                </Button>
                <Link href="/listings" className="text-xs text-primary underline shrink-0">出品管理へ</Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
