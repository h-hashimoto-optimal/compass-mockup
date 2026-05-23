'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  Loader2,
  AlertTriangle,
  PackageX,
  TrendingDown,
  Bell,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
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
import {
  alertKindLabel,
  alertKindVariant,
  type MonitorConfig,
} from '@/lib/monitoring';
import type { StoredAlert } from '@/lib/alert-store';
import type { NotifyEntry } from '@/lib/notify';
import { formatJPY, formatKRW, formatDateTime } from '@/lib/utils';

type SyncState = {
  lastSyncAt: string | null;
  config: MonitorConfig;
  alerts: StoredAlert[];
  notifyLog: NotifyEntry[];
};

const channelLabel: Record<NotifyEntry['channel'], string> = {
  line: 'LINE',
  chatwork: 'Chatwork',
  email: 'メール',
};

export default function AlertsPage() {
  const [state, setState] = React.useState<SyncState | null>(null);
  const [syncing, setSyncing] = React.useState(false);

  const load = React.useCallback(() => {
    fetch('/api/monitoring/sync')
      .then((r) => r.json())
      .then((j: SyncState) => setState(j))
      .catch(() => void 0);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const sync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/monitoring/sync', { method: 'POST' });
      load();
    } finally {
      setSyncing(false);
    }
  };

  const alerts = state?.alerts ?? [];
  const oos = alerts.filter((a) => a.kind === 'oos').length;
  const loss = alerts.filter((a) => a.kind === 'loss').length;
  const lowMargin = alerts.filter((a) => a.kind === 'low_margin').length;

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <PageHeader
        title="在庫・損益監視"
        description="仕入元の最新原価・在庫を再取得し、赤字／在庫切れ／低マージンを検知して通知します。"
        actions={
          <Button size="sm" onClick={sync} disabled={syncing}>
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            今すぐ同期
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="在庫切れ"
          value={oos}
          icon={PackageX}
          tone={oos > 0 ? 'bad' : 'ok'}
        />
        <StatCard
          label="赤字"
          value={loss}
          icon={TrendingDown}
          tone={loss > 0 ? 'bad' : 'ok'}
        />
        <StatCard
          label="低マージン"
          value={lowMargin}
          icon={AlertTriangle}
          tone={lowMargin > 0 ? 'warn' : 'ok'}
        />
        <StatCard
          label="最終同期"
          value={state?.lastSyncAt ? formatDateTime(state.lastSyncAt) : '未実行'}
          icon={RefreshCw}
          tone="ok"
          small
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">検知アラート</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">種別</TableHead>
                <TableHead>商品</TableHead>
                <TableHead>内容</TableHead>
                <TableHead className="text-right">原価(JPY)</TableHead>
                <TableHead className="text-right">販売(KRW)</TableHead>
                <TableHead className="text-right">分岐(KRW)</TableHead>
                <TableHead className="text-right">実利益率</TableHead>
                <TableHead className="w-16 text-center">通知</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-sm text-muted-foreground py-10"
                  >
                    {state?.lastSyncAt
                      ? 'アラートなし。すべて健全です。'
                      : '「今すぐ同期」で仕入元を再取得して検知します。'}
                  </TableCell>
                </TableRow>
              )}
              {alerts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Badge variant={alertKindVariant[a.kind]}>
                      {alertKindLabel[a.kind]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/listings/${a.listingId}`}
                      className="font-medium hover:underline truncate max-w-[220px] inline-block"
                    >
                      {a.title}
                    </Link>
                    <div className="text-[10px] text-muted-foreground">
                      {a.listingId}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[280px]">
                    {a.detail}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {a.costJpyNow !== a.costJpyBefore ? (
                      <span>
                        <span className="text-muted-foreground line-through mr-1">
                          {formatJPY(a.costJpyBefore)}
                        </span>
                        <span className="text-destructive font-medium">
                          {formatJPY(a.costJpyNow)}
                        </span>
                      </span>
                    ) : (
                      formatJPY(a.costJpyNow)
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatKRW(a.salePriceKrw)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                    {formatKRW(a.breakEvenKrw)}
                  </TableCell>
                  <TableCell
                    className={`text-right text-sm tabular-nums ${
                      a.realMarginRate < 0
                        ? 'text-destructive font-medium'
                        : a.realMarginRate < 10
                          ? 'text-warning'
                          : ''
                    }`}
                  >
                    {a.realMarginRate}%
                  </TableCell>
                  <TableCell className="text-center">
                    {a.notified ? (
                      <Badge variant="success">済</Badge>
                    ) : (
                      <Badge variant="muted">—</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-info" />
            通知履歴
          </CardTitle>
        </CardHeader>
        <CardContent>
          {state && state.notifyLog.length > 0 ? (
            <ul className="divide-y text-sm">
              {state.notifyLog.slice(0, 12).map((n, i) => (
                <li key={i} className="flex items-center gap-3 py-2">
                  <Badge variant="info">{channelLabel[n.channel]}</Badge>
                  <span className="flex-1">{n.summary}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(n.at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              通知履歴なし。同期で緊急/警告を検知すると、
              <Link
                href="/settings/monitoring"
                className="text-primary hover:underline"
              >
                監視設定
              </Link>
              で有効化したチャネルへ通知します。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  small,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  tone: 'ok' | 'warn' | 'bad';
  small?: boolean;
}) {
  const cls =
    tone === 'bad'
      ? 'border-destructive/40 bg-destructive/5'
      : tone === 'warn'
        ? 'border-warning/40 bg-warning/5'
        : '';
  return (
    <Card>
      <CardContent className={`p-4 ${cls}`}>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <Icon className="h-4 w-4" />
        </div>
        <div
          className={`mt-1 font-semibold tabular-nums ${
            small ? 'text-sm' : 'text-2xl'
          }`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
