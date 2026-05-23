import { NextResponse } from 'next/server';
import { removeOne } from '@/lib/asin-store';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { asin: string } },
) {
  const removed = removeOne(params.asin);
  if (!removed) {
    return NextResponse.json(
      { error: 'not found', asin: params.asin },
      { status: 404, headers: CORS_HEADERS },
    );
  }
  return NextResponse.json({ removed }, { headers: CORS_HEADERS });
}
