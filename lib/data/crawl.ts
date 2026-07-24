// crawl_source ジョブ本体：due な仕入元(source_products)の価格/在庫を最新化する。
// source_products は全社共通（重複排除）なので tenant_id なし＝db直（RLS対象外の参照層）。
// 取得は Keepa 主（プラットフォーム鍵）。変化時のみ price_events を積む。tier で次回チェック日を決める。
import { eq, isNull, lte, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sourceProducts, priceEvents } from '@/lib/db/schema';
import { fetchKeepaLatest } from '@/lib/channels/amazon/keepa';

const TIER_DAYS: Record<string, number> = { hot: 1, warm: 3, cold: 7 };

export async function crawlSourceBatch(
  limit: number,
): Promise<{ crawled: number; changed: number; skipped: number }> {
  const due = await db
    .select()
    .from(sourceProducts)
    .where(or(isNull(sourceProducts.nextCheckAt), lte(sourceProducts.nextCheckAt, new Date())))
    .orderBy(sourceProducts.nextCheckAt)
    .limit(limit);

  let crawled = 0;
  let changed = 0;
  let skipped = 0;

  for (const sp of due) {
    const days = TIER_DAYS[sp.tier ?? 'warm'] ?? 3;
    const nextCheckAt = new Date(Date.now() + days * 86_400_000);

    // 仕入元がamazon以外は現状スキップ（アダプタ追加で拡張）
    const latest = sp.source === 'amazon' ? await fetchKeepaLatest(sp.sourceProductId).catch(() => null) : null;

    if (!latest) {
      // 取得不可（Keepa鍵なし/非対応source）→ 次回チェック日だけ更新
      await db
        .update(sourceProducts)
        .set({ lastCheckedAt: new Date(), nextCheckAt })
        .where(eq(sourceProducts.id, sp.id));
      skipped++;
      continue;
    }

    const priceChanged = latest.priceJpy != null && latest.priceJpy !== sp.lastPriceJpy;
    const stockChanged = latest.inStock != null && latest.inStock !== sp.lastInStock;

    await db
      .update(sourceProducts)
      .set({
        lastPriceJpy: latest.priceJpy ?? sp.lastPriceJpy,
        lastInStock: latest.inStock ?? sp.lastInStock,
        lastCheckedAt: new Date(),
        nextCheckAt,
      })
      .where(eq(sourceProducts.id, sp.id));

    if (priceChanged || stockChanged) {
      await db.insert(priceEvents).values({
        sourceProductId: sp.id,
        sourcePriceJpy: latest.priceJpy ?? null,
        sourceInStock: latest.inStock ?? null,
      });
      changed++;
    }
    crawled++;
  }

  return { crawled, changed, skipped };
}
