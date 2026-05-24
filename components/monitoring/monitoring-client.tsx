'use client';

import * as React from 'react';
import { Save, Check, Info } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export function MonitoringClient() {
  const [detectLoss, setDetectLoss] = React.useState(true);
  const [detectOos, setDetectOos] = React.useState(true);
  const [bufferPct, setBufferPct] = React.useState('0');
  const [notifyEmail, setNotifyEmail] = React.useState(false);
  const [notifyChatwork, setNotifyChatwork] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/tenant/monitoring', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        setDetectLoss(j.detectLoss ?? true);
        setDetectOos(j.detectOos ?? true);
        setBufferPct(String(Math.round((Number(j.lossBufferPct) || 0) * 1000) / 10));
        setNotifyEmail(j.notifyEmail ?? false);
        setNotifyChatwork(j.notifyChatwork ?? false);
      })
      .finally(() => setLoaded(true));
  }, []);

  const save = async () => {
    setBusy(true);
    setSaved(false);
    await fetch('/api/tenant/monitoring', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        detectLoss,
        detectOos,
        lossBufferPct: (Number(bufferPct) || 0) / 100,
        notifyEmail,
        notifyChatwork,
      }),
    });
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold">在庫・損益 監視設定</h1>
        <p className="text-sm text-muted-foreground mt-1">「在庫・損益アラート」の再スキャンで使う検知条件です（自店舗専用）。</p>
      </div>

      {!loaded ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : (
      <>
      <Card>
        <CardHeader className="text-sm font-medium">検知条件</CardHeader>
        <CardContent className="space-y-3 text-sm">
          <label className="flex items-center gap-2">
            <Checkbox checked={detectLoss} onChange={(e) => setDetectLoss(e.target.checked)} />
            赤字を検知する（仕入値が赤字下限を超過）
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={detectOos} onChange={(e) => setDetectOos(e.target.checked)} />
            欠品を検知する（仕入元が在庫切れ）
          </label>
          <div className="pt-1">
            <label className="text-xs text-muted-foreground">赤字 予備警告マージン（%）</label>
            <Input className="mt-1 w-32" value={bufferPct} onChange={(e) => setBufferPct(e.target.value)} />
            <p className="text-[11px] text-muted-foreground mt-1 flex items-start gap-1">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              0なら実際に赤字のときだけ。例：10 にすると赤字下限の10%手前で先に警告します。
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="text-sm font-medium">通知先</CardHeader>
        <CardContent className="space-y-3 text-sm">
          <label className="flex items-center gap-2">
            <Checkbox checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
            メールで通知
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={notifyChatwork} onChange={(e) => setNotifyChatwork(e.target.checked)} />
            Chatworkで通知
          </label>
          <p className="text-[11px] text-muted-foreground">※ 通知の自動送信は今後の対応です（現状は設定の保存のみ）。</p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>
          <Save className="h-4 w-4" />{busy ? '保存中…' : '保存'}
        </Button>
        {saved && <span className="text-sm text-green-600 inline-flex items-center gap-1"><Check className="h-4 w-4" />保存しました</span>}
      </div>
      </>
      )}
    </div>
  );
}
