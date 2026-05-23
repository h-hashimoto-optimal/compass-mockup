import { NextResponse } from 'next/server';
import {
  getMarginConfig,
  setMarginConfig,
  type MarginConfig,
} from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(getMarginConfig());
}

export async function POST(req: Request) {
  let body: Partial<MarginConfig> = {};
  try {
    body = (await req.json()) as Partial<MarginConfig>;
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const patch: Partial<MarginConfig> = {};
  const num = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) ? v : undefined;

  if (num(body.defaultRate) !== undefined) patch.defaultRate = body.defaultRate;
  if (num(body.fxBase) !== undefined) patch.fxBase = body.fxBase;
  if (num(body.fxBuffer) !== undefined) patch.fxBuffer = body.fxBuffer;
  if (num(body.intlShipping) !== undefined)
    patch.intlShipping = body.intlShipping;
  if (typeof body.fxSource === 'string') patch.fxSource = body.fxSource;
  if (
    body.rounding === 'ceil' ||
    body.rounding === 'floor' ||
    body.rounding === 'round_up_100_krw' ||
    body.rounding === 'round_up_1000_krw'
  )
    patch.rounding = body.rounding;
  if (Array.isArray(body.categoryOverrides)) {
    patch.categoryOverrides = body.categoryOverrides
      .filter(
        (c) =>
          c &&
          typeof c.category === 'string' &&
          c.category.trim() !== '' &&
          typeof c.rate === 'number',
      )
      .map((c) => ({ category: c.category.trim(), rate: c.rate }));
  }

  const next = setMarginConfig(patch);
  return NextResponse.json(next);
}
