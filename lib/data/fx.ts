// fetch_fx ジョブ本体：JPY→KRW の為替を取得して fx_rates に upsert（全社共通）。
// 無料・キー不要の open.er-api.com を使用。失敗時は throw（ジョブがリトライ）。
import { db } from '@/lib/db';
import { fxRates } from '@/lib/db/schema';

export async function fetchAndStoreFx(): Promise<{ date: string; jpyToKrw: number | null }> {
  const res = await fetch('https://open.er-api.com/v6/latest/JPY');
  if (!res.ok) throw new Error(`FX fetch ${res.status}`);
  const j = (await res.json()) as { rates?: { KRW?: number } };
  const krw = j.rates?.KRW ?? null;
  const date = new Date().toISOString().slice(0, 10);
  if (krw == null) return { date, jpyToKrw: null };

  await db
    .insert(fxRates)
    .values({ date, jpyToKrw: String(krw) })
    .onConflictDoUpdate({ target: fxRates.date, set: { jpyToKrw: String(krw), fetchedAt: new Date() } });
  return { date, jpyToKrw: krw };
}
