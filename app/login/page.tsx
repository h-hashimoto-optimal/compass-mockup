'use client';

import { useSearchParams } from 'next/navigation';
import * as React from 'react';
import { LogIn } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const ERROR_MESSAGES: Record<string, string> = {
  not_invited: 'このGoogleアカウントは招待されていません。本部にご確認ください。',
  account_mismatch: '別のGoogleアカウントで登録済みです。',
  unverified: 'Googleのメールアドレスが確認済みではありません。',
  state: 'セッションの検証に失敗しました。もう一度お試しください。',
  oauth: 'ログインに失敗しました。もう一度お試しください。',
  google: 'Google認証に失敗しました。もう一度お試しください。',
};

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginForm />
    </React.Suspense>
  );
}

function LoginForm() {
  const sp = useSearchParams();
  const next = sp.get('next') || '/';
  const error = sp.get('error');
  const href = `/api/auth/google/start?next=${encodeURIComponent(next)}`;

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
          {error && (
            <div className="text-xs text-destructive mb-3 text-center">
              {ERROR_MESSAGES[error] ?? 'ログインに失敗しました。'}
            </div>
          )}
          <Button
            className="w-full"
            onClick={() => {
              window.location.href = href;
            }}
          >
            <LogIn className="h-4 w-4" />
            Googleでログイン
          </Button>
          <p className="text-[11px] text-muted-foreground text-center mt-4">
            アカウントは本部からの招待制です。招待されたGoogleアカウントでログインしてください。
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
