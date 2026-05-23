'use client';

import * as React from 'react';
import { ShieldBan, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  asinBlacklist,
  sourceLabel,
  sourceBadgeVariant,
  type BlacklistEntry,
  type SourcePlatform,
} from '@/lib/mock-data';

export default function BlacklistPage() {
  const [rows, setRows] = React.useState<BlacklistEntry[]>(asinBlacklist);
  const [source, setSource] = React.useState<SourcePlatform>('amazon');
  const [code, setCode] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [reason, setReason] = React.useState('');

  const reload = React.useCallback(async () => {
    try {
      const res = await fetch('/api/blacklist');
      const j = (await res.json()) as { all: BlacklistEntry[] };
      setRows(j.all ?? asinBlacklist);
    } catch {
      /* keep current */
    }
  }, []);

  React.useEffect(() => {
    reload();
  }, [reload]);

  const add = async () => {
    if (!code.trim()) return;
    await fetch('/api/blacklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entries: [
          {
            source,
            code: code.trim(),
            title: title.trim() || undefined,
            reason: reason.trim() || '（手動追加）',
          },
        ],
      }),
    });
    setCode('');
    setTitle('');
    setReason('');
    await reload();
  };

  const remove = async (entry: BlacklistEntry) => {
    // 動的追加分のみAPI経由で削除。シード分はクライアント側からのみ消す（mock-dataは編集不可）。
    if (entry.id.startsWith('BL-DYN-')) {
      await fetch(`/api/blacklist?code=${encodeURIComponent(entry.code)}`, {
        method: 'DELETE',
      });
      await reload();
    } else {
      setRows((r) => r.filter((x) => x.id !== entry.id));
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <PageHeader
        title="ASINブラックリスト"
        description="出品対象から恒久的に除外する商品コード（ASIN／楽天商品コード／Yahoo商品ID）。受信トレイ取込時に自動で弾かれます。"
      />

      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-4 flex items-start gap-3 text-sm">
          <ShieldBan className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-medium">自動除外の挙動</div>
            <p className="text-xs text-muted-foreground">
              ここに登録された商品コードは、Chrome拡張・手動入力・CSVインポートのどの経路でも
              ASIN受信トレイに入った時点で <strong className="text-foreground">出品候補から除外</strong> されます。
              既に出品済みの商品は手動で停止してください。
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            ブラックリストに追加
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
            <Select
              className="md:col-span-2"
              value={source}
              onChange={(e) =>
                setSource(e.target.value as SourcePlatform)
              }
            >
              <option value="amazon">Amazon</option>
              <option value="rakuten">楽天市場</option>
              <option value="yahoo">Yahoo!ショッピング</option>
            </Select>
            <Input
              className="md:col-span-3"
              placeholder="商品コード（例: B0XXXXXXX）"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Input
              className="md:col-span-3"
              placeholder="商品名（任意）"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Input
              className="md:col-span-2"
              placeholder="理由"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <Button className="md:col-span-2" size="sm" onClick={add}>
              <Plus className="h-4 w-4" />
              追加
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldBan className="h-4 w-4 text-destructive" />
            登録済み（{rows.length}）
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>仕入元</TableHead>
                <TableHead>商品コード</TableHead>
                <TableHead>商品名</TableHead>
                <TableHead>理由</TableHead>
                <TableHead>登録日</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Badge variant={sourceBadgeVariant[r.source]}>
                      {sourceLabel[r.source]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs">{r.code}</code>
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate">
                    {r.title}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.reason}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.addedAt}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => remove(r)}
                      aria-label="解除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
