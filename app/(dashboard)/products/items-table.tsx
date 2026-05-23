'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, X, ShieldBan, Undo2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatJPY } from '@/lib/utils';
import { RegisterButton } from './register-button';
import { BulkRegisterButton } from './bulk-register-button';
import { ClearInboxButton } from './clear-button';

type CapturedAsin = {
  asin: string;
  title: string;
  brand?: string;
  priceJpy: number | null;
  imageUrl: string;
  url: string;
  source: string;
  query: string;
  capturedAt: string;
  receivedAt: string;
};

type Stage = 'received' | 'enriched' | 'translated' | 'mapped' | 'ready';
const stageBadge: Record<Stage, { label: string; variant: 'muted' | 'info' | 'success' | 'warning' }> = {
  received: { label: 'Amazonからの受信', variant: 'muted' },
  enriched: { label: 'AMAZON-API済', variant: 'info' },
  translated: { label: '翻訳済', variant: 'info' },
  mapped: { label: 'カテゴリ推定済', variant: 'warning' },
  ready: { label: 'Coupang登録', variant: 'success' },
};
const stageOrder: Stage[] = ['received', 'enriched', 'translated', 'mapped', 'ready'];

type ToastState = {
  id: number;
  removed: CapturedAsin[];
  addedToBlacklist: boolean;
};

