import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Trash2,
  Copy,
  Save,
  Lock,
  ImagePlus,
  Languages,
  Coins,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ListingStatusBadge } from '@/components/common/status-badge';
import {
  fxRate,
  listings,
  sourceLabel,
  type Listing,
  type ListingStatus,
} from '@/lib/mock-data';
import { readAll } from '@/lib/asin-store';
import { getSubmitLog } from '@/lib/submit-log';
import { computePricing, getMarginConfig } from '@/lib/pricing';
import { formatJPY, formatKRW, formatPercent } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function buildListingFromCaptured(asin: string): Listing | null {
  const cap = readAll().find((c) => c.asin === asin);
  if (!cap) return null;
  const log = getSubmitLog().find((e) => e.asin === asin);
  const cfg = getMarginConfig();
  const priceJpy = cap.priceJpy ?? 0;
  const priceKrw = log?.priceKrw ?? computePricing(priceJpy, cfg, '').krwFinal;
  const status: ListingStatus = !log
    ? 'draft'
    : log.ok
      ? 'live'
      : 'rejected';
  return {
    id: cap.asin,
    titleJa: cap.title || '(タイトル未取得)',
    titleKo: log?.titleKo ?? '',
    brand: cap.brand || 'NoBrand',
    source: 'amazon',
    asin: cap.asin,
    imageUrl: cap.imageUrl || `https://picsum.photos/seed/${cap.asin}/200/200`,
    category: '',
    priceJpy,
    priceKrw,
    marginRate: cfg.defaultRate,
    channel: { status },
    isProtected: false,
    updatedAt: cap.receivedAt,
  };
}

