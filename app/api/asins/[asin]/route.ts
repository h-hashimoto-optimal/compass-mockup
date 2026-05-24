import { NextResponse } from 'next/server';

// 【廃止】グローバル共有の受信トレイ単件削除（asin-store依存）。
// テナント分離のため /api/listings/[id]（DELETE=soft-delete）に移行。
export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
export function DELETE() {
  return NextResponse.json(
    {
      error: 'deprecated',
      message: 'この削除エンドポイントは廃止されました。/api/listings/[id]（DELETE）を使用してください。',
    },
    { status: 410, headers: CORS },
  );
}
