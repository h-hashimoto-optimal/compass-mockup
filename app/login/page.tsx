'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginForm />
    </React.Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next') || '/';
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'ログインに失敗しました');
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
            <span className="text-lg font-semibold tracking-tight">Compass</span>
          </div>
          <h1 className="text-base font-semibold">ログイン</h1>
          <p className="text-xs text-muted-foreground">韓国越境EC自動化ツール</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground">メールアドレス</label>
              <Input
                type="email"
                className="mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">パスワード</label>
              <div className="relative mt-1">
                <Input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                  aria-label="パスワード表示切替"
                >
                  {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {error && <div className="text-xs text-destructive">{error}</div>}

            <Button type="submit" className="w-full" disabled={busy}>
              <LogIn className="h-4 w-4" />
              {busy ? 'ログイン中...' : 'ログイン'}
            </Button>

            <p className="text-[11px] text-muted-foreground text-center">
              アカウントは本部からの招待制です。招待メールのリンクから初回パスワードを設定してください。
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
