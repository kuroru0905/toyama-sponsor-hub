import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendMail } from '@/lib/mailer';
import { broadcastLine, retryKeyFor } from '@/lib/lineMessaging';
import { actTypesLabel } from '@/lib/performerApplications';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://toyama-sponsor-hub.vercel.app';
const LIFF_URL = process.env.LIFF_URL || 'https://liff.line.me/2012539866-QYeWMdED';
const BCC_CHUNK = 90; // Gmailの1通あたりの宛先上限より十分小さく

type EventRow = {
  id: string;
  title: string;
  venue: string;
  starts_at: string;
  price_jpy: number;
  is_published: boolean;
  recruit_performers: boolean;
  recruit_deadline: string | null;
  recruit_act_types: string[] | null;
  recruit_note: string | null;
  presale_start: string | null;
  general_sale_start: string | null;
  recruit_notified_at: string | null;
  sale_notified_at: string | null;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

// 有効なスポンサー全員のメールアドレス（重複なし）
async function activeSponsorEmails(): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from('sponsors').select('email').eq('status', 'active');
  if (error) throw error;
  const seen: Record<string, true> = {};
  const out: string[] = [];
  (data ?? []).forEach((r) => {
    const e = String(r.email ?? '').trim().toLowerCase();
    if (e && !seen[e]) {
      seen[e] = true;
      out.push(e);
    }
  });
  return out;
}

// BCCで一斉送信（スポンサー同士にアドレスが見えないように）
async function broadcast(emails: string[], subject: string, text: string) {
  const from = process.env.GMAIL_USER || '';
  for (let i = 0; i < emails.length; i += BCC_CHUNK) {
    await sendMail({ to: from, bcc: emails.slice(i, i + BCC_CHUNK), subject, text });
  }
}

// 1イベント1回だけ送るために、先に「送信済み」にできたかを確認する
async function claim(id: string, column: 'recruit_notified_at' | 'sale_notified_at') {
  const { data } = await supabaseAdmin
    .from('live_events')
    .update({ [column]: new Date().toISOString() })
    .eq('id', id)
    .is(column, null)
    .select('id')
    .maybeSingle();
  return Boolean(data);
}

const footer = [
  '',
  '――',
  'まちきっぷ（外山企画）のスポンサー（サポーター）としてご契約中の方にお送りしています。',
  `マイページ：${SITE_URL}/mypage`,
  '外山企画',
].join('\n');

