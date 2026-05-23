import { NextResponse } from 'next/server';
import {
  getMonitorConfig,
  setMonitorConfig,
  type MonitorConfig,
} from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(getMonitorConfig());
}

export async function POST(req: Request) {
  let body: Partial<MonitorConfig> = {};
  try {
    body = (await req.json()) as Partial<MonitorConfig>;
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const patch: Partial<MonitorConfig> = {};
  if (typeof body.minMarginRate === 'number' && Number.isFinite(body.minMarginRate))
    patch.minMarginRate = body.minMarginRate;
  if (typeof body.floorGuardEnabled === 'boolean')
    patch.floorGuardEnabled = body.floorGuardEnabled;
  if (body.channels && typeof body.channels === 'object') {
    const c = body.channels as Partial<MonitorConfig['channels']>;
    patch.channels = {
      ...getMonitorConfig().channels,
      ...(typeof c.line === 'boolean' ? { line: c.line } : {}),
      ...(typeof c.chatwork === 'boolean' ? { chatwork: c.chatwork } : {}),
      ...(typeof c.email === 'boolean' ? { email: c.email } : {}),
    };
  }

  return NextResponse.json(setMonitorConfig(patch));
}
