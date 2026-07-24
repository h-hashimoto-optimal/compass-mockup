// サーバ起動時に一度だけ走る Next 標準フック（instrumentation）。
// STG/PROD では AWS Secrets Manager から機密を取得して process.env に流し込み、
// 以降 lib/crypto.ts 等は「起動時に埋まった env」を同期で読むだけにする（暗号化コードの非同期化を回避）。
// local は .env.local を使うので COMPASS_SECRETS_ID 未設定＝SMをスキップし、従来どおり動く。
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const secretId = process.env.COMPASS_SECRETS_ID;
  if (!secretId) return; // local: env をそのまま使う（AWS不要）

  const { SecretsManagerClient, GetSecretValueCommand } = await import(
    '@aws-sdk/client-secrets-manager'
  );
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION });
  const res = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  if (!res.SecretString) throw new Error('Secrets Manager: SecretString が空です');

  const secrets = JSON.parse(res.SecretString) as Record<string, unknown>;
  // デプロイ環境では Secrets Manager を正とする（env に実値を置かない前提）。
  for (const [key, value] of Object.entries(secrets)) {
    if (typeof value === 'string') process.env[key] = value;
  }
}
