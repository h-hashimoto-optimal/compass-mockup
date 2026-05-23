// 本部(owner)アカウントを初期投入する。冪等：既に存在すればスキップ。
// 使い方: node scripts/seed.mjs   （.env.local の DATABASE_URL / OWNER_* を読む）
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

function loadEnvLocal() {
  const p = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
loadEnvLocal();

const url = process.env.DATABASE_URL;
const email = (process.env.OWNER_EMAIL || 'hirohohashimoto@gmail.com').trim().toLowerCase();
const name = process.env.OWNER_NAME || '橋本';
const password = process.env.OWNER_INITIAL_PASSWORD;

if (!url) {
  console.error('✗ DATABASE_URL が未設定です（.env.local）。');
  process.exit(1);
}
if (!password) {
  console.error('✗ OWNER_INITIAL_PASSWORD が未設定です（.env.local）。本部の初期パスワードを入れてください。');
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
});

try {
  const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (exists.rowCount > 0) {
    console.log(`= 既に存在: ${email}（スキップ）`);
  } else {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, status)
       VALUES ($1, $2, $3, 'owner', 'active')`,
      [email, hash, name],
    );
    console.log(`✓ 本部アカウント作成: ${email} / ${name}`);
  }
} catch (e) {
  console.error('✗ seed失敗:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
