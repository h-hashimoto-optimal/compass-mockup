// メール送信（Resend）。RESEND_API_KEY / RESEND_FROM が無ければ送らない（skip）。
// STG/PROD では Secrets Manager 経由で env に入る想定。
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return { sent: false, reason: 'no_key' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) return { sent: false, reason: `resend_${res.status}` };
  return { sent: true };
}
