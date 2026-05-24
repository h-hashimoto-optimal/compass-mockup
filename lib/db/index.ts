// Postgres接続（pg Pool）＋Drizzle。
// 実行時は APP_DATABASE_URL（最小権限ロール=RLS対象）を優先。無ければ DATABASE_URL（owner=RLS bypass）にフォールバック。
// 遅延初期化：実際にDBを使うまで接続しない。Next.js dev の HMR で再生成されないよう接続を使い回す。
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from './schema';

const g = globalThis as unknown as {
  __compassPool?: Pool;
  __compassDb?: NodePgDatabase<typeof schema>;
};

function getDb(): NodePgDatabase<typeof schema> {
  if (!g.__compassDb) {
    const url = process.env.APP_DATABASE_URL || process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        'DATABASE_URL（または APP_DATABASE_URL）が未設定です。compass-mockup/.env.local に設定してください。',
      );
    }
    g.__compassPool ??= new Pool({
      connectionString: url,
      // Neon等のマネージドはSSL必須。localhost以外はSSL有効化。
      ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 10,
    });
    g.__compassDb = drizzle(g.__compassPool, { schema });
  }
  return g.__compassDb;
}

// 遅延プロキシ：db.xxx に触れた瞬間に初期化される
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_t, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const v = real[prop];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});

// RLS用：トランザクション内で app.current_tenant をセットし、テナント・スコープでクエリ実行する。
// RLSポリシーが効くテーブル（channel_listings/orders/tenant_integrations）へのアクセスは必ずこれを通す。
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: NodePgDatabase<typeof schema>) => Promise<T>,
): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_tenant', ${tenantId}, true)`);
    return fn(tx as unknown as NodePgDatabase<typeof schema>);
  });
}

export { schema };
