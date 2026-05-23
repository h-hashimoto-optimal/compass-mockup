'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { UserPlus, Copy, Check, Pause, Play, RotateCw, X } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type TenantRow = { id: string; name: string; slug: string; status: string };
type PendingRow = { id: string; email: string; tenantName: string | null; role: string; expiresAt: string };

export function AdminClient({ tenants, pending }: { tenants: TenantRow[]; pending: PendingRow[] }) {
  const router = useRouter();
  const [tenantName, setTenantName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInviteUrl(null);
    setBusy(true);
    try {
      const res = await fetch('/api/admin/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantName, email, fullName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '作成に失敗しました');
      setInviteUrl(json.inviteUrl);
      setTenantName('');
      setEmail('');
      setFullName('');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const setTenantStatus = async (id: string, status: 'active' | 'suspended') => {
    if (status === 'suspended' && !confirm('この加盟店を停止しますか？（ログインできなくなります）')) return;
    const res = await fetch(`/api/admin/tenants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) setError((await res.json()).error ?? '更新に失敗しました');
    router.refresh();
  };

  const resend = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/admin/invitations/${id}`, { method: 'POST' });
    const json = await res.json();
    if (!res.ok) return setError(json.error ?? '再送に失敗しました');
    setInviteUrl(json.inviteUrl);
    router.refresh();
  };

  const revoke = async (id: string) => {
    if (!confirm('この招待を取り消しますか？')) return;
    const res = await fetch(`/api/admin/invitations/${id}`, { method: 'DELETE' });
    if (!res.ok) setError((await res.json()).error ?? '取消に失敗しました');
    router.refresh();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold">加盟店管理（本部）</h1>
        <p className="text-sm text-muted-foreground mt-1">
          加盟店の招待と、停止/再開だけを行います（提供者として最小限の管理）。
        </p>
      </div>

      <Card>
        <CardHeader className="font-medium text-sm">＋ 加盟店を招待</CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground">加盟店名</label>
              <Input className="mt-1" value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="例：オプティマル商店" required />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">担当者メール</label>
              <Input type="email" className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@shop.example.com" required />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">担当者名（任意）</label>
              <Input className="mt-1" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="山田 太郎" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy}>
                <UserPlus className="h-4 w-4" />
                {busy ? '作成中...' : '加盟店を作成して招待リンク発行'}
              </Button>
            </div>
          </form>

          {error && <div className="mt-3 text-xs text-destructive">{error}</div>}

          {inviteUrl && (
            <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="text-xs font-medium">招待リンク（7日間有効）。加盟者に渡してください：</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-background px-2 py-1.5 text-xs">{inviteUrl}</code>
                <Button type="button" variant="outline" size="sm" onClick={() => copy(inviteUrl)}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'コピー済' : 'コピー'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="font-medium text-sm">
          招待中（未受諾）{pending.length > 0 && <Badge variant="muted" className="ml-2">{pending.length}</Badge>}
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-xs text-muted-foreground">未受諾の招待はありません。</p>
          ) : (
            <ul className="divide-y text-sm">
              {pending.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{p.tenantName}</span>
                    <span className="text-muted-foreground"> — {p.email}</span>
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => resend(p.id)}>
                      <RotateCw className="h-3.5 w-3.5" />
                      再送
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => revoke(p.id)}>
                      <X className="h-3.5 w-3.5" />
                      取消
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="font-medium text-sm">
          加盟店一覧 <Badge variant="muted" className="ml-2">{tenants.length}</Badge>
        </CardHeader>
        <CardContent>
          {tenants.length === 0 ? (
            <p className="text-xs text-muted-foreground">まだ加盟店がありません。</p>
          ) : (
            <ul className="divide-y text-sm">
              {tenants.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0 truncate font-medium">{t.name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge variant={t.status === 'active' ? 'success' : 'warning'}>
                      {t.status === 'active' ? '稼働中' : '停止中'}
                    </Badge>
                    {t.status === 'active' ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setTenantStatus(t.id, 'suspended')}>
                        <Pause className="h-3.5 w-3.5" />
                        停止
                      </Button>
                    ) : (
                      <Button type="button" variant="outline" size="sm" onClick={() => setTenantStatus(t.id, 'active')}>
                        <Play className="h-3.5 w-3.5" />
                        再開
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
