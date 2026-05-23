'use client';

import * as React from 'react';
import { Instagram, Copy, Check, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  listings,
  instagramHashtagPool,
  type Listing,
  type InstagramPostDraft,
} from '@/lib/mock-data';
import { formatKRW } from '@/lib/utils';

function buildDraft(l: Listing): InstagramPostDraft {
  const brandTag = `#${l.brand.replace(/[^A-Za-z0-9가-힣ぁ-んァ-ン一-龥]/g, '')}`;
  const hashtags = [
    brandTag,
    ...instagramHashtagPool.slice(0, 6),
  ];
  const caption =
    `${l.titleKo}\n\n` +
    `🇯🇵 일본에서 직접 가져온 ${l.brand} 정품!\n` +
    `💰 판매가 ${formatKRW(l.priceKrw)}\n` +
    `📦 안전배송 / 재고문의는 DM 환영합니다\n\n` +
    `${hashtags.join(' ')}`;
  return { listingId: l.id, caption, hashtags, imageUrl: l.imageUrl };
}

export default function InstagramPage() {
  const [selected, setSelected] = React.useState<Set<string>>(
    new Set([listings[0]?.id].filter(Boolean) as string[]),
  );
  const [copied, setCopied] = React.useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const drafts = listings
    .filter((l) => selected.has(l.id))
    .map(buildDraft);

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      /* clipboard 不可環境では何もしない（モック） */
    }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <PageHeader
        title="Instagram投稿データ生成"
        description="出品商品から韓国向けInstagram投稿（キャプション・ハッシュタグ・画像）を一括生成します。"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              対象商品を選択（{selected.size}）
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-[480px] overflow-y-auto">
            <ul className="divide-y">
              {listings.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40"
                >
                  <Checkbox
                    checked={selected.has(l.id)}
                    onChange={() => toggle(l.id)}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={l.imageUrl}
                    alt=""
                    className="h-9 w-9 rounded object-cover bg-muted"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate max-w-[280px]">
                      {l.titleJa}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {l.brand} ・ {formatKRW(l.priceKrw)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Instagram className="h-4 w-4 text-primary" />
              生成された投稿データ（{drafts.length}）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[480px] overflow-y-auto">
            {drafts.length === 0 && (
              <p className="text-sm text-muted-foreground">
                左の一覧から商品を選択してください。
              </p>
            )}
            {drafts.map((d) => (
              <div
                key={d.listingId}
                className="rounded-lg border overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.imageUrl}
                  alt=""
                  className="w-full h-40 object-cover bg-muted"
                />
                <div className="p-3 space-y-2">
                  <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed">
                    {d.caption}
                  </pre>
                  <div className="flex flex-wrap gap-1">
                    {d.hashtags.map((h) => (
                      <Badge key={h} variant="muted">
                        {h}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copy(d.listingId, d.caption)}
                    >
                      {copied === d.listingId ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          コピー済み
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          キャプションをコピー
                        </>
                      )}
                    </Button>
                    <code className="text-[10px] text-muted-foreground ml-auto">
                      {d.listingId}
                    </code>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <Button>
            <Instagram className="h-4 w-4" />
            選択分をまとめてエクスポート（{drafts.length}件）
          </Button>
          <span className="text-xs text-muted-foreground">
            画像 + caption.txt をZIPで出力 → 予約投稿ツールへ取込む想定（モック）
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
