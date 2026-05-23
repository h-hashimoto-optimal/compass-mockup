import Link from 'next/link';
import {
  Chrome,
  Inbox,
  RefreshCw,
  Languages,
  Tag,
  PackageCheck,
  Download,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { readAll } from '@/lib/asin-store';
import { getSubmitLog } from '@/lib/submit-log';
import { asinBlacklist } from '@/lib/mock-data';
import { getAllDynamic } from '@/lib/blacklist-store';
import { AcquireWizard } from './acquire-wizard';
import { ItemsTable } from './items-table';

export const dynamic = 'force-dynamic';

type Stage = 'received' | 'enriched' | 'translated' | 'mapped' | 'ready';
const stages: { key: Stage; label: string; icon: any }[] = [
  { key: 'received', label: 'Amazonからの受信', icon: Inbox },
  { key: 'enriched', label: 'AMAZON-API', icon: Download },
  { key: 'translated', label: '翻訳', icon: Languages },
  { key: 'mapped', label: 'カテゴリ推定', icon: Tag },
  { key: 'ready', label: 'Coupang登録', icon: PackageCheck },
];

export default function ProductsPage() {
  const items = readAll();
  const groupedByQuery = items.reduce<Record<string, number>>((acc, i) => {
    const k = i.query || '(キーワードなし)';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const queries = Object.entries(groupedByQuery).slice(0, 6);

  const submittedAsins = new Set(getSubmitLog().map((e) => e.asin));
  const blacklistCount = asinBlacklist.length + getAllDynamic().length;
  const stageBuckets = items.reduce<Record<Stage, number>>(
    (acc, i) => {
      const s: Stage = submittedAsins.has(i.asin) ? 'ready' : 'received';
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    },
    { received: 0, enriched: 0, translated: 0, mapped: 0, ready: 0 },
  );

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <PageHeader
        title="ASIN受信トレイ"
        description="GoogleChromeの拡張機能でAmazonから集めた商品を、Coupangへ出品できる形に整形します。"
        actions={
          <form action="/products" method="get">
            <Button size="sm" type="submit" variant="outline">
              <RefreshCw className="h-4 w-4" />
              再読込
            </Button>
          </form>
        }
      />

      <AcquireWizard hasReceived={items.length > 0} />

      <div className="flex items-center gap-2 rounded-md border border-info/30 bg-info/5 px-3 py-2 text-xs">
        <Badge variant="info">自動除外</Badge>
        <span className="text-muted-foreground">
          ASINブラックリスト該当は受信時に自動で弾かれます（現在{' '}
          <strong className="text-foreground">{blacklistCount}</strong>{' '}
          件登録）。
        </span>
        <Link
          href="/settings/blacklist"
          className="ml-auto text-info hover:underline"
        >
          ブラックリストを管理 →
        </Link>
      </div>

      <PipelineDiagram buckets={stageBuckets} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Inbox className="h-4 w-4 text-primary" />
              受信中
            </div>
            <div className="mt-1 text-2xl font-semibold">{items.length}</div>
          </CardContent>
        </Card>
        <Card className="md:col-span-3">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-2">
              直近の検索キーワード
            </div>
            {queries.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">
                まだ受信がありません
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {queries.map(([q, n]) => (
                  <Badge key={q} variant="muted">
                    {q} <span className="ml-1 text-primary font-semibold">{n}</span>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <ItemsTable
          initialItems={items}
          submittedAsins={Array.from(submittedAsins)}
        />
      )}
    </div>
  );
}

function PipelineDiagram({ buckets }: { buckets: Record<Stage, number> }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground mb-3">
          Amazonの商品番号（ASIN）はCoupangにそのまま登録できません。Coupang用に「韓国語タイトル・Coupangカテゴリ・ウォン価格」へ変換してから出品します。
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {stages.map((s, idx) => {
            const Icon = s.icon;
            const count = buckets[s.key] ?? 0;
            const active = count > 0;
            return (
              <div key={s.key} className="flex items-center gap-1.5">
                <div
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                    active
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-muted bg-muted/30 text-muted-foreground'
                  }`}
                >
                  <Icon
                    className={`h-3.5 w-3.5 ${active ? 'text-primary' : ''}`}
                  />
                  <span className="font-medium">{s.label}</span>
                  <Badge variant={active ? 'info' : 'muted'} className="ml-1">
                    {count}
                  </Badge>
                </div>
                {idx < stages.length - 1 && (
                  <span className="text-muted-foreground select-none">→</span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="p-10 text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-full bg-muted grid place-items-center">
          <Chrome className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="text-sm font-medium">まだASINが届いていません</div>
        <div className="text-xs text-muted-foreground max-w-md mx-auto">
          Chrome拡張機能である「Compass ASIN Collector」をインストールし、Amazon.co.jp の検索結果ページで「Compassへ送信」を押してください。
        </div>
        <div className="flex justify-center gap-2 pt-2">
          <Link
            href="/settings/source"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            <Chrome className="h-4 w-4" />
            セットアップ手順を見る
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

