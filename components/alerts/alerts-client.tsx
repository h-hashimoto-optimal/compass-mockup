'use client';

import * as React from 'react';
import { RefreshCw, Loader2, PackageX, TrendingDown, Check, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatJPY } from '@/lib/utils';

type Alert = {
  id: string;
  type: string;
  status: string;
  titleJa: string | null;
  titleTranslated: string | null;
  listPrice: number | null;
  floorPriceJpy: number | null;
  source: string | null;
  sourceProductId: string | null;
  sourcePriceJpy: number | null;
  createdAt: string;
};

const typeLabel: Record<string, string> = { price_up_loss: '赤字', out_of_stock: '欠品' };
const statusLabel: Record<string, string> = { open: '未対応', ack: '確認済', resolved: '解消' };

export function AlertsClient() {
  const [items, setItems] = React.useState<Alert[]>([]);
  const [filter, setFilter] = React.useState<'open' | 'all'>('open');
  const [scanning, setScanning] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  const load = React.useCallback(() => {
    const q = filter === 'open' ? '?status=open' : '';
    fetch('/api/tenant/alerts' + q, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setItems(j.items ?? []))
      .finally(() => setLoaded(true));
  }, [filter]);
  React.useEffect(load, [load]);

  const scan = async () => {
    setScanning(true);
    try {
      await fetch('/api/tenant/alerts/scan', { method: 'POST' });
      load();
    } finally {
      setScanning(false);
    }
  };
  const setStatus = async (id: string, status: string) => {
    await fetch('/api/tenant/alerts/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const loss = items.filter((a) => a.type === 'price_up_loss' && a.status !== 'resolved').length;
  const oos = items.filter((a) => a.type === 'out_of_stock' && a.status !== 'resolved').length;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">在庫・損益アラート</h1>
          <p className="text-sm text-muted-foreground mt-1">自店舗の出品を走査し、赤字（仕入値が下限超過）／欠品を検知します。</p>
        </div>
        <Button onClick={scan} disabled={scanning}>
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          再スキャン
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <Card>
          <CardContent className={`p-4 ${loss > 0 ? 'border-destructive/40 bg-destructive/5' : ''}`}>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>赤字</span><TrendingDown className="h-4 w-4" />
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{loss}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className={`p-4 ${oos > 0 ? 'border-destructive/40 bg-destructive/5' : ''}`}>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>欠品</span><PackageX className="h-4 w-4" />
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{oos}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">検知アラート</CardTitle>
          <div className="flex gap-1">
            <Button size="sm" variant={filter === 'open' ? 'default' : 'outline'} onClick={() => setFilter('open')}>未対応</Button>
            <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>すべて</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">種別</TableHead>
                <TableHead>商品</TableHead>
                <TableHead className="text-right">仕入値</TableHead>
                <TableHead className="text-right">赤字下限</TableHead>
                <TableHead className="w-20">状態</TableHead>
                <TableHead className="w-28 text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loaded ? (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">読み込み中…</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">{filter === 'open' ? '未対応のアラートはありません。' : 'アラートはありません。「再スキャン」で検知します。'}</TableCell></TableRow>
              ) : (
                items.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Badge variant={a.type === 'out_of_stock' ? 'warning' : 'destructive'}>{typeLabel[a.type] ?? a.type}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      <div className="font-medium truncate">{a.titleTranslated || a.titleJa || '（無題）'}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{a.source}:{a.sourceProductId}</div>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{a.sourcePriceJpy != null ? formatJPY(a.sourcePriceJpy) : '—'}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{a.floorPriceJpy != null ? formatJPY(a.floorPriceJpy) : '—'}</TableCell>
                    <TableCell>
                      <Badge variant={a.status === 'open' ? 'destructive' : a.status === 'ack' ? 'info' : 'success'}>{statusLabel[a.status] ?? a.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-1">
                        {a.status === 'open' && (
                          <button onClick={() => setStatus(a.id, 'ack')} title="確認済にする" className="text-muted-foreground hover:text-foreground"><Eye className="h-4 w-4" /></button>
                        )}
                        {a.status !== 'resolved' && (
                          <button onClick={() => setStatus(a.id, 'resolved')} title="解消にする" className="text-muted-foreground hover:text-green-600"><Check className="h-4 w-4" /></button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
