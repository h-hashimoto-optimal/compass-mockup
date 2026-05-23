// コアB：アラート通知（モック）。
// 実環境では LINE Messaging API / Chatwork API / SMTP を各 channel ブロックに差し込む。
// 送信履歴は globalThis 在メモリ（再起動でリセット）。

import type { MonitorConfig } from './monitoring';
import type { StoredAlert } from './alert-store';

export type NotifyEntry = {
  at: string;
  channel: 'line' | 'chatwork' | 'email';
  count: number;
  summary: string;
};

const KEY = '__compass_notify_log__';
type GlobalWithStore = typeof globalThis & { [KEY]?: NotifyEntry[] };

function log(): NotifyEntry[] {
  const g = globalThis as GlobalWithStore;
  if (!g[KEY]) g[KEY] = [];
  return g[KEY]!;
}

export function getNotifyLog(): NotifyEntry[] {
  return log();
}

export function sendAlertNotifications(
  alerts: StoredAlert[],
  cfg: MonitorConfig,
): { notifiedIds: string[]; channels: NotifyEntry['channel'][] } {
  const targets = alerts.filter((a) => !a.notified);
  const channels = (['line', 'chatwork', 'email'] as const).filter(
    (c) => cfg.channels[c],
  );
  if (targets.length === 0 || channels.length === 0) {
    return { notifiedIds: [], channels: [] };
  }

  const crit = targets.filter((a) => a.severity === 'critical').length;
  const summary = `🧭 Compass 監視: ${targets.length}件検知（緊急 ${crit}件）`;
  const at = new Date().toISOString();

  for (const channel of channels) {
    // 実環境ではここで各 API へ送信:
    //   line     → POST https://api.line.me/v2/bot/message/push
    //   chatwork → POST https://api.chatwork.com/v2/rooms/{room_id}/messages
    //   email    → SMTP / SES
    log().unshift({ at, channel, count: targets.length, summary });
  }

  return {
    notifiedIds: targets.map((a) => a.id),
    channels: [...channels],
  };
}
