'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as React from 'react';
import { Building2, Store, UserPlus, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function SignupPage() {
  const router = useRouter();
  const [role, setRole] = React.useState<'tenant_admin' | 'owner'>(
    'tenant_admin',
  );
  const [shop, setShop] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [pw2, setPw2] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.includes('@')) return setError('メールアドレスを入力してください');
    if (pw.length < 6) return setError('パスワードは6文字以上にしてください');
    if (pw !== pw2) return setError('パスワードが一致しません');
    if (role === 'tenant_admin' && !shop.trim())
      return setError('ショップ名を入力してください');
    setBusy(true);
    try {
      // モック：アカウントは保存せず、ロールでセッションを即発行（実装はSupabase Auth）
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, next: '/' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'signup failed');
      router.push(json.redirect);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen grid place-items-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center gap-2">
          <div className="flex items-center gap-2 justify-center">
            <div className="grid place-items-center h-9 w-9 rounded-md bg-primary text-primary-foreground font-bold">
              C
            </div>
            <span className="text-lg font-semibold tracking-tight">
              Compass
            </span>
          </div>
          <h1 className="text-base font-semibold">アカウント発行</h1>
          <p className="text-xs text-muted-foreground">
            韓国越境EC自動化ツール — モックアップ版
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground">区分</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <RoleCard
                  active={role === 'tenant_admin'}
                  onClick={() => setRole('tenant_admin')}
                  icon={Store}
                  label="加盟店"
                  hint="自モールを運用"
                />
                <RoleCard
                  active={role === 'owner'}
                  onClick={() => setRole('owner')}
                  icon={Building2}
                  label="本部"
                  hint="全テナント横断"
                />
              </div>
            </div>

            {role === 'tenant_admin' && (
              <div>
                <label className="text-xs text-muted-foreground">
                  ショップ名
                </label>
                <Input
                  className="mt-1"
                  placeholder="optimal shop"
                  value={shop}
                  onChange={(e) => setShop(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground">
                メールアドレス
              </label>
              <Input
                type="email"
                className="mt-1"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">
                  パスワード
                </label>
                <Input
                  type="password"
                  className="mt-1"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  パスワード（確認）
                </label>
                <Input
                  type="password"
                  className="mt-1"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="text-xs text-destructive">{error}</div>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {busy ? '発行中...' : 'アカウントを発行して開始'}
            </Button>

            <div className="rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground space-y-1">
              <div className="flex items-center gap-1">
                <Badge variant="muted">モック</Badge>
                入力内容は保存されず、選んだ区分でセッションを即発行します
              </div>
              <div>
                既にアカウントがある場合は{' '}
                <Link href="/login" className="text-primary hover:underline">
                  ログイン
                </Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function RoleCard({
  active,
  onClick,
  icon: Icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors ' +
        (active
          ? 'border-primary bg-primary/5'
          : 'border-input hover:bg-accent')
      }
    >
      <div className="flex items-center gap-2">
        <Icon
          className={`h-4 w-4 ${active ? 'text-primary' : 'text-muted-foreground'}`}
        />
        <span
          className={`text-sm font-medium ${active ? 'text-primary' : ''}`}
        >
          {label}
        </span>
      </div>
      <div className="text-[11px] text-muted-foreground">{hint}</div>
    </button>
  );
}
