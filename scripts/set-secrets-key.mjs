// SECRETS_MASTER_KEY（連携シークレット暗号化用 AES-256 鍵）を .env.local に生成（既存なら維持。値は非表示）。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const p = path.join(process.cwd(), '.env.local');
let s = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';

if (/^SECRETS_MASTER_KEY=.+$/m.test(s)) {
  console.log('= SECRETS_MASTER_KEY は既に設定済み（維持）。回転する場合は手動削除→再実行＋既存暗号文の再暗号化が必要。');
  process.exit(0);
}
const v = crypto.randomBytes(32).toString('base64'); // 32byte = AES-256
if (s && !s.endsWith('\n')) s += '\n';
s += 'SECRETS_MASTER_KEY=' + v + '\n';
fs.writeFileSync(p, s);
console.log('✓ SECRETS_MASTER_KEY を新規生成して設定しました（base64 32byte／値は非表示）');
