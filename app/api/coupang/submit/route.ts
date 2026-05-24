import { NextResponse } from 'next/server';

// 【廃止】グローバル共有の送信エンドポイント（asin-store/submit-logは全テナント混在）。
// テナント分離のため /api/listings/[id]/submit（Cookie認証・自店舗スコープ）に移行。
export const dynamic = 'force-dynamic';

const GONE = {
  error: 'deprecated',
  message: 'この送信エンドポイントは廃止されました。テナント別の /api/listings/[id]/submit を使用してください。',
};

export function GET() {
  return NextResponse.json({ count: 0, items: [], deprecated: true });
}
export function POST() {
  return NextResponse.json(GONE, { status: 410 });
}
