'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { KeyRound, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function AcceptForm({
  token,
  email,
  tenantName,
}: {
  token: string;
  email: string;
  tenantName: string;
}) {
  const router = useRouter();
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('パスワードは8文字以上にしてください');
    if (password !== confirm) return setError('パスワードが一致しません');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '設定に失敗しました');
      router.push(json.redirect ?? '/');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
        <div>加盟店：<span className="font-medium text-foreground">{tenantName}</span></div>
        <div>メール：<span className="font-medium text-foreground">{email}</span></div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">パスワード（8文字以上）</label>
        <div className="relative mt-1">
          <Input
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
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

      <div>
        <label className="text-xs text-muted-foreground">パスワード（確認）</label>
        <Input
          type={show ? 'text' : 'password'}
          className="mt-1"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>

      {error && <div className="text-xs text-destructive">{error}</div>}

      <Button type="submit" className="w-full" disabled={busy}>
        <KeyRound className="h-4 w-4" />
        {busy ? '設定中...' : 'パスワードを設定して開始'}
      </Button>
    </form>
  );
}
