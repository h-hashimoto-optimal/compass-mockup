'use client';

import * as React from 'react';
import { Save, Check } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const pct = (rate: unknown, d: number) => {
  const n = Number(rate);
  return Number.isFinite(n) ? Math.round(n * 1000) / 10 : d; // 0.25 -> 25
};

export function SettingsClient() {
  const [marginPct, setMarginPct] = React.useState('25');
  const [fxBufferPct, setFxBufferPct] = React.useState('3');
  const [shipping, setShipping] = React.useState('0');
  const [feePct, setFeePct] = React.useState('11');
  const [rounding, setRounding] = React.useState('10');
  const [loaded, setLoaded] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/tenant/settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        setMarginPct(String(pct(j.settings?.marginRate, 25)));
        setFxBufferPct(String(pct(j.settings?.fxBuffer, 3)));
        setShipping(String(j.settings?.domesticShippingJpy ?? 0));
        setFeePct(String(pct(j.coupang?.sellFeeRate, 11)));
        setRounding(String(j.coupang?.priceRounding ?? 10));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const save = async () => {
    setBusy(true);
    setSaved(false);
    await fetch('/api/tenant/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {
          marginRate: (Number(marginPct) || 0) / 100,
          fxBuffer: (Number(fxBufferPct) || 0) / 100,
          domesticShippingJpy: shipping,
        },
        coupang: { sellFeeRate: (Number(feePct) || 0) / 100, priceRounding: rounding },
      }),
    });
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!loaded) return <p className="text-sm text-muted-foreground">読み込み中…</p>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold">利益・価格設定</h1>
        <p className="text-sm text-muted-foreground mt-1">この店舗の価格計算に使う設定です（自店舗専用）。処理・プレビューの売価/赤字下限に反映されます。</p>
      </div>

      <Card>
        <CardHeader className="text-sm font-medium">仕入・利益（共通）</CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Field label="目標利益率（%）"><Input value={marginPct} onChange={(e) => setMarginPct(e.target.value)} /></Field>
          <Field label="為替バッファ（%）"><Input value={fxBufferPct} onChange={(e) => setFxBufferPct(e.target.value)} /></Field>
          <Field label="国内送料（円）"><Input value={shipping} onChange={(e) => setShipping(e.target.value)} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="text-sm font-medium">Coupang（販売チャネル）</CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="販売手数料（%）"><Input value={feePct} onChange={(e) => setFeePct(e.target.value)} /></Field>
          <Field label="価格丸め単位（KRW）"><Input value={rounding} onChange={(e) => setRounding(e.target.value)} /></Field>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>
          <Save className="h-4 w-4" />
          {busy ? '保存中…' : '保存'}
        </Button>
        {saved && <span className="text-sm text-green-600 inline-flex items-center gap-1"><Check className="h-4 w-4" />保存しました</span>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
