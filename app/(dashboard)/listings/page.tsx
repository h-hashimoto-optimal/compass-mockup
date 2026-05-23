'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Plus,
  Download,
  FileSpreadsheet,
  Search,
  Trash2,
  Send,
  Pencil,
  Lock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ListingStatusBadge } from '@/components/common/status-badge';
import {
  sourceLabel,
  sourceBadgeVariant,
  ipBrandLevelByName,
  type Listing,
  type ListingStatus,
} from '@/lib/mock-data';
import {
  computePricing,
  DEFAULT_MARGIN,
  type MarginConfig,
} from '@/lib/pricing';
import { formatJPY, formatKRW, formatPercent } from '@/lib/utils';

// 出品中の実販売価格 × 仕入原価 × 利益設定 から実利益を算出
function rowProfit(
  priceJpy: number,
  priceKrw: number,
  category: string,
  cfg: MarginConfig,
) {
  const p = computePricing(priceJpy, cfg, category);
  const baseCostJpy = p.jpyTotal - p.profit; // 原価+送料+関税+VAT
  const revenueJpy = p.fxRate > 0 ? priceKrw / p.fxRate : 0;
  const profitJpy = Math.round(revenueJpy - baseCostJpy);
  const realRate = priceJpy > 0 ? (profitJpy / priceJpy) * 100 : 0;
  const loss = priceKrw < p.breakEvenKrw;
  return { profitJpy, realRate, loss, configuredRate: p.marginRate };
}

type Captured = {
  asin: string;
  title: string;
  brand?: string;
  priceJpy: number | null;
  imageUrl: string;
  url: string;
  source: string;
  query: string;
  capturedAt: string;
  receivedAt: string;
};

