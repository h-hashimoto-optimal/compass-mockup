// 本部共有マスタを投入（ip_brands: tenant_id=NULL=全社共有）。冪等。
// 使い方: node scripts/seed-master.mjs   （.env.local の DATABASE_URL 先＝dev/prod）
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

function loadEnv() {
  for (const l of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadEnv();

// lib/constants.ts の STARTER_IP_BRANDS と同内容（マスタなのでここに保持）
const IP_BRANDS = [
  ['Nike', 'warn'], ['adidas', 'warn'], ['Louis Vuitton', 'warn'], ['CHANEL', 'warn'],
  ['GUCCI', 'warn'], ['HERMES', 'warn'], ['ROLEX', 'warn'], ['Supreme', 'warn'],
  ['Disney', 'warn'], ['SANRIO', 'warn'], ['Pokemon', 'warn'], ['Apple', 'warn'],
];

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
try {
  const existing = await pool.query('SELECT brand FROM ip_brands WHERE tenant_id IS NULL');
  const have = new Set(existing.rows.map((r) => r.brand.toLowerCase()));
  let added = 0;
  for (const [brand, level] of IP_BRANDS) {
    if (have.has(brand.toLowerCase())) continue;
    await pool.query('INSERT INTO ip_brands (tenant_id, brand, level) VALUES (NULL, $1, $2)', [brand, level]);
    added++;
  }
  const total = await pool.query('SELECT count(*)::int n FROM ip_brands WHERE tenant_id IS NULL');
  console.log(`✓ 本部共有 ip_brands: +${added} 追加 / 合計 ${total.rows[0].n} 件`);
} catch (e) {
  console.error('✗ master seed失敗:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
