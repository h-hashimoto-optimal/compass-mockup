import { NextResponse } from 'next/server';
import { runAsinPipeline } from '@/lib/pipeline';
import { readAll } from '@/lib/asin-store';

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

  // 受信トレイから hint を引く（あれば SP-API モックの精度が上がる）
  const captured = readAll().find((c) => c.asin === asin);
  const hint = captured
    ? {
        title: captured.title,
        brand: captured.brand,
        priceJpy: captured.priceJpy,
        imageUrl: captured.imageUrl,
      }
    : undefined;

  const result = await runAsinPipeline(asin, hint);

  // signedRequest の Authorization ヘッダはマスクしてレスポンスに含める
  const safeHeaders = { ...result.signedRequest.headers };
  if (safeHeaders.Authorization) {
    safeHeaders.Authorization = safeHeaders.Authorization.replace(
      /access-key=[^,]+/,
      'access-key=***MASKED***',
    ).replace(/signature=[a-f0-9]+/, 'signature=***MASKED***');
  }

  return NextResponse.json({
    asin: result.asin,
    steps: result.steps,
    payload: result.payload,
    signedRequest: {
      url: result.signedRequest.url,
      method: result.signedRequest.method,
      headers: safeHeaders,
      bodyBytes: result.signedRequest.body?.length ?? 0,
      debug: {
        signedDate: result.signedRequest.debug.signedDate,
        message: result.signedRequest.debug.message,
        // signature本体は伏せる
      },
    },
  });
}
