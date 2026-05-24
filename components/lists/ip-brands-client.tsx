'use client';

import * as React from 'react';
import { Plus, Trash2, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

type Row = { id: string; brand: string; level: string; own: boolean };

export function IpBrandsClient() {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [brand, setBrand] = React.useState('');
  const [level, setLevel] = React.useState('warn');
  const [busy, setBusy] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  const load = React.useCallback(() => {
    fetch('/api/tenant/ip-brands', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setRows(j.items ?? []))
      .finally(() => setLoaded(true));
  }, []);
  React.useEffect(load, [load]);

  const add = async () => {
    if (!brand.trim()) return;
    setBusy(true);
    await fetch('/api/tenant/ip-brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand: brand.trim(), level }),
    });
    setBrand('');
    setBusy(false);
    load();
  };
  const remove = async (id: string) => {
    await fetch('/api/tenant/ip-brands?id=' + id, { method: 'DELETE' });
    load();
  };

  const shared = rows.filter((r) => !r.own);
  const own = rows.filter((r) => r.own);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold">知財・監視ブランド</h1>
        <p className="text-sm text-muted-foreground mt-1">プレビュー時に該当ブランドを警告します。本部共有リスト＋自店舗の追加分が適用されます。</p>
      </div>

      <Card>
        <CardHeader className="text-sm font-medium">自店舗ブランドを追加</CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr,auto,auto] sm:items-end">
          <div>
            <label className="text-xs text-muted-foreground">ブランド名</label>
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="例）Nintendo" className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">レベル</label>
            <Select value={level} onChange={(e) => setLevel(e.target.value)} className="mt-1">
              <option value="warn">要注意</option>
              <option value="block">出品不可</option>
            </Select>
          </div>
          <Button onClick={add} disabled={busy || !brand.trim()}>
            <Plus className="h-4 w-4" />追加
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="text-sm font-medium">本部共有（{shared.length}・削除不可）</CardHeader>
        <CardContent>
          {!loaded ? (
            <p className="text-sm text-muted-foreground">読み込み中…</p>
          ) : shared.length === 0 ? (
            <p className="text-sm text-muted-foreground">共有リストはありません。</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {shared.map((r) => (
                <li key={r.id}>
                  <Badge variant={r.level === 'block' ? 'destructive' : 'warning'} className="gap-1">
                    <Lock className="h-3 w-3" />{r.brand}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="text-sm font-medium">自店舗追加（{own.length}）</CardHeader>
        <CardContent>
          {own.length === 0 ? (
            <p className="text-sm text-muted-foreground">まだありません。</p>
          ) : (
            <ul className="divide-y">
              {own.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="font-medium">{r.brand}</span>
                  <Badge variant={r.level === 'block' ? 'destructive' : 'warning'}>
                    {r.level === 'block' ? '出品不可' : '要注意'}
                  </Badge>
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
