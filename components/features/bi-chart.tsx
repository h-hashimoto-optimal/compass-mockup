'use client';

import * as React from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { dailyMetrics } from '@/lib/mock-data';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Metric = 'revenue' | 'orders';

const meta: Record<Metric, { label: string; color: string; unit: string }> = {
  revenue: { label: '売上', color: '#14B8A6', unit: 'KRW' },
  orders: { label: '注文数', color: '#F59E0B', unit: '件' },
};

export function BiChart() {
  const [m, setM] = React.useState<Metric>('revenue');

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Tabs value={m} onValueChange={(v) => setM(v as Metric)} defaultValue="revenue">
          <TabsList>
            <TabsTrigger value="revenue">売上</TabsTrigger>
            <TabsTrigger value="orders">注文数</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="text-xs text-muted-foreground">
          直近30日 ・ 単位: {meta[m].unit}
        </div>
      </div>
      <div className="h-72 w-full" aria-label={`${meta[m].label}推移`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={dailyMetrics}
            margin={{ top: 5, right: 12, left: 4, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickFormatter={(v) =>
                m === 'revenue' ? `${(v / 1000).toFixed(0)}k` : String(v)
              }
            />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v: number) =>
                m === 'revenue'
                  ? new Intl.NumberFormat('ko-KR').format(v) + ' KRW'
                  : new Intl.NumberFormat('ja-JP').format(v) + ' ' + meta[m].unit
              }
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {m === 'revenue' ? (
              <Line
                type="monotone"
                dataKey={m}
                stroke={meta[m].color}
                strokeWidth={2.5}
                dot={false}
                name={meta[m].label}
              />
            ) : (
              <Bar dataKey={m} fill={meta[m].color} name={meta[m].label} radius={[4, 4, 0, 0]} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
