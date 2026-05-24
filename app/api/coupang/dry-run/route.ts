import { NextResponse } from 'next/server';

// 【廃止】グローバル共有の dry-run（asin-store依存）。
// テナント分離のため /api/listings/[id]/dry-run（Cookie認証・自店舗スコープ）に移行。
export const dynamic = 'force-dynamic';

export function POST() {
  return NextResponse.json(
    {
      error: 'deprecated',
      message: 'この dry-run は廃止されました。テナント別の /api/listings/[id]/dry-run を使用してください。',
    },
    { status: 410 },
  );
}
