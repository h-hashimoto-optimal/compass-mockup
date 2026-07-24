import { NextResponse } from 'next/server';
import { currentTenantId } from '@/lib/tenant';
import {
  INTEGRATION_KINDS,
  getIntegrationStatus,
  saveIntegration,
  disconnectIntegration,
} from '@/lib/data/integrations';
import { hasMasterKey } from '@/lib/crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function checkKind(kind: string) {
  return (INTEGRATION_KINDS as readonly string[]).includes(kind);
}

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const t = await currentTenantId();
  if (!t) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  if (!checkKind((await params).kind)) return NextResponse.json({ error: '未知の連携種別' }, { status: 400 });
  return NextResponse.json({ ...(await getIntegrationStatus(t, (await params).kind)), masterKey: hasMasterKey() });
}

export async function PUT(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const t = await currentTenantId();
  if (!t) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  if (!checkKind((await params).kind)) return NextResponse.json({ error: '未知の連携種別' }, { status: 400 });
  if (!hasMasterKey()) return NextResponse.json({ error: 'サーバの暗号化鍵が未設定です（管理者に連絡）' }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const secrets: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) if (typeof v === 'string') secrets[k] = v;
  return NextResponse.json(await saveIntegration(t, (await params).kind, secrets));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const t = await currentTenantId();
  if (!t) return NextResponse.json({ error: 'テナント文脈がありません' }, { status: 403 });
  if (!checkKind((await params).kind)) return NextResponse.json({ error: '未知の連携種別' }, { status: 400 });
  return NextResponse.json({ ok: await disconnectIntegration(t, (await params).kind) });
}
