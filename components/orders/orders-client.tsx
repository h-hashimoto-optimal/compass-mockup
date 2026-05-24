'use client';

import * as React from 'react';
import { ShoppingBag, PlugZap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatKRW, formatDateTime } from '@/lib/utils';

type Order = {
  id: string;
  channel: string;
  channelOrderId: string;
  status: string;
  buyerName: string | null;
  totalAmount: number | null;
  currency: string;
  orderedAt: string | null;
};

export function OrdersClient() {
  const [items, setItems] = React.useState<Order[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/tenant/orders', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setItems(j.items ?? []))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold">受注</h1>
        <p className="text-sm text-muted-foreground mt-1">販売チャネルからの注文一覧です（自店舗専用）。</p>
      </div>

      <div className="flex items-start gap-2 rounded-md bg-info/10 text-info-foreground border border-info/30 text-sm p-3">
        <PlugZap className="h-4 w-4 shrink-0 mt-0.5 text-info" />
        <div>
          <div className="font-medium">Coupang 注文APIは未接続です</div>
          <div className="text-muted-foreground">連携が有効になると、注文がここへ自動同期されます。販売先の連携は「販売先（Coupang）」設定から行います。</div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ShoppingBag className="h-4 w-4" />注文一覧</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>注文番号</TableHead>
                <TableHead>チャネル</TableHead>
                <TableHead>購入者</TableHead>
                <TableHead className="text-right">金額</TableHead>
                <TableHead className="w-24">状態</TableHead>
                <TableHead>注文日時</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loaded ? (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">読み込み中…</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">注文はまだありません。</TableCell></TableRow>
              ) : (
                items.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono">{o.channelOrderId}</TableCell>
                    <TableCell>{o.channel}</TableCell>
                    <TableCell>{o.buyerName ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{o.totalAmount != null ? formatKRW(o.totalAmount) : '—'}</TableCell>
                    <TableCell><Badge variant="muted">{o.status}</Badge></TableCell>
                    <TableCell>{o.orderedAt ? formatDateTime(o.orderedAt) : '—'}</TableCell>
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
