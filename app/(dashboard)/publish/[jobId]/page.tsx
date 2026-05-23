import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Hourglass,
  Pause,
  Square,
  RefreshCw,
  Download,
  Send,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { channelLabel, publishJob } from '@/lib/mock-data';

export default function PublishJobPage({
  params,
}: {
  params: { jobId: string };
}) {
  const j = publishJob;
  const pct = (j.succeeded / j.total) * 100;
  const inFlight = j.succeeded + j.warnings + j.failed;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <PageHeader
        title={`一括出品ジョブ #${params.jobId}`}
        description={`${channelLabel.coupang} へ ${j.total} 件を一括出品`}
        actions={
          <>
            <Badge variant={j.status === 'running' ? 'info' : 'muted'}>
              {j.status === 'running' ? '実行中' : j.status}
            </Badge>
          </>
        }
      />

      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium">
                進捗 {inFlight} / {j.total}
              </span>
              <span className="text-muted-foreground">
                {pct.toFixed(1)}%
              </span>
            </div>
            <Progress value={pct} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat
              icon={<CheckCircle2 className="h-4 w-4 text-success" />}
              label="成功"
              value={j.succeeded}
            />
            <Stat
              icon={<AlertCircle className="h-4 w-4 text-warning" />}
              label="警告"
              value={j.warnings}
            />
            <Stat
              icon={<XCircle className="h-4 w-4 text-destructive" />}
              label="失敗"
              value={j.failed}
            />
            <Stat
              icon={<Hourglass className="h-4 w-4 text-muted-foreground" />}
              label="待機"
              value={j.pending}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs text-muted-foreground border-t pt-3">
            <KV k="開始" v={j.startedAt.slice(11, 19)} />
            <KV k="経過" v={j.elapsed} />
            <KV k="推定残" v={j.estimatedRemaining} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">失敗一覧</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>商品</TableHead>
                <TableHead>エラー理由</TableHead>
                <TableHead className="w-32">アクション</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {j.failures.map((f) => (
                <TableRow key={f.n}>
                  <TableCell className="text-muted-foreground">{f.n}</TableCell>
                  <TableCell className="text-sm">
                    <div className="font-medium">{f.product}</div>
                    <div className="text-xs text-muted-foreground">
                      {f.listingId}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="destructive">{f.reason}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm">
                      {f.action === 'mapping' ? 'マッピング' : '編集'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm">
          <Pause className="h-4 w-4" />
          一時停止
        </Button>
        <Button variant="destructive" size="sm">
          <Square className="h-4 w-4" />
          中止
        </Button>
        <Button size="sm">
          <RefreshCw className="h-4 w-4" />
          失敗のみ再実行
        </Button>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4" />
          CSVダウンロード
        </Button>
        <div className="ml-auto text-xs text-muted-foreground">
          状態遷移: queued → running → succeeded / failed / cancelled
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border p-3">
      {icon}
      <div className="flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold tabular-nums">{value}</div>
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide">{k}</div>
      <div className="text-foreground text-sm tabular-nums">{v}</div>
    </div>
  );
}
