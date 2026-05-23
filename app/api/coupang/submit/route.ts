import { NextResponse } from 'next/server';
import { submitToCoupang } from '@/lib/pipeline';
import { readAll } from '@/lib/asin-store';
import { appendSubmitLog, getSubmitLog } from '@/lib/submit-log';

export function GET() {
  const items = getSubmitLog();
  return NextResponse.json({ count: items.length, items });
}

export async function POST(req: Request) {
  let body: { asin?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* allow empty */
  }
  const asin = body.asin;
  if (!asin || asin.length !== 10) {
    return NextResponse.json(
      { error: 'asin (10 chars) is required' },
      { status: 400 },
    );
  }

  const captured = readAll().find((c) => c.asin === asin);
  const hint = captured
    ? {
        title: captured.title,
        brand: captured.brand,
        priceJpy: captured.priceJpy,
        imageUrl: captured.imageUrl,
      }
    : undefined;

  try {
    const out = await submitToCoupang(asin, hint);
    appendSubmitLog({
      asin,
      mode: out.mode,
      ok: out.submission ? out.submission.ok : out.mode === 'dry-run',
      status: out.submission ? out.submission.status : null,
      titleKo: out.pipeline.steps.translation.title.ko,
      priceKrw: out.pipeline.steps.pricing.krwFinal,
      reason: out.reason,
    });
    return NextResponse.json({
      mode: out.mode,
      reason: out.reason,
      submission: out.submission,
      summary: {
        titleJa: out.pipeline.steps.spApi.title,
        titleKo: out.pipeline.steps.translation.title.ko,
        category: out.pipeline.steps.category.displayCategoryName,
        priceKrw: out.pipeline.steps.pricing.krwFinal,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