export default function ListingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const listing =
    listings.find((l) => l.id === params.id) ?? buildListingFromCaptured(params.id);
  if (!listing) notFound();

  const cfg = getMarginConfig();
  const pricing = computePricing(listing.priceJpy, cfg, listing.category);

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div>
        <Link
          href="/listings"
          className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" />
          一覧へ戻る
        </Link>
      </div>

      <PageHeader
        title={listing.titleJa}
        description={`${listing.brand} ・ ${listing.category || '(カテゴリ未設定)'} ・ ${sourceLabel[listing.source]} (${listing.asin})`}
        actions={
          <>
            <Button variant="outline" size="sm">
              <Copy className="h-4 w-4" />
              複製
            </Button>
            <Button variant="destructive" size="sm">
              <Trash2 className="h-4 w-4" />
              削除
            </Button>
            <Button size="sm">
              <Save className="h-4 w-4" />
              保存
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Tabs defaultValue="basic">
            <TabsList>
              <TabsTrigger value="basic">基本情報</TabsTrigger>
              <TabsTrigger value="images">画像</TabsTrigger>
              <TabsTrigger value="translation">翻訳</TabsTrigger>
              <TabsTrigger value="price">価格</TabsTrigger>
              <TabsTrigger value="coupang">Coupang</TabsTrigger>
            </TabsList>

            <TabsContent value="basic">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <Field label="商品名 (JA)" defaultValue={listing.titleJa} />
                  <Field label="商品名 (KO)" defaultValue={listing.titleKo} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="ブランド" defaultValue={listing.brand} />
                    <Field label="ASIN" defaultValue={listing.asin} />
                  </div>
                  <Field label="カテゴリ" defaultValue={listing.category} />
                  <div>
                    <label className="text-xs text-muted-foreground">説明 (JA)</label>
                    <textarea
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      rows={5}
                      defaultValue={`【${listing.brand}】${listing.titleJa}\n\n日本国内正規流通品。当日発送可能。`}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="images">
              <Card>
                <CardContent className="p-6">
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={`https://picsum.photos/seed/${listing.id}-${i}/200/200`}
                        alt=""
                        className="aspect-square w-full rounded border object-cover bg-muted"
                      />
                    ))}
                    <button className="aspect-square w-full rounded border-2 border-dashed grid place-items-center text-muted-foreground hover:text-foreground hover:border-primary">
                      <ImagePlus className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    1〜10枚 ・ 各5MB以下 ・ JPG/PNG/WEBP ・ ドラッグで並び替え
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="translation">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">原文 (JA)</label>
                      <textarea
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                        rows={6}
                        defaultValue={listing.titleJa}
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">韓国語 (KO)</label>
                      <textarea
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                        rows={6}
                        defaultValue={listing.titleKo}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm">
                      <Languages className="h-4 w-4" />
                      DeepLで翻訳
                    </Button>
                    <Badge variant="muted">翻訳メモリ候補: 2件</Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="price">
              <PriceCalculator
                cost={pricing.costJpy}
                marginRate={pricing.marginRate}
                intlShipping={pricing.intlShipping}
                duty={pricing.duty}
                vat={pricing.vat}
                profit={pricing.profit}
                totalJpy={pricing.jpyTotal}
                finalKrw={pricing.krwFinal}
                fxRate={pricing.fxRate}
              />
            </TabsContent>

            <TabsContent value="coupang">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">出品ステータス:</span>
                    <ListingStatusBadge status={listing.channel.status} />
                    {listing.channel.externalId && (
                      <code className="text-xs text-muted-foreground">
                        {listing.channel.externalId}
                      </code>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="카테고리 ID" defaultValue="78901234" />
                    <Field label="필수 속성" defaultValue="원산지, 제조사, 사이즈" />
                    <Field label="Vendor SKU" defaultValue={`OPT-${listing.id}`} />
                    <Field label="원산지" defaultValue="일본" />
                    <Field label="제조사" defaultValue={listing.brand} />
                    <Field label="A/S 정보" defaultValue="구매 후 7일 내 교환 가능" />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Button size="sm">Coupangへ再送信</Button>
                    <Button size="sm" variant="outline">
                      ドライラン
                    </Button>
                  </div>
                  {listing.channel.status === 'rejected' && (
                    <div className="flex items-start gap-2 rounded-md bg-destructive/10 text-destructive text-xs p-3">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">却下理由</div>
                        <div>カテゴリ未マッピング (가전 &gt; 주방가전)</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Coins className="h-4 w-4 text-primary" />
                価格シミュレーター
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1.5">
              <Row k="仕入価格" v={formatJPY(pricing.costJpy)} />
              <Row k="国際送料" v={formatJPY(pricing.intlShipping)} />
              <Row k="関税" v={formatJPY(pricing.duty)} />
              <Row k="VAT" v={formatJPY(pricing.vat)} />
              <Row k={`利益 (${formatPercent(pricing.marginRate)})`} v={formatJPY(pricing.profit)} />
              <hr className="my-2" />
              <Row k="販売価格 (JPY)" v={formatJPY(pricing.jpyTotal)} bold />
              <Row
                k={`販売価格 (KRW @${pricing.fxRate})`}
                v={formatKRW(pricing.krwFinal)}
                bold
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">保護フラグ</CardTitle>
            </CardHeader>
            <CardContent className="text-sm flex items-center gap-2">
              <Lock className="h-4 w-4 text-warning" />
              {listing.isProtected ? (
                <span>削除防止 — 一括削除から除外されます</span>
              ) : (
                <span className="text-muted-foreground">未設定</span>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, defaultValue }: { label: string; defaultValue: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input className="mt-1" defaultValue={defaultValue} />
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className={bold ? 'font-semibold tabular-nums' : 'tabular-nums'}>
        {v}
      </span>
    </div>
  );
}

function PriceCalculator(p: {
  cost: number;
  marginRate: number;
  intlShipping: number;
  duty: number;
  vat: number;
  profit: number;
  totalJpy: number;
  finalKrw: number;
  fxRate: number;
}) {
  return (
    <Card>
      <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <Field label="仕入価格 (JPY)" defaultValue={String(p.cost)} />
          <Field label="国際送料 (JPY)" defaultValue={String(p.intlShipping)} />
          <Field label="関税率 (%)" defaultValue="5" />
          <Field label="VAT率 (%)" defaultValue="10" />
          <Field label="利益率 (%)" defaultValue={String(p.marginRate)} />
          <Field label="為替 (JPY→KRW)" defaultValue={String(p.fxRate ?? fxRate.rate)} />
        </div>
        <div className="rounded-lg border bg-muted/30 p-4 space-y-1.5 text-sm self-start">
          <Row k="仕入価格" v={formatJPY(p.cost)} />
          <Row k="国際送料" v={formatJPY(p.intlShipping)} />
          <Row k="関税" v={formatJPY(p.duty)} />
          <Row k="VAT" v={formatJPY(p.vat)} />
          <Row k="利益" v={formatJPY(p.profit)} />
          <hr className="my-2" />
          <Row k="JPY 合計" v={formatJPY(p.totalJpy)} bold />
          <Row k="KRW 換算" v={formatKRW(p.finalKrw)} bold />
          <div className="flex items-center gap-2 text-xs text-success mt-3">
            <CheckCircle2 className="h-3.5 w-3.5" />
            下限価格ガード OK
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
