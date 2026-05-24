'use client';

import * as React from 'react';
import Link from 'next/link';
import { Siren, PackageX, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type Alert = { type: string; status: string };

export function AlertSummary() {
  const [items, setItems] = React.useState<Alert[] | null>(null);
  const [denied, setDenied] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/tenant/alerts?status=open', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          setDenied(true);
          return;
        }
        const j = await r.json();
        setItems(j.items ?? []);
      })
      .catch(() => setDenied(true));
  }, []);

  const oos = (items ?? []).filter((a) => a.type === 'out_of_stock').length;
  const loss = (items ?? []).filter((a) => a.type === 'price_up_loss').length;
  const critical = oos + loss;

  return (
    <Card className={critical > 0 ? 'border-destructive/40 bg-destructive/5' : undefined}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Siren className={`h-4 w-4 ${critical > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            在庫・損益アラート
            {critical > 0 && <Badge variant="destructive">未対応 {critical}件</Badge>}
          </CardTitle>
          <Link href="/alerts" className="text-xs text-primary hover:underline">監視へ →</Link>
        </div>
      </CardHeader>
      <CardContent>
        {denied ? (
          <p className="text-sm text-muted-foreground">加盟店アカウントで利用できます。</p>
        ) : items === null ? (
          <p className="text-sm text-muted-foreground">読み込み中…</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Mini label="在庫切れ" value={oos} icon={PackageX} bad={oos > 0} />
            <Mini label="赤字" value={loss} icon={TrendingDown} bad={loss > 0} />
          </div>
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
    <div className={`rounded-md border p-3 ${bad ? 'border-destructive/40 bg-destructive/5' : ''}`}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${bad ? 'text-destructive' : ''}`}>{value}</div>
    </div>
  );
}
