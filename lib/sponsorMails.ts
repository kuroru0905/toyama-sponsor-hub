import { sendMail, adminEmails } from '@/lib/mailer';

// スポンサー申込・有効化のお知らせメール（申込者と外山企画の両方へ）

const TIER_LABELS: Record<string, string> = {
  corporate: '企業プレミアム枠（月額 ¥10,000）',
  store: '店舗ローカル枠（月額 ¥3,000）',
  fan: 'ファンサポーター枠（月額 ¥300）',
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://toyama-sponsor-hub.vercel.app';

export type SponsorForMail = {
  id: string;
  tier: string;
  applicant_name: string;
  display_name: string;
  email: string;
  payment_method: string | null;
};

const tierLabel = (tier: string) => TIER_LABELS[tier] ?? tier;
const methodLabel = (m: string | null) => (m === 'invoice' ? '請求書払い' : 'クレジットカード');

// 請求書払いの申込を受け付けたとき
export async function sendInvoiceAppliedMails(s: SponsorForMail, invoiceUrl: string | null) {
  await Promise.all([
    sendMail({
      to: s.email,
      subject: '【外山企画】スポンサーお申し込みを受け付けました（請求書払い）',
      text: [
        `${s.applicant_name} 様`,
        '',
        '外山企画のスポンサーにお申し込みいただき、ありがとうございます。',
        '以下の内容でお申し込みを受け付けました。',
        '',
        `プラン：${tierLabel(s.tier)}`,
        `掲載名：${s.display_name}`,
        'お支払い方法：請求書払い（発行日より14日以内）',
        '',
        '請求書は Stripe から別のメールでお送りしています。',
        invoiceUrl ? `請求書のお支払いページ：${invoiceUrl}` : '',
        '',
        'お支払いの確認後に、スポンサー特典とサイトへの掲載が有効になります。有効になりましたら改めてメールでお知らせします。',
        '',
        `マイページ：${SITE_URL}/mypage（このメールアドレスでログインできます）`,
        '',
        '外山企画',
      ]
        .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
        .join('\n'),
    }),
    sendMail({
      to: adminEmails(),
      subject: `【スポンサー申込】${s.display_name}（${tierLabel(s.tier)}・請求書払い）`,
      text: [
        '請求書払いのスポンサー申込がありました。入金確認後に自動で有効になります。',
        '',
        `プラン：${tierLabel(s.tier)}`,
        `申込者：${s.applicant_name}`,
        `掲載名：${s.display_name}`,
        `メール：${s.email}`,
        invoiceUrl ? `請求書：${invoiceUrl}` : '',
        '',
        `管理画面：${SITE_URL}/admin/sponsors`,
      ].join('\n'),
    }),
  ]);
}

// 契約が有効になったとき（カード決済の完了、または請求書の入金確認）
export async function sendActivatedMails(s: SponsorForMail) {
  const isCorporate = s.tier === 'corporate';
  const canCoupon = s.tier === 'corporate' || s.tier === 'store';
  await Promise.all([
    sendMail({
      to: s.email,
      subject: '【外山企画】スポンサー契約が有効になりました',
      text: [
        `${s.applicant_name} 様`,
        '',
        `${methodLabel(s.payment_method)}でのお支払いを確認し、スポンサー契約が有効になりました。`,
        '登別の地域とライブシーンを支えていただき、心より感謝申し上げます。',
        '',
        `プラン：${tierLabel(s.tier)}`,
        `掲載名：${s.display_name}`,
        '',
        `マイページ（${SITE_URL}/mypage）では次のことができます。`,
        '・LINEと連携する（スポンサー先行販売でチケットを購入するために必要です）',
        '・出演応募（募集中のイベントがあるとき）',
        canCoupon ? '・ライブ入場者向けLINEクーポンの掲載申請' : '',
        isCorporate ? '\n企業PR動画の制作については、外山企画からこのメールアドレス宛にヒアリングのご連絡を差し上げます。' : '',
        '',
        '外山企画',
      ]
        .filter(Boolean)
        .join('\n'),
    }),
    sendMail({
      to: adminEmails(),
      subject: `【スポンサー有効化】${s.display_name}（${tierLabel(s.tier)}・${methodLabel(s.payment_method)}）`,
      text: [
        `${methodLabel(s.payment_method)}の支払いを確認し、スポンサー契約が有効になりました。`,
        '',
        `プラン：${tierLabel(s.tier)}`,
        `申込者：${s.applicant_name}`,
        `掲載名：${s.display_name}`,
        `メール：${s.email}`,
        isCorporate ? '\n※ 企業PR動画のヒアリング連絡をお願いします。' : '',
        '',
        `管理画面：${SITE_URL}/admin/sponsors`,
      ]
        .filter(Boolean)
        .join('\n'),
    }),
  ]);
}
