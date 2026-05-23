import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { invitations, tenants } from '@/lib/db/schema';
import { hashToken } from '@/lib/auth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AcceptForm } from '@/components/invite/accept-form';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function InvitePage({ params }: { params: { token: string } }) {
  const rows = await db
    .select({
      email: invitations.email,
      acceptedAt: invitations.acceptedAt,
      expiresAt: invitations.expiresAt,
      tenantName: tenants.name,
    })
    .from(invitations)
    .leftJoin(tenants, eq(invitations.tenantId, tenants.id))
    .where(eq(invitations.tokenHash, hashToken(params.token)))
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
            <AcceptForm token={params.token} email={inv.email} tenantName={inv.tenantName ?? ''} />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
