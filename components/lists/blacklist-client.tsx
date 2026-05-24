'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Row = { id: string; source: string; sourceProductId: string; reason: string | null };

export function BlacklistClient() {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [asin, setAsin] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  const load = React.useCallback(() => {
    fetch('/api/tenant/blacklist', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setRows(j.items ?? []))
      .finally(() => setLoaded(true));
  }, []);
  React.useEffect(load, [load]);

  const add = async () => {
    if (!asin.trim()) return;
    setBusy(true);
    await fetch('/api/tenant/blacklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'amazon', asin: asin.trim(), reason }),
    });
    setAsin('');
    setReason('');
    setBusy(false);
    load();
  };
  const remove = async (id: string) => {
    await fetch('/api/tenant/blacklist?id=' + id, { method: 'DELETE' });
    load();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold">仕入ブラックリスト</h1>
        <p className="text-sm text-muted-foreground mt-1">登録したASINは取込時に自動で除外されます（自店舗専用）。出品事故の防止用。</p>
      </div>

      <Card>
        <CardHeader className="text-sm font-medium">追加</CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr,1.4fr,auto] sm:items-end">
          <div>
            <label className="text-xs text-muted-foreground">ASIN（Amazon）</label>
            <Input value={asin} onChange={(e) => setAsin(e.target.value)} placeholder="B0XXXXXXXX" className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">理由（任意）</label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="例）模倣品の疑い" className="mt-1" />
          </div>
          <Button onClick={add} disabled={busy || !asin.trim()}>
            <Plus className="h-4 w-4" />追加
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="text-sm font-medium">登録済み（{rows.length}）</CardHeader>
        <CardContent>
          {!loaded ? (
            <p className="text-sm text-muted-foreground">読み込み中…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">まだありません。</p>
          ) : (
            <ul className="divide-y">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
                  <Badge variant="outline">{r.source}</Badge>
                  <span className="font-mono font-medium">{r.sourceProductId}</span>
                  {r.reason && <span className="text-muted-foreground">{r.reason}</span>}
                  <button onClick={() => remove(r.id)} className="ml-auto text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
