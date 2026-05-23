'use client';

import * as React from 'react';
import { ShieldAlert, Plus, Search } from 'lucide-react';
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
import { ipWarningBrands, type IpBrand } from '@/lib/mock-data';

const levelMeta: Record<
  IpBrand['level'],
  { label: string; variant: 'destructive' | 'warning' }
> = {
  prohibited: { label: '出品不可', variant: 'destructive' },
  restricted: { label: '要確認', variant: 'warning' },
};

export default function IpBrandsPage() {
  const [rows, setRows] = React.useState<IpBrand[]>(ipWarningBrands);
  const [brand, setBrand] = React.useState('');
  const [level, setLevel] = React.useState<IpBrand['level']>('restricted');
  const [reason, setReason] = React.useState('');
  const [q, setQ] = React.useState('');

  const add = () => {
    if (!brand.trim()) return;
    setRows((r) => [
      {
        id: `IP-${String(r.length + 1).padStart(2, '0')}`,
        brand: brand.trim(),
        level,
        reason: reason.trim() || '（手動追加）',
        source: '自社追加',
        updatedAt: new Date().toISOString().slice(0, 10),
      },
      ...r,
    ]);
    setBrand('');
    setReason('');
  };

  const filtered = q.trim()
    ? rows.filter((r) =>
        r.brand.toLowerCase().includes(q.trim().toLowerCase()),
      )
    : rows;

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <PageHeader
        title="知財警告ブランドDB"
        description="権利者警告の実績・正規代理店必須ブランドのデータベース。出品商品一覧と出品/CSV生成時に自動で警告します。"
      />

      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="p-4 flex items-start gap-3 text-sm">
          <ShieldAlert className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-medium">本部共有データと自社追加</div>
            <p className="text-xs text-muted-foreground">
              <Badge variant="destructive" className="mr-1">
                出品不可
              </Badge>
              は出品処理をブロック、
              <Badge variant="warning" className="mx-1">
                要確認
              </Badge>
              は警告のみ（出品は可、担当者判断）。本部共有データは自動配信され、自社追加分と統合管理されます。
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            ブランドを追加
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
            <Input
              className="md:col-span-3"
              placeholder="ブランド名"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            />
            <Select
              className="md:col-span-2"
              value={level}
              onChange={(e) =>
                setLevel(e.target.value as IpBrand['level'])
              }
            >
              <option value="restricted">要確認</option>
              <option value="prohibited">出品不可</option>
            </Select>
            <Input
              className="md:col-span-5"
              placeholder="理由・備考"
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
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-warning" />
              登録ブランド（{filtered.length}）
            </span>
            <span className="relative">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-7 h-8 w-56 text-sm"
                placeholder="ブランド名で検索"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ブランド</TableHead>
                <TableHead>レベル</TableHead>
                <TableHead>理由</TableHead>
                <TableHead>出所</TableHead>
                <TableHead>更新日</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.brand}</TableCell>
                  <TableCell>
                    <Badge variant={levelMeta[r.level].variant}>
                      {levelMeta[r.level].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[320px]">
                    {r.reason}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={r.source === '本部共有' ? 'info' : 'muted'}
                    >
                      {r.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.updatedAt}
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
