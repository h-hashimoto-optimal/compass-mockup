'use client';

import * as React from 'react';
import { Siren, Save, Loader2, Check } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DEFAULT_MONITOR, type MonitorConfig } from '@/lib/monitoring';

const channelMeta: {
  key: keyof MonitorConfig['channels'];
  label: string;
  hint: string;
}[] = [
  { key: 'line', label: 'LINE', hint: 'LINE Messaging API（要対応の即時通知向け）' },
  { key: 'chatwork', label: 'Chatwork', hint: 'Chatwork API（運用チャットへ集約）' },
  { key: 'email', label: 'メール', hint: 'SMTP / SES（日次サマリ向け）' },
];

export default function MonitoringSettingsPage() {
  const [cfg, setCfg] = React.useState<MonitorConfig>(DEFAULT_MONITOR);
  const [loaded, setLoaded] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  React.useEffect(() => {
    fetch('/api/settings/monitoring')
      .then((r) => r.json())
      .then((j: MonitorConfig) => setCfg(j))
      .catch(() => void 0)
      .finally(() => setLoaded(true));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      const j = (await res.json()) as MonitorConfig;
      setCfg(j);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt((s) => (s ? null : s)), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <PageHeader
        title="在庫・損益監視 設定"
        description="下限価格ガードの閾値と、赤字／在庫切れを検知したときの通知先を設定します。"
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
            <Siren className="h-4 w-4 text-destructive" />
            下限価格ガード
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-start gap-3">
            <Checkbox
              checked={cfg.floorGuardEnabled}
              onChange={(e) =>
                setCfg((c) => ({
                  ...c,
                  floorGuardEnabled: e.target.checked,
                }))
              }
            />
            <span>
              <span className="text-sm font-medium">
                損益分岐割れ（赤字）を緊急検知する
              </span>
              <span className="block text-[11px] text-muted-foreground mt-0.5">
                利益設定の損益分岐価格（breakEven）を販売価格が下回った商品を「赤字」として検知します。
              </span>
            </span>
          </label>

          <div>
            <label className="text-xs text-muted-foreground">
              低マージン警告の下限実利益率 (%)
            </label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                type="number"
                step="0.1"
                className="w-32"
                value={cfg.minMarginRate}
                onChange={(e) =>
                  setCfg((c) => ({
                    ...c,
                    minMarginRate: parseFloat(e.target.value) || 0,
                  }))
                }
              />
              <span className="text-xs text-muted-foreground">
                実利益率がこの値を下回ると「低マージン」警告（赤字には至っていないが薄利）
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">通知先</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {channelMeta.map((ch) => (
            <label key={ch.key} className="flex items-start gap-3">
              <Checkbox
                checked={cfg.channels[ch.key]}
                onChange={(e) =>
                  setCfg((c) => ({
                    ...c,
                    channels: { ...c.channels, [ch.key]: e.target.checked },
                  }))
                }
              />
              <span>
                <span className="text-sm font-medium">{ch.label}</span>
                <span className="block text-[11px] text-muted-foreground mt-0.5">
                  {ch.hint}
                </span>
              </span>
            </label>
          ))}
          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            ※ モック段階では送信履歴の記録のみ。実環境で各APIの認証情報を投入すると実通知が飛びます。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
