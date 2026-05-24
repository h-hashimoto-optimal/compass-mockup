// 重要テーブルに Row-Level Security を適用（多層防御の先行導入）。owner(DATABASE_URL)で実行・冪等。
// owner はRLSをbypass（migration/seed/テストは無影響）。アプリは compass_app(非owner)で接続し対象になる。
// ポリシー：行の tenant_id が セッションGUC app.current_tenant と一致するもののみ可視/書込可。
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

function loadEnv() { for (const l of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]; } }
loadEnv();

const TABLES = ['tenant_integrations', 'channel_listings', 'orders'];
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

for (const t of TABLES) {
  await pool.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
  await pool.query(`DROP POLICY IF EXISTS tenant_isolation ON ${t}`);
  // NULLIF で空文字('')→NULL に正規化（GUC未設定時のキャストエラーを防ぐ＝未設定は0件で安全に遮断）
  await pool.query(
    `CREATE POLICY tenant_isolation ON ${t}
       USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
       WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)`,
  );
  console.log(`✓ RLS有効化＋tenant_isolationポリシー: ${t}`);
}
await pool.end();
console.log('done');