// お知らせ：スポンサーにはメール、LINE公式アカウントの友だち全員にはLINEで一斉配信
// （Supabase の pg_cron から5分おきに呼ばれる）
// ・出演者募集が始まった
// ・チケットが買えるようになった（先行販売があれば先行販売の開始、なければ販売開始）
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const { data, error } = await supabaseAdmin
    .from('live_events')
    .select(
      'id, title, venue, starts_at, price_jpy, is_published, recruit_performers, recruit_deadline, recruit_act_types, recruit_note, presale_start, general_sale_start, recruit_notified_at, sale_notified_at'
    )
    .gt('starts_at', nowIso)
    .is('cancelled_at', null)
    .or('recruit_notified_at.is.null,sale_notified_at.is.null');
  if (error) {
    console.error('[sponsor-notices]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = (data ?? []) as EventRow[];
  const sent: string[] = [];
  let emails: string[] | null = null;
  const recipients = async () => (emails ??= await activeSponsorEmails());

  for (const ev of events) {
    // 出演者募集の開始（公開前でも募集できる）
    if (
      !ev.recruit_notified_at &&
      ev.recruit_performers &&
      ev.recruit_deadline &&
      new Date(ev.recruit_deadline).getTime() > now &&
      (await claim(ev.id, 'recruit_notified_at'))
    ) {
      await broadcast(
        await recipients(),
        `【出演者募集】${ev.title}（${fmt(ev.starts_at)} 開演）`,
        [
          'スポンサーの皆さまへ',
          '',
          `「${ev.title}」の出演者を募集します。`,
          '',
          `イベント名：${ev.title}`,
          `開演：${fmt(ev.starts_at)}`,
          `会場：${ev.venue}`,
          `募集する出演形態：${actTypesLabel(ev.recruit_act_types)}`,
          ev.recruit_note ? `ジャンル・条件：${ev.recruit_note}` : null,
          `応募締切：${fmt(ev.recruit_deadline as string)}`,
          '',
          `応募はマイページの「出演応募」からどうぞ：${SITE_URL}/mypage`,
          '※ グループで応募する場合は、出演メンバー全員（未成年はその保護者）がスポンサーとしてご契約中である必要があります。',
          footer,
        ]
          .filter((l): l is string => l !== null)
          .join('\n')
      );
      await broadcastLine(
        [
          `🎤 出演者募集｜${ev.title}`,
          '',
          `イベント名：${ev.title}`,
          `開演：${fmt(ev.starts_at)}`,
          `会場：${ev.venue}`,
          `募集する出演形態：${actTypesLabel(ev.recruit_act_types)}`,
          ev.recruit_note ? `ジャンル・条件：${ev.recruit_note}` : null,
          `応募締切：${fmt(ev.recruit_deadline as string)}`,
          '',
          'スポンサー（サポーター）の方は、マイページの「出演応募」から応募できます。',
          `▶ ${SITE_URL}/mypage`,
          '',
          `スポンサーは月300円のファンサポーター枠から：${SITE_URL}`,
        ]
          .filter((l): l is string => l !== null)
          .join('\n'),
        retryKeyFor(ev.id, 'recruit')
      );
      sent.push(`recruit:${ev.id}`);
    }

    // チケットが買えるようになった
    if (!ev.sale_notified_at && ev.is_published) {
      const presale = ev.presale_start ? new Date(ev.presale_start).getTime() : null;
      const general = ev.general_sale_start ? new Date(ev.general_sale_start).getTime() : null;
      const opensAt = presale ?? general; // どちらも無ければ公開と同時に販売
      if ((opensAt === null || opensAt <= now) && (await claim(ev.id, 'sale_notified_at'))) {
        const isPresale = presale !== null && (general === null || now < general);
        const price = `¥${ev.price_jpy.toLocaleString('ja-JP')}`;
        await broadcast(
          await recipients(),
          isPresale
            ? `【スポンサー先行販売開始】${ev.title}（${fmt(ev.starts_at)} 開演）`
            : `【チケット販売開始】${ev.title}（${fmt(ev.starts_at)} 開演）`,
          [
            'スポンサーの皆さまへ',
            '',
            isPresale
              ? `「${ev.title}」のチケットのスポンサー先行販売が始まりました。`
              : `「${ev.title}」のチケットの販売が始まりました。`,
            '',
            `開演：${fmt(ev.starts_at)}`,
            `会場：${ev.venue}`,
            `料金：${price}`,
            isPresale && ev.general_sale_start ? `一般販売：${fmt(ev.general_sale_start)}から` : '',
            '',
            `購入は「外山企画 公式LINE」のチケット画面から：${LIFF_URL}`,
            isPresale
              ? '※ 先行販売で購入するには、マイページの「LINEと連携する」で、ご契約とLINEアカウントの連携が必要です。'
              : '',
            footer,
          ]
            .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
            .join('\n')
        );
        await broadcastLine(
          [
            isPresale ? `🎫 スポンサー先行販売スタート｜${ev.title}` : `🎫 チケット販売スタート｜${ev.title}`,
            '',
            `開演：${fmt(ev.starts_at)}`,
            `会場：${ev.venue}`,
            `料金：${price}`,
            isPresale && ev.general_sale_start ? `一般販売：${fmt(ev.general_sale_start)}から` : '',
            '',
            isPresale
              ? 'スポンサー（サポーター）の方は、マイページで「LINEと連携する」を済ませると先行購入できます。'
              : 'このトークのメニュー「チケット」から購入できます。',
            `▶ ${LIFF_URL}`,
            isPresale ? `\nスポンサーは月300円のファンサポーター枠から：${SITE_URL}` : '',
          ]
            .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
            .join('\n'),
          retryKeyFor(ev.id, 'sale')
        );
        sent.push(`sale:${ev.id}`);
      }
    }
  }

  return NextResponse.json({ checked: events.length, sent });
}

export const GET = run;
export const POST = run;
