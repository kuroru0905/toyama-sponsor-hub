// 出演応募の共通定義

export const ACT_TYPES: Record<string, string> = {
  band: 'バンド',
  dj: 'DJ',
  performance: 'パフォーマンス（ダンス・弾き語りなど）',
  other: 'その他',
};

// 募集する出演形態（お知らせ・応募欄の表示用）。「パフォーマンス（ダンス…）」は短く
export const ACT_TYPE_SHORT: Record<string, string> = {
  band: 'バンド',
  dj: 'DJ',
  performance: 'パフォーマンス（ダンス・弾き語りなど）',
  other: 'その他',
};

export function actTypesLabel(types: string[] | null | undefined): string {
  const list = (types && types.length > 0 ? types : Object.keys(ACT_TYPE_SHORT)).filter((t) => ACT_TYPE_SHORT[t]);
  return list.map((t) => ACT_TYPE_SHORT[t]).join('／');
}

export const APPLICATION_STATUS: Record<string, string> = {
  submitted: '受付済み',
  reviewing: '選考中',
  accepted: '採用',
  declined: '見送り',
};

export const SPONSOR_MYPAGE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/mypage` : 'https://toyama-sponsor-hub.vercel.app/mypage';

// 公開の出演応募ページ（誰でも応募できる）
export const PERFORM_URL =
  process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/perform` : 'https://toyama-sponsor-hub.vercel.app/perform';

// 統合管理画面の出演応募タブ
export const SPONSOR_ADMIN_URL =
  process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/admin/applications` : 'https://toyama-sponsor-hub.vercel.app/admin/applications';

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
