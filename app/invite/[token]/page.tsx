import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { invitations, tenants } from '@/lib/db/schema';
import { hashToken } from '@/lib/auth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rows = await db
    .select({
      email: invitations.email,
      acceptedAt: invitations.acceptedAt,
      expiresAt: invitations.expiresAt,
      tenantName: tenants.name,
    })
    .from(invitations)
    .leftJoin(tenants, eq(invitations.tenantId, tenants.id))
    .where(eq(invitations.tokenHash, hashToken(token)))
    .limit(1);

  const inv = rows[0];
  const invalid = !inv || !!inv.acceptedAt || new Date(inv.expiresAt) < new Date();

  return (
    <main className="min-h-screen grid place-items-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center gap-2">
          <div className="flex items-center gap-2 justify-center">
            <div className="grid place-items-center h-9 w-9 rounded-md bg-primary text-primary-foreground font-bold">
              C
            </div>
            <span className="text-lg font-semibold tracking-tight">Compass</span>
          </div>
          <h1 className="text-base font-semibold">アカウント設定</h1>
        </CardHeader>
        <CardContent>
          {invalid ? (
            <div className="text-sm text-muted-foreground text-center space-y-2">
              <p className="text-destructive font-medium">この招待リンクは無効です</p>
              <p className="text-xs">
                期限切れ・使用済み・URLの誤りの可能性があります。本部に再発行を依頼してください。
              </p>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{inv.tenantName ?? ''}</span> への招待です。招待された
                Googleアカウント（<span className="font-medium">{inv.email}</span>）でログインしてください。
              </p>
              <a
                href="/api/auth/google/start"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground h-10 text-sm font-medium hover:opacity-90"
              >
                Googleでログインして参加
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
