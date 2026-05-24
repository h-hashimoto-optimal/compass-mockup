import Link from 'next/link';
import { Inbox, ListChecks, Send, Siren, Plug, Building2, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertSummary } from '@/components/features/alert-summary';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const tenantLinks = [
  { href: '/products', label: 'ASIN受信トレイ', desc: 'Chrome拡張で集めたASINを取り込む', icon: Inbox },
  { href: '/listings', label: '出品管理', desc: '翻訳・価格・赤字下限を整えて出品', icon: ListChecks },
  { href: '/publish', label: 'Coupang一括出品', desc: '送信待ちをまとめて処理・送信', icon: Send },
  { href: '/alerts', label: '在庫・損益アラート', desc: '赤字・欠品を検知して対処', icon: Siren },
  { href: '/settings/channels', label: '連携設定', desc: 'Amazon / Coupang のAPI鍵', icon: Plug },
];

export default async function HomePage() {
  const user = await getSession();
  const isOwner = user?.role === 'owner';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">こんにちは、{user?.fullName ?? 'ゲスト'} さん</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isOwner ? '本部アカウントでログイン中です。' : `${user?.tenantName ?? ''} の管理画面です。`}
        </p>
      </div>

      {isOwner ? (
        <Card>
          <CardContent className="p-6">
            <Link href="/admin/tenants" className="flex items-center gap-3 group">
              <div className="grid place-items-center h-10 w-10 rounded-md bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></div>
              <div className="flex-1">
                <div className="font-medium group-hover:underline">加盟店管理</div>
                <div className="text-sm text-muted-foreground">加盟店の招待・状態管理</div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <AlertSummary />
          <div className="grid gap-3 sm:grid-cols-2">
            {tenantLinks.map((l) => {
              const Icon = l.icon;
              return (
                <Link key={l.href} href={l.href}>
                  <Card className="hover:shadow-md transition-shadow h-full">
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className="grid place-items-center h-9 w-9 rounded-md bg-primary/10 text-primary shrink-0"><Icon className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <div className="font-medium">{l.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{l.desc}</div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
