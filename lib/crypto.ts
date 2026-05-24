// テナント連携シークレットの暗号化（AES-256-GCM）。鍵は env(SECRETS_MASTER_KEY, base64 32byte)。
// DBには暗号文のみ保存。鍵が漏れると全テナントの連携鍵が漏れる→env管理＋ローテーション運用（docs/OPERATIONS.md）。
import crypto from 'node:crypto';

const ALG = 'aes-256-gcm';

function masterKey(): Buffer {
  const k = process.env.SECRETS_MASTER_KEY;
  if (!k) throw new Error('SECRETS_MASTER_KEY 未設定（npm run set-secrets-key で生成）');
  const buf = Buffer.from(k, 'base64');
  if (buf.length !== 32) throw new Error('SECRETS_MASTER_KEY は base64 で 32byte 必須');
  return buf;
}

export function hasMasterKey(): boolean {
  try {
    masterKey();
    return true;
  } catch {
    return false;
  }
}

// 任意のJSONを暗号化 → base64(iv|tag|ciphertext)
export function encryptJSON(obj: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, masterKey(), iv);
  const pt = Buffer.from(JSON.stringify(obj), 'utf8');
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decryptJSON<T = unknown>(s: string): T {
  const raw = Buffer.from(s, 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALG, masterKey(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(pt.toString('utf8')) as T;
}
