import nodemailer from 'nodemailer';

// Gmail（アプリパスワード）でメールを送る。
// 環境変数 GMAIL_USER / GMAIL_APP_PASSWORD が未設定なら送らずに false を返す。
// 送信に失敗しても例外は投げない（クーポン申請そのものは成功させるため）。
export async function sendMail(params: {
  to: string | string[];
  subject: string;
  text: string;
  bcc?: string[];
}): Promise<boolean> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const to = Array.isArray(params.to) ? params.to.filter(Boolean) : params.to;

  if (!user || !pass) {
    console.warn('[mailer] GMAIL_USER / GMAIL_APP_PASSWORD が未設定のため送信をスキップしました');
    return false;
  }
  if (!to || (Array.isArray(to) && to.length === 0)) {
    console.warn('[mailer] 宛先が空のため送信をスキップしました');
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: `"外山企画 スポンサー事務局" <${user}>`,
      to,
      bcc: params.bcc && params.bcc.length > 0 ? params.bcc : undefined,
      subject: params.subject,
      text: params.text,
    });
    return true;
  } catch (err) {
    console.error('[mailer] 送信に失敗しました:', err);
    return false;
  }
}

// 管理者（外山企画）の通知先。ADMIN_EMAILS（カンマ区切り）を使う
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// 統合管理画面のクーポンタブ
export const ADMIN_CONSOLE_URL =
  process.env.COUPON_ADMIN_URL || 'https://toyama-sponsor-hub.vercel.app/admin/coupons';
