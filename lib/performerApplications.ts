// 出演応募の共通定義

export const ACT_TYPES: Record<string, string> = {
  band: 'バンド',
  dj: 'DJ',
  performance: 'パフォーマンス（ダンス・弾き語りなど）',
  other: 'その他',
};

export const APPLICATION_STATUS: Record<string, string> = {
  submitted: '受付済み',
  reviewing: '選考中',
  accepted: '採用',
  declined: '見送り',
};

// 応募ページ・メールに必ず載せる注意書き
export const GROUP_RULE =
  'グループで応募する場合は、出演メンバー全員（未成年のメンバーはその保護者）が外山企画のスポンサー（どの枠でも可）としてご契約中である必要があります。';

export const SPONSOR_MYPAGE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/mypage` : 'https://toyama-sponsor-hub.vercel.app/mypage';

export const SPONSOR_ADMIN_URL =
  process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/admin` : 'https://toyama-sponsor-hub.vercel.app/admin';

export type ApplicationSummary = {
  act_type: string;
  act_name: string;
  representative_name: string;
  member_count: number;
  member_names: string;
  genre: string;
  links: string;
  message: string;
  event_title: string | null;
};

// メール本文用の応募内容
export function applicationLines(a: ApplicationSummary): string[] {
  return [
    `出演形態：${ACT_TYPES[a.act_type] ?? a.act_type}`,
    `出演名義：${a.act_name}`,
    `代表者：${a.representative_name}`,
    `人数：${a.member_count}人`,
    ...(a.member_count > 1 ? [`メンバー：${a.member_names || '（未記入）'}`] : []),
    `希望イベント：${a.event_title ?? '指定なし'}`,
    `ジャンル：${a.genre || '（未記入）'}`,
    `音源・動画・SNS：${a.links || '（未記入）'}`,
    '',
    'PR・意気込み：',
    a.message || '（未記入）',
  ];
}
