'use client';

import { Search, Truck, X } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { orders } from '@/lib/mock-data';
import { formatKRW } from '@/lib/utils';

const statusVariant = {
  new: 'info',
  confirmed: 'secondary',
  shipped: 'success',
  delivered: 'success',
  cancelled: 'destructive',
  returned: 'warning',
} as const;

const statusJa = {
  new: '新規',
  confirmed: '確認済',
  shipped: '出荷済',
  delivered: '配達済',
  cancelled: 'キャンセル',
  returned: '返品',
};

export default function OrdersPage() {
  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <PageHeader
        title="受注一覧（Coupang）"
        description="Coupang Wing API から取り込まれた注文を管理"
      />

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">全て</TabsTrigger>
          <TabsTrigger value="new">新規</TabsTrigger>
          <TabsTrigger value="confirmed">確認済</TabsTrigger>
          <TabsTrigger value="shipped">出荷済</TabsTrigger>
          <TabsTrigger value="delivered">配達済</TabsTrigger>
          <TabsTrigger value="cancelled">キャンセル</TabsTrigger>
          <TabsTrigger value="returned">返品</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="注文番号・購入者名" className="pl-7" />
          </div>
          <Select>
            <option>期間：今月</option>
            <option>期間：今週</option>
            <option>期間：本日</option>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>注文日</TableHead>
              <TableHead>注文番号</TableHead>
              <TableHead>商品</TableHead>
              <TableHead className="text-right">数量</TableHead>
              <TableHead className="text-right">金額</TableHead>
              <TableHead>PCCC</TableHead>
              <TableHead>状態</TableHead>
              <TableHead className="text-right">アクション</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="text-xs whitespace-nowrap">
                  {o.orderedAt.slice(5, 16).replace('T', ' ')}
                </TableCell>
                <TableCell>
                  <code className="text-xs">{o.externalOrderId}</code>
                  <div className="text-xs text-muted-foreground">{o.buyerName}</div>
                </TableCell>
                <TableCell className="text-sm max-w-[260px] truncate">
                  {o.productTitle}
                </TableCell>
                <TableCell className="text-right">{o.qty}</TableCell>
                <TableCell className="text-right text-sm">
                  {formatKRW(o.totalKrw)}
                </TableCell>
                <TableCell>
                  <code className="text-xs">{o.pccc}</code>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[o.status]}>
                    {statusJa[o.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {(o.status === 'new' || o.status === 'confirmed') && (
                      <Button size="sm" variant="outline">
                        <Truck className="h-3.5 w-3.5" />
                        出荷登録
                      </Button>
                    )}
                    {o.status !== 'cancelled' && o.status !== 'delivered' && (
                      <Button size="sm" variant="ghost">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