export default function ListingsPage() {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [cfg, setCfg] = React.useState<MarginConfig>(DEFAULT_MARGIN);
  const [captured, setCaptured] = React.useState<Captured[]>([]);
  const [submitted, setSubmitted] = React.useState<
    Record<string, { mode: string; ok: boolean; titleKo: string }>
  >({});

  React.useEffect(() => {
    fetch('/api/settings/margin')
      .then((r) => r.json())
      .then((j: MarginConfig) => setCfg(j))
      .catch(() => void 0);
    fetch('/api/asins')
      .then((r) => r.json())
      .then((j) => setCaptured(j.items ?? []))
      .catch(() => void 0);
    fetch('/api/coupang/submit')
      .then((r) => r.json())
      .then((j) => {
        const m: Record<string, { mode: string; ok: boolean; titleKo: string }> = {};
        for (const e of j.items ?? [])
          if (!m[e.asin])
            m[e.asin] = { mode: e.mode, ok: e.ok, titleKo: e.titleKo ?? '' };
        setSubmitted(m);
      })
      .catch(() => void 0);
  }, []);

  // ステータス判定: 受信トレイからCoupang登録を完了 = 販売中(live)、失敗時のみ rejected。
  const resolveStatus = (asin: string): ListingStatus => {
    const sub = submitted[asin];
    if (!sub) return 'draft';
    return sub.ok ? 'live' : 'rejected';
  };

  const rows = captured.map((c) => {
    const priceJpy = c.priceJpy ?? 0;
    const category = '';
    const priceKrw = computePricing(priceJpy, cfg, category).krwFinal;
    const status: ListingStatus = resolveStatus(c.asin);
    const titleKo = submitted[c.asin]?.titleKo ?? '';
    const l: Listing = {
      id: c.asin,
      titleJa: c.title || '(タイトル未取得)',
      titleKo,
      brand: c.brand || 'NoBrand',
      source: 'amazon',
      asin: c.asin,
      imageUrl: c.imageUrl || `https://picsum.photos/seed/${c.asin}/80/80`,
      category,
      priceJpy,
      priceKrw,
      marginRate: cfg.defaultRate,
      channel: { status },
      isProtected: false,
      updatedAt: c.receivedAt,
    };
    return { l, ...rowProfit(priceJpy, priceKrw, category, cfg) };
  });
  const lossCount = rows.filter((r) => r.loss).length;
  const avgRate =
    rows.length > 0
      ? rows.reduce((s, r) => s + r.realRate, 0) / rows.length
      : 0;

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((s) =>
      s.size === captured.length
        ? new Set()
        : new Set(captured.map((c) => c.asin)),
    );

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <PageHeader
        title="出品商品管理"
        description="Amazon仕入の商品をCoupangへ出品。"
        actions={
          <>
            <Button variant="outline" size="sm">
              <FileSpreadsheet className="h-4 w-4" />
              Coupang一括出品Excel
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              商品追加
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryStat label="出品商品" value={`${rows.length} 件`} />
        <SummaryStat
          label="平均 実利益率"
          value={`${avgRate.toFixed(1)}%`}
          tone={avgRate < 10 ? 'warn' : 'ok'}
        />
        <SummaryStat
          label="赤字の商品"
          value={`${lossCount} 件`}
          tone={lossCount > 0 ? 'bad' : 'ok'}
        />
        <SummaryStat
          label="利益設定"
          value={`既定 ${cfg.defaultRate}%`}
          hint={`実効レート ×${(cfg.fxBase * (1 + cfg.fxBuffer / 100)).toFixed(2)}`}
        />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="商品名・SKU・ASIN・クーポンID"
                className="pl-7"
              />
            </div>
            <Select defaultValue="">
              <option value="">Coupangステータス：全て</option>
              <option value="live">販売中</option>
              <option value="pending">出品待ち</option>
              <option value="rejected">却下</option>
              <option value="suspended">停止</option>
              <option value="draft">下書き</option>
            </Select>
            <Select defaultValue="">
              <option value="">カテゴリ：全て</option>
              <option>家電</option>
              <option>アパレル</option>
              <option>食品</option>
              <option>シューズ</option>
            </Select>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>価格(JPY):</span>
            <Input className="h-7 w-24 text-xs" placeholder="下限" />
            <span>〜</span>
            <Input className="h-7 w-24 text-xs" placeholder="上限" />
            <span className="ml-3">利益率(%):</span>
            <Input className="h-7 w-20 text-xs" placeholder="下限" />
            <span>〜</span>
            <Input className="h-7 w-20 text-xs" placeholder="上限" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>表示件数:</span>
            <Select className="h-7 w-[80px] text-xs">
              <option>20</option>
              <option>50</option>
              <option>100</option>
            </Select>
            <span className="ml-3">全 {rows.length} 件</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2">1 / 1</span>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  checked={captured.length > 0 && selected.size === captured.length}
                  onChange={toggleAll}
                />
              </TableHead>
              <TableHead className="w-14">画像</TableHead>
              <TableHead>商品名</TableHead>
              <TableHead>仕入元</TableHead>
              <TableHead>商品コード</TableHead>
              <TableHead>Coupang</TableHead>
              <TableHead className="text-right">仕入(JPY)</TableHead>
              <TableHead className="text-right">販売(KRW)</TableHead>
              <TableHead className="text-right">想定利益</TableHead>
              <TableHead className="text-right">実利益率</TableHead>
              <TableHead className="text-right">更新</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={11}
                  className="text-center text-sm text-muted-foreground py-10"
                >
                  受信トレイにASINがありません。「ASIN受信トレイ」で取り込むとここに表示されます。
                </TableCell>
              </TableRow>
            )}
            {rows.map(({ l, profitJpy, realRate, loss, configuredRate }) => {
              const checked = selected.has(l.id);
              return (
                <TableRow
                  key={l.id}
                  data-state={checked ? 'selected' : undefined}
                >
                  <TableCell>
                    <Checkbox checked={checked} onChange={() => toggle(l.id)} />
                  </TableCell>
                  <TableCell>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={l.imageUrl}
                      alt=""
                      className="h-10 w-10 rounded object-cover bg-muted"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {l.isProtected && (
                        <Lock className="h-3 w-3 text-warning" aria-label="削除防止" />
                      )}
                      <Link
                        href={`/listings/${l.id}`}
                        className="font-medium hover:underline truncate max-w-[260px] inline-block"
                      >
                        {l.titleJa}
                      </Link>
                      {ipBrandLevelByName[l.brand] && (
                        <Badge
                          variant={
                            ipBrandLevelByName[l.brand] === 'prohibited'
                              ? 'destructive'
                              : 'warning'
                          }
                          className="shrink-0"
                          title={`知財警告ブランド：${l.brand}`}
                        >
                          知財{ipBrandLevelByName[l.brand] === 'prohibited' ? '不可' : '注意'}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate max-w-[260px]">
                      {l.titleKo || '(未翻訳)'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={sourceBadgeVariant[l.source]}>
                      {sourceLabel[l.source]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs">{l.asin}</code>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-xs">
                      <ListingStatusBadge status={l.channel.status} />
                      {l.channel.externalId && (
                        <code className="text-[10px] text-muted-foreground">
                          {l.channel.externalId}
                        </code>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatJPY(l.priceJpy)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    <div className="flex items-center justify-end gap-1.5">
                      {loss && <Badge variant="destructive">赤字</Badge>}
                      <span>{formatKRW(l.priceKrw)}</span>
                      <span className="text-[10px] text-muted-foreground">
                        推定
                      </span>
                    </div>
                  </TableCell>
                  <TableCell
                    className={`text-right text-sm tabular-nums ${
                      profitJpy < 0 ? 'text-destructive font-medium' : ''
                    }`}
                  >
                    {formatJPY(profitJpy)}
                    <span className="text-[10px] text-muted-foreground ml-1">
                      推定
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    <span
                      className={
                        loss || realRate < 0
                          ? 'text-destructive font-medium'
                          : realRate < 10
                            ? 'text-warning'
                            : ''
                      }
                    >
                      {formatPercent(realRate)}
                    </span>
                    <div className="text-[10px] text-muted-foreground">
                      設定 {configuredRate}% ・ 推定
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {l.updatedAt.slice(5, 16).replace('T', ' ')}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {selected.size > 0 && (
          <div className="sticky bottom-3 mx-3 my-3 rounded-lg border bg-background shadow-lg p-3 flex items-center gap-3">
            <div className="text-sm font-medium">
              {selected.size}件 選択中
            </div>
            <div className="ml-auto flex gap-2">
              <Button size="sm">
                <Send className="h-4 w-4" />
                Coupangへ一括出品
              </Button>
              <Button size="sm" variant="outline">
                <Pencil className="h-4 w-4" />
                一括編集
              </Button>
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4" />
                CSVエクスポート
              </Button>
              <Button size="sm" variant="destructive">
                <Trash2 className="h-4 w-4" />
                削除
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'ok' | 'warn' | 'bad';
}) {
  const toneCls =
    tone === 'bad'
      ? 'border-destructive/40 bg-destructive/5'
      : tone === 'warn'
        ? 'border-warning/40 bg-warning/5'
        : '';
  return (
    <Card>
      <CardContent className={`p-4 ${toneCls}`}>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
        {hint && (
          <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>
        )}
      </CardContent>
    </Card>
  );
}
