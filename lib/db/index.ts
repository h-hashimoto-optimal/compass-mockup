// Postgres接続（pg Pool）＋Drizzle。DATABASE_URL から接続。
// 遅延初期化：実際にDBを使うまで接続しない（未設定でもimport時に落ちない）。
// Next.js dev の HMR で再生成されないよう接続を使い回す。
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const g = globalThis as unknown as {
  __compassPool?: Pool;
  __compassDb?: NodePgDatabase<typeof schema>;
};

function getDb(): NodePgDatabase<typeof schema> {
  if (!g.__compassDb) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        'DATABASE_URL が未設定です。compass-mockup/.env.local に Neon の接続文字列を設定してください。',
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

export { schema };
