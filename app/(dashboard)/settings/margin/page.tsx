'use client';

import * as React from 'react';
import { Coins, Plus, Trash2, Save, Loader2, Check } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DEFAULT_MARGIN,
  computePricing,
  type MarginConfig,
  type Rounding,
} from '@/lib/pricing';
import { formatJPY, formatKRW } from '@/lib/utils';

const roundingLabel: Record<Rounding, string> = {
  ceil: '切り上げ（1KRW）',
  floor: '切り下げ（1KRW）',
  round_up_100_krw: '100KRW単位 切り上げ',
  round_up_1000_krw: '1000KRW単位 切り上げ',
};

export default function MarginSettingsPage() {
  const [cfg, setCfg] = React.useState<MarginConfig>(DEFAULT_MARGIN);
  const [loaded, setLoaded] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [sampleCost, setSampleCost] = React.useState(2980);
  const [sampleCat, setSampleCat] = React.useState('');

  React.useEffect(() => {
    fetch('/api/settings/margin')
      .then((r) => r.json())
      .then((j: MarginConfig) => setCfg(j))
      .catch(() => void 0)
      .finally(() => setLoaded(true));
  }, []);

  const set = <K extends keyof MarginConfig>(k: K, v: MarginConfig[K]) =>
    setCfg((c) => ({ ...c, [k]: v }));

  const numField =
    (k: keyof MarginConfig) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value);
      set(k, (Number.isFinite(v) ? v : 0) as never);
    };

  const addOverride = () =>
    set('categoryOverrides', [
      ...cfg.categoryOverrides,
      { category: '', rate: cfg.defaultRate },
    ]);
  const removeOverride = (i: number) =>
    set(
      'categoryOverrides',
      cfg.categoryOverrides.filter((_, idx) => idx !== i),
    );
  const editOverride = (i: number, patch: Partial<{ category: string; rate: number }>) =>
    set(
      'categoryOverrides',
      cfg.categoryOverrides.map((o, idx) =>
        idx === i ? { ...o, ...patch } : o,
      ),
    );

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/margin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      const j = (await res.json()) as MarginConfig;
      setCfg(j);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt((s) => (s ? null : s)), 2000);
    } finally {
      setSaving(false);
    }
  };

  const preview = computePricing(sampleCost, cfg, sampleCat || undefined);

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <PageHeader
        title="利益設定"
        description="既定の利益率・為替・カテゴリ別上書き。出品時の価格計算と一覧の赤字判定はすべてこの設定を参照します。"
        actions={
          <Button size="sm" onClick={save} disabled={!loaded || saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : savedAt ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {savedAt ? '保存しました' : '保存'}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary" />
            既定値
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="既定利益率 (%)" hint="0〜100% / 小数1桁">
            <Input
              type="number"
              step="0.1"
              value={cfg.defaultRate}
              onChange={numField('defaultRate')}
            />
          </Field>
          <Field label="基準為替レート (JPY→KRW)" hint="1円あたりのKRW">
            <Input
              type="number"
              step="0.01"
              value={cfg.fxBase}
              onChange={numField('fxBase')}
            />
          </Field>
          <Field label="為替バッファ (%)" hint="実レートに加算する安全マージン">
            <Input
              type="number"
              step="0.1"
              value={cfg.fxBuffer}
              onChange={numField('fxBuffer')}
            />
          </Field>
          <Field label="国際送料 (JPY/件)" hint="原価に上乗せする固定送料">
            <Input
              type="number"
              step="1"
              value={cfg.intlShipping}
              onChange={numField('intlShipping')}
            />
          </Field>
          <Field label="為替レート取得元">
            <Select
              value={cfg.fxSource}
              onChange={(e) => set('fxSource', e.target.value)}
            >
              <option>Open Exchange Rates</option>
              <option>手動指定</option>
            </Select>
          </Field>
          <Field label="端数処理">
            <Select
              value={cfg.rounding}
              onChange={(e) => set('rounding', e.target.value as Rounding)}
            >
              {(Object.keys(roundingLabel) as Rounding[]).map((k) => (
                <option key={k} value={k}>
                  {roundingLabel[k]}
                </option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              カテゴリ別 利益率上書き
            </CardTitle>
            <Button size="sm" variant="outline" onClick={addOverride}>
              <Plus className="h-4 w-4" />
              追加
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>カテゴリ（内部表記の前方一致）</TableHead>
                <TableHead className="w-32 text-right">利益率(%)</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cfg.categoryOverrides.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-xs text-muted-foreground text-center py-6"
                  >
                    上書きなし（全カテゴリで既定利益率を適用）
                  </TableCell>
                </TableRow>
              )}
              {cfg.categoryOverrides.map((c, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Input
                      value={c.category}
                      placeholder="例: 家電 / オーディオ"
                      onChange={(e) =>
                        editOverride(i, { category: e.target.value })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="0.1"
                      className="text-right"
                      value={c.rate}
                      onChange={(e) =>
                        editOverride(i, {
                          rate: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => removeOverride(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">プレビュー（試算）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="原価 (JPY)">
              <Input
                type="number"
                className="w-36"
                value={sampleCost}
                onChange={(e) =>
                  setSampleCost(parseFloat(e.target.value) || 0)
                }
              />
            </Field>
            <Field label="カテゴリ（任意・上書き確認用）">
              <Input
                className="w-56"
                placeholder="例: 家電 / オーディオ"
                value={sampleCat}
                onChange={(e) => setSampleCat(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="適用利益率" value={`${preview.marginRate}%`} hint={preview.marginSource === 'category' ? 'カテゴリ上書き' : '既定値'} />
            <Stat label="実効レート" value={`×${preview.fxRate}`} hint={`基準${cfg.fxBase}＋buf${cfg.fxBuffer}%`} />
            <Stat label="利益(JPY)" value={formatJPY(preview.profit)} hint={`原価+送料+関税+VAT=${formatJPY(preview.jpyTotal - preview.profit)}`} />
            <Stat label="販売価格" value={formatKRW(preview.krwFinal)} hint={`分岐 ${formatKRW(preview.breakEvenKrw)}`} accent />
          </div>
          <p className="text-[11px] text-muted-foreground">
            販売価格が <strong>{formatKRW(preview.breakEvenKrw)}</strong>（損益分岐）を下回ると赤字。出品一覧の「赤字」バッジはこの値で判定します。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
      {hint && (
        <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-md border p-3 ${accent ? 'border-primary/40 bg-primary/5' : ''}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums mt-1">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
