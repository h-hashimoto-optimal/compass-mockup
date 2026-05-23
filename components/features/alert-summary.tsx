'use client';

import * as React from 'react';
import Link from 'next/link';
import { Siren, PackageX, TrendingDown, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { StoredAlert } from '@/lib/alert-store';

type SyncState = {
  lastSyncAt: string | null;
  alerts: StoredAlert[];
};

export function AlertSummary() {
  const [state, setState] = React.useState<SyncState | null>(null);

  React.useEffect(() => {
    fetch('/api/monitoring/sync')
      .then((r) => r.json())
      .then((j: SyncState) => setState(j))
      .catch(() => void 0);
  }, []);

  const alerts = state?.alerts ?? [];
  const oos = alerts.filter((a) => a.kind === 'oos').length;
  const loss = alerts.filter((a) => a.kind === 'loss').length;
  const lowMargin = alerts.filter((a) => a.kind === 'low_margin').length;
  const critical = oos + loss;

  return (
    <Card
      className={
        critical > 0 ? 'border-destructive/40 bg-destructive/5' : undefined
      }
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Siren
              className={`h-4 w-4 ${critical > 0 ? 'text-destructive' : 'text-muted-foreground'}`}
            />
            在庫・損益アラート
            {critical > 0 && (
              <Badge variant="destructive">緊急 {critical}件</Badge>
            )}
          </CardTitle>
          <Link
            href="/alerts"
            className="text-xs text-primary hover:underline"
          >
            監視へ →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {state?.lastSyncAt ? (
          <div className="grid grid-cols-3 gap-3">
            <Mini label="在庫切れ" value={oos} icon={PackageX} bad={oos > 0} />
            <Mini label="赤字" value={loss} icon={TrendingDown} bad={loss > 0} />
            <Mini
              label="低マージン"
              value={lowMargin}
              icon={AlertTriangle}
              bad={false}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            未同期。
            <Link href="/alerts" className="text-primary hover:underline">
              在庫・損益監視
            </Link>
            で「今すぐ同期」を実行すると赤字・在庫切れを検知します。
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Mini({
  label,
  value,
  icon: Icon,
  bad,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  bad: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-3 ${bad ? 'border-destructive/40 bg-destructive/5' : ''}`}
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div
        className={`mt-1 text-xl font-semibold tabular-nums ${bad ? 'text-destructive' : ''}`}
      >
        {value}
      </div>
    </div>
  );
}
