import { NextResponse } from 'next/server';

// 【廃止】グローバル共有の受信トレイ削除（asin-store/blacklist-store依存）。
// テナント分離のため /api/listings/[id]（DELETE=soft-delete）と /api/tenant/blacklist に移行。
export const dynamic = 'force-dynamic';

export function POST() {
  return NextResponse.json(
    {
      error: 'deprecated',
      message: 'この削除エンドポイントは廃止されました。/api/listings/[id]（DELETE）と /api/tenant/blacklist を使用してください。',
    },
    { status: 410 },
  );
}
