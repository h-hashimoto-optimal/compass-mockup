import { NextResponse } from 'next/server';

// 【廃止】グローバル共有の受信エンドポイント。テナント分離のため /api/ingest（X-Compass-Token）に移行。
export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Compass-Token',
};
const GONE = {
  error: 'deprecated',
  message: 'この受信エンドポイントは廃止されました。テナント別の /api/ingest（X-Compass-Token ヘッダ）を使用してください。',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
export function GET() {
  // 旧グローバル一覧は提供しない（テナント分離）。空で返す。
  return NextResponse.json({ count: 0, items: [], deprecated: true }, { headers: CORS });
}
export function POST() {
  return NextResponse.json(GONE, { status: 410, headers: CORS });
}
export function DELETE() {
  return NextResponse.json(GONE, { status: 410, headers: CORS });
}
