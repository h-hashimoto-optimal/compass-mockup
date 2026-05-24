'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

type Row = { id: string; word: string; mode: string; replacement: string | null; enabled: boolean };

export function NgWordsClient() {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [word, setWord] = React.useState('');
  const [mode, setMode] = React.useState('block');
  const [replacement, setReplacement] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  const load = React.useCallback(() => {
    fetch('/api/tenant/ng-words', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setRows(j.items ?? []))
      .finally(() => setLoaded(true));
  }, []);
  React.useEffect(load, [load]);

  const add = async () => {
    if (!word.trim()) return;
    setBusy(true);
    await fetch('/api/tenant/ng-words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: word.trim(), mode, replacement: mode === 'replace' ? replacement : null }),
    });
    setWord('');
    setReplacement('');
    setBusy(false);
    load();
  };
  const remove = async (id: string) => {
    await fetch('/api/tenant/ng-words?id=' + id, { method: 'DELETE' });
    load();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold">禁止ワード</h1>
        <p className="text-sm text-muted-foreground mt-1">翻訳後の韓国語タイトルから自動で除去／置換します（自店舗専用）。処理時に適用されます。</p>
      </div>

      <Card>
        <CardHeader className="text-sm font-medium">追加</CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr,auto,1fr,auto] sm:items-end">
          <div>
            <label className="text-xs text-muted-foreground">ワード</label>
            <Input value={word} onChange={(e) => setWord(e.target.value)} placeholder="例）正規品" className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">動作</label>
            <Select value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1">
              <option value="block">除去</option>
              <option value="replace">置換</option>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">置換後（置換時のみ）</label>
            <Input value={replacement} onChange={(e) => setReplacement(e.target.value)} disabled={mode !== 'replace'} className="mt-1" />
          </div>
          <Button onClick={add} disabled={busy || !word.trim()}>
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
                  <span className="font-medium">{r.word}</span>
                  <Badge variant={r.mode === 'replace' ? 'secondary' : 'outline'}>
                    {r.mode === 'replace' ? `置換→「${r.replacement ?? ''}」` : '除去'}
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