export function ItemsTable({
  initialItems,
  submittedAsins,
}: {
  initialItems: CapturedAsin[];
  submittedAsins: string[];
}) {
  const router = useRouter();
  const [items, setItems] = React.useState<CapturedAsin[]>(initialItems);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = React.useState(false);
  const [addToBlacklist, setAddToBlacklist] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [toast, setToast] = React.useState<ToastState | null>(null);
  const submittedSet = React.useMemo(() => new Set(submittedAsins), [submittedAsins]);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const stageOf = (asin: string): Stage => (submittedSet.has(asin) ? 'ready' : 'received');

  const toggleOne = (asin: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(asin)) next.delete(asin);
      else next.add(asin);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.asin)));
    }
  };

  const removeOne = async (asin: string) => {
    const res = await fetch(`/api/asins/${asin}`, { method: 'DELETE' });
    if (!res.ok) return;
    const data = (await res.json()) as { removed: CapturedAsin };
    setItems((it) => it.filter((i) => i.asin !== asin));
    setSelected((s) => {
      const next = new Set(s);
      next.delete(asin);
      return next;
    });
    setToast({
      id: Date.now(),
      removed: [data.removed],
      addedToBlacklist: false,
    });
  };

  const removeMany = async () => {
    const asins = Array.from(selected);
    if (asins.length === 0) return;
    const res = await fetch('/api/asins/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asins,
        addToBlacklist,
        reason: reason.trim() || undefined,
      }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      removed: CapturedAsin[];
      addedToBlacklist: { code: string }[];
    };
    setItems((it) => it.filter((i) => !selected.has(i.asin)));
    setSelected(new Set());
    setModalOpen(false);
    setAddToBlacklist(false);
    setReason('');
    setToast({
      id: Date.now(),
      removed: data.removed,
      addedToBlacklist: data.addedToBlacklist.length > 0,
    });
  };

  const undo = async () => {
    if (!toast) return;
    // 受信トレイに戻す
    await fetch('/api/asins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'amazon-jp',
        items: toast.removed.map((c) => ({
          asin: c.asin,
          title: c.title,
          brand: c.brand,
          priceJpy: c.priceJpy,
          imageUrl: c.imageUrl,
          url: c.url,
        })),
        query: toast.removed[0]?.query ?? '',
      }),
    });
    // ブラックリストに追加していたら戻す
    if (toast.addedToBlacklist) {
      const codes = toast.removed.map((c) => c.asin).join(',');
      await fetch(`/api/blacklist?codes=${codes}`, { method: 'DELETE' });
    }
    setItems((it) => {
      const have = new Set(it.map((i) => i.asin));
      return [...toast.removed.filter((c) => !have.has(c.asin)), ...it];
    });
    setToast(null);
    router.refresh();
  };

  return (
    <>
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="text-xs text-muted-foreground">
            全 {items.length} 件 ・ 新しい順
            {selected.size > 0 && (
              <span className="ml-3 text-primary font-medium">
                {selected.size} 件選択中
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setModalOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                選択した {selected.size} 件を除外
              </Button>
            )}
            <BulkRegisterButton asins={items.map((i) => i.asin)} />
            <ClearInboxButton />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={items.length > 0 && selected.size === items.length}
                  onChange={toggleAll}
                />
              </TableHead>
              <TableHead className="w-14">画像</TableHead>
              <TableHead>ASIN / タイトル</TableHead>
              <TableHead>キーワード</TableHead>
              <TableHead className="text-right">仕入価格</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>受信時刻</TableHead>
              <TableHead className="text-right">アクション</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((i) => {
              const stage = stageOf(i.asin);
              const sb = stageBadge[stage];
              const progress = stageOrder.indexOf(stage);
              const checked = selected.has(i.asin);
              return (
                <TableRow
                  key={i.asin + i.receivedAt}
                  data-state={checked ? 'selected' : undefined}
                  className="group"
                >
                  <TableCell>
                    <Checkbox
                      checked={checked}
                      onChange={() => toggleOne(i.asin)}
                    />
                  </TableCell>
                  <TableCell>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={i.imageUrl || `https://picsum.photos/seed/${i.asin}/64/64`}
                      alt=""
                      className="h-10 w-10 rounded object-cover bg-muted"
                    />
                  </TableCell>
                  <TableCell>
                    <code className="text-xs text-primary font-semibold">
                      {i.asin}
                    </code>
                    <div className="text-sm truncate max-w-[360px]">
                      {i.title || (
                        <span className="text-muted-foreground italic">
                          (タイトル未取得)
                        </span>
                      )}
                    </div>
                    <a
                      href={i.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-muted-foreground hover:underline"
                    >
                      Amazon で開く →
                    </a>
                  </TableCell>
                  <TableCell>
                    <Badge variant="muted">{i.query || '—'}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {i.priceJpy != null ? formatJPY(i.priceJpy) : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                      <div className="flex gap-0.5">
                        {stageOrder.map((_, idx) => (
                          <div
                            key={idx}
                            className={`h-1 w-3 rounded-full ${
                              idx <= progress ? 'bg-primary' : 'bg-muted'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(i.receivedAt).toLocaleString('ja-JP', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <RegisterButton asin={i.asin} />
                      <button
                        type="button"
                        onClick={() => removeOne(i.asin)}
                        className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition"
                        title="この行を受信トレイから除外"
                        aria-label="除外"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-background rounded-lg shadow-xl border w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 h-12 border-b flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              <span className="font-semibold text-sm">受信トレイから除外</span>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <p>
                選択中の <strong>{selected.size}</strong> 件を受信トレイから除外します。
              </p>
              <label className="flex items-start gap-2 cursor-pointer rounded-md border p-3 hover:bg-muted/30">
                <Checkbox
                  checked={addToBlacklist}
                  onChange={(e) => setAddToBlacklist(e.currentTarget.checked)}
                  className="mt-0.5"
                />
                <div className="flex-1 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <ShieldBan className="h-3.5 w-3.5 text-destructive" />
                    ブラックリストに追加（次回も自動除外）
                  </div>
                  <div className="text-muted-foreground">
                    Chrome拡張から同じASINを送っても受信時に弾かれます。
                  </div>
                </div>
              </label>
              {addToBlacklist && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    除外理由（任意）
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="例：利益率不足／知財懸念 など"
                    className="w-full h-9 px-3 text-sm rounded-md border bg-background"
                  />
                </div>
              )}
            </div>
            <div className="border-t px-5 h-14 flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setModalOpen(false)}
              >
                キャンセル
              </Button>
              <Button size="sm" variant="destructive" onClick={removeMany}>
                <Trash2 className="h-3.5 w-3.5" />
                除外する
              </Button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-background shadow-lg px-4 py-3 text-sm animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <span>
            <strong>{toast.removed.length}</strong> 件を受信トレイから除外しました
            {toast.addedToBlacklist && (
              <span className="text-muted-foreground text-xs ml-1">
                （BLにも追加）
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={undo}
            className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
          >
            <Undo2 className="h-3.5 w-3.5" />
            元に戻す
          </button>
        </div>
      )}
    </>
  );
}
