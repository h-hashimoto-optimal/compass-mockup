// SESSION_SECRET を .env.local に必ず新規生成して設定する（値はコンソールに出さない）。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const p = path.join(process.cwd(), '.env.local');
let s = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
const v = crypto.randomBytes(32).toString('hex'); // 64文字hex

if (/^SESSION_SECRET=.*$/m.test(s)) {
  s = s.replace(/^SESSION_SECRET=.*$/m, 'SESSION_SECRET=' + v);
} else {
  if (s && !s.endsWith('\n')) s += '\n';
  s += 'SESSION_SECRET=' + v + '\n';
}
fs.writeFileSync(p, s);
console.log('✓ SESSION_SECRET を新規生成して設定しました（64文字hex／値は非表示）');
