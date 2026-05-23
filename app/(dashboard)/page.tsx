import Link from 'next/link';
import {
  Activity,
  ArrowUpRight,
  Coins,
  Inbox,
  MessageCircle,
  PackageCheck,
  ShoppingBag,
  TrendingUp,
  AlertTriangle,
  Megaphone,
  Chrome,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BiChart } from '@/components/features/bi-chart';
import { AlertSummary } from '@/components/features/alert-summary';
import {
  announcements,
  csTickets,
  dashboardKpi,
  fxRate,
} from '@/lib/mock-data';
import { formatKRW, formatJPY, formatNumber } from '@/lib/utils';

const statusJa = {
  open: '未対応',
  auto_replied: '自動返信済',
  human_replied: '人間返信済',
  closed: '完了',
} as const;

const statusVariant = {
  open: 'destructive',
  auto_replied: 'info',
  human_replied: 'success',
  closed: 'muted',
} as const;

const categoryJa = {
  inquiry: '問い合わせ',
  shipping: '配送',
  return: '返品',
  complaint: 'クレーム',
} as const;

export default function HomePage() {
  const k = dashboardKpi;
  const openCs = csTickets.filter((c) => c.status === 'open');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="HOME"
        actions={
          <Link
            href="/products"
            className="inline-flex items-center justify-center gap-2 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
          >
            <Chrome className="h-4 w-4" />
            ASIN取得を始める
          </Link>
        }
      />

      {/* 本日のKPI（チェさん要望: 訪問数・注文数・売上） */}
      <section aria-label="本日のKPI">
        <div className="text-xs text-muted-foreground mb-2 px-1">本日（2026-04-27）</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard
            label="注文数"
            value={formatNumber(k.ordersToday)}
            unit="件"
            icon={ShoppingBag}
            accent="text-primary"
            href="/orders?range=today"
          />
          <KpiCard
            label="売上"
            value={formatKRW(k.revenueTodayKrw)}
            unit={`≒ ${formatJPY(k.revenueTodayJpy)}`}
            icon={Coins}
            accent="text-success"
            href="/orders?range=today"
          />
          <KpiCard
            label="未対応CS"
            value={formatNumber(k.csOpen)}
            unit={`返信済 ${k.csResponded}`}
            icon={MessageCircle}
            accent="text-destructive"
            href="#cs-section"
          />
        </div>
      </section>

      {/* 商品状態 */}
      <section aria-label="商品状態">
        <div className="text-xs text-muted-foreground mb-2 px-1">商品</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="販売中"
            value={formatNumber(k.live)}
            unit={`/ 全 ${formatNumber(k.totalListed)}`}
            icon={Activity}
            accent="text-success"
            href="/listings?status=live"
          />
          <KpiCard
            label="出品待ち"
            value={formatNumber(k.pending)}
            unit="件"
            icon={PackageCheck}
            accent="text-info"
            href="/listings?status=pending"
          />
          <KpiCard
            label="却下"
            value={formatNumber(k.rejected)}
            unit="件"
            icon={AlertTriangle}
            accent="text-destructive"
            href="/listings?status=rejected"
          />
          <KpiCard
            label="ASIN取得"
            value="開始"
            unit="Chrome拡張で収集"
            icon={Inbox}
            accent="text-primary"
            href="/products"
          />
        </div>
      </section>

      {/* 在庫・損益アラート集約（コアB） */}
      <section aria-label="在庫・損益アラート">
        <AlertSummary />
      </section>

      {/* メインチャート + 為替・お知らせ */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              指標推移
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BiChart />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-info" />
                為替
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tracking-tight">
                {fxRate.rate}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                JPY → KRW（バッファ +{fxRate.buffer}%）
              </div>
              <Link
                href="/settings/margin"
                className="text-xs text-primary hover:underline mt-3 inline-block"
              >
                利益設定へ →
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-warning" />
                本部からのお知らせ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {announcements.slice(0, 3).map((a) => (
                <div key={a.id} className="text-xs border-l-2 border-muted pl-3">
                  <div className="font-medium text-sm">{a.title}</div>
                  <div className="text-muted-foreground mt-0.5">
                    {a.publishedAt} ・ {a.body}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 未対応CS */}
      <section id="cs-section">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-destructive" />
                顧客問い合わせ（CS）
                <Badge variant="info">
                  自動一次返信 ON
                </Badge>
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                未対応 {openCs.length}件 ・ 本日返信 {k.csResponded}件
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {csTickets.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start gap-3 py-2.5 text-sm"
                >
                  <Badge variant={statusVariant[c.status]}>
                    {statusJa[c.status]}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{c.buyerName}</span>
                      <Badge variant="muted">{categoryJa[c.category]}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {c.productTitle}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {c.preview}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {c.receivedAt.slice(5, 16).replace('T', ' ')}
                  </div>
                </li>
              ))}
            </ul>
            <div className="text-[11px] text-muted-foreground mt-3 pt-3 border-t">
              ※ 「未対応」のみLINE通知（チェさん要望）。一次返信は自動化、人間対応が必要なものだけアラート。
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  unit,
  icon: Icon,
  accent,
  href,
}: {
  label: string;
  value: string;
  unit: string;
  icon: React.ElementType;
  accent: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{label}</span>
            <Icon className={`h-4 w-4 ${accent}`} />
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
            {value}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">{unit}</div>
        </CardContent>
      </Card>
    </Link>
  );
}
