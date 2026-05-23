// Neon接続の切り分け（パスワードは出さない）。どの設定でテーブル一覧が取れるか試す。
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

function loadEnvLocal() {
  const p = path.join(process.cwd(), '.env.local');
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadEnvLocal();
const url = process.env.DATABASE_URL;
const noCB = url.replace(/([?&])channel_binding=require&?/, (_, p1) => (p1 === '?' ? '?' : '&')).replace(/[?&]$/, '');

async function tryConn(label, cfg) {
  const pool = new Pool(cfg);
  try {
    const r = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name",
    );
    console.log(`✓ [${label}] OK  tables: [${r.rows.map((x) => x.table_name).join(', ')}]`);
  } catch (e) {
    console.log(`✗ [${label}] ${e.message}`);
  } finally {
    await pool.end().catch(() => {});
  }
}

await tryConn('A: URLそのまま / ssl未指定', { connectionString: url });
await tryConn('B: URLそのまま / rejectUnauthorized:false', {
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});
await tryConn('C: channel_binding除去 / rejectUnauthorized:false', {
  connectionString: noCB,
  ssl: { rejectUnauthorized: false },
});
