'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ClearInboxButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  const onClick = async () => {
    if (!confirm('受信トレイと送信ログをクリアします。よろしいですか？')) return;
    setBusy(true);
    try {
      await fetch('/api/asins', { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" variant="ghost" onClick={onClick} disabled={busy}>
      <Trash2 className="h-3.5 w-3.5" />
      クリア
    </Button>
  );
}
