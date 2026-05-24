'use client';

import * as React from 'react';
import { Save, Check, Unplug, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export type FieldDef = { name: string; label: string; secret?: boolean; placeholder?: string };

type Status = { connected: boolean; fields: string[]; updatedAt: string | null; masterKey?: boolean };

export function IntegrationForm({
  kind,
  fields,
  note,
}: {
  kind: string;
  fields: FieldDef[];
  note?: React.ReactNode;
}) {
  const [status, setStatus] = React.useState<Status | null>(null);
  const [vals, setVals] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const load = React.useCallback(() => {
    fetch('/api/tenant/integrations/' + kind, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setStatus(j));
  }, [kind]);
  React.useEffect(load, [load]);

  const save = async () => {
    setBusy('save');
    setSaved(false);
    const payload: Record<string, string> = {};
    for (const f of fields) if (vals[f.name]?.trim()) payload[f.name] = vals[f.name].trim();
    await fetch('/api/tenant/integrations/' + kind, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setVals({});
    setBusy(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    load();
  };
  const disconnect = async () => {
    if (!confirm('この連携を解除します。保存済みの鍵は削除されます。よろしいですか？')) return;
    setBusy('del');
    await fetch('/api/tenant/integrations/' + kind, { method: 'DELETE' });
    setBusy(null);
    load();
  };

  if (!status) return <p className="text-sm text-muted-foreground">読み込み中…</p>;
  const noKey = status.masterKey === false;

  return (
    <div className="space-y-4">
      {noKey && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 text-destructive text-sm p-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          サーバの暗号化鍵（SECRETS_MASTER_KEY）が未設定のため保存できません。管理者にご連絡ください。
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 text-sm font-medium">
          <span>連携状態</span>
          {status.connected ? (
            <Badge variant="success" className="gap-1"><ShieldCheck className="h-3.5 w-3.5" />連携済み</Badge>
          ) : (
            <Badge variant="muted">未連携</Badge>
          )}
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          {status.connected ? (
            <>
              <div>設定済み項目: {status.fields.length}件（{status.fields.join(', ')}）</div>
              <div>更新: {status.updatedAt ? new Date(status.updatedAt).toLocaleString('ja-JP') : '—'}</div>
            </>
          ) : (
            <div>まだ連携していません。下のフォームに入力して保存してください。</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="text-sm font-medium">{status.connected ? '更新（変更する項目のみ入力）' : '新規連携'}</CardHeader>
        <CardContent className="space-y-3">
          {note && <div className="text-xs text-muted-foreground">{note}</div>}
          {fields.map((f) => (
            <div key={f.name}>
              <label className="text-xs text-muted-foreground">
                {f.label}{f.secret && <span className="ml-1 text-[10px] uppercase text-amber-600">secret</span>}
              </label>
              <Input
                className="mt-1"
                type={f.secret ? 'password' : 'text'}
                autoComplete="off"
                placeholder={status.connected && status.fields.includes(f.name) ? '設定済み（変更時のみ入力）' : f.placeholder}
                value={vals[f.name] ?? ''}
                onChange={(e) => setVals((s) => ({ ...s, [f.name]: e.target.value }))}
              />
            </div>
          ))}
          <div className="flex items-center gap-3 pt-1">
            <Button onClick={save} disabled={!!busy || noKey}>
              {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}保存
            </Button>
            {saved && <span className="text-sm text-green-600 inline-flex items-center gap-1"><Check className="h-4 w-4" />保存しました</span>}
            {status.connected && (
              <Button variant="outline" size="sm" className="ml-auto" onClick={disconnect} disabled={!!busy}>
                <Unplug className="h-4 w-4" />連携を解除
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">
            保存済みのシークレットは画面に表示されません（書き込み専用）。値はサーバで暗号化して保存されます。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
