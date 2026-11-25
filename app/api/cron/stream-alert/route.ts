import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendMail, adminEmails } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://toyama-sponsor-hub.vercel.app';
const ALERT_BEFORE_MS = 60 * 60 * 1000;

// 開演1時間前を過ぎても配信URLが空の公開イベントがあれば、管理者にアラートメール（1イベント1回）
// Supabase の pg_cron から5分おきに呼ばれる（Authorization: Bearer CRON_SECRET）
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  const { data: events, error } = await supabaseAdmin
    .from('live_events')
    .select('id, title, venue, starts_at')
    .eq('is_published', true)
    .is('stream_url', null)
    .is('stream_alert_sent_at', null)
    .lte('starts_at', new Date(now + ALERT_BEFORE_MS).toISOString())
    .gt('starts_at', new Date(now - 6 * 60 * 60 * 1000).toISOString());
  if (error) {
    console.error('[stream-alert]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const alerted: string[] = [];
  for (const ev of events ?? []) {
    // 先に「送信済み」にしてから送る（同時に2回呼ばれても1通だけ）
    const { data: claimed } = await supabaseAdmin
      .from('live_events')
      .update({ stream_alert_sent_at: new Date().toISOString() })
      .eq('id', ev.id)
      .is('stream_alert_sent_at', null)
      .is('stream_url', null)
      .select('id')
      .maybeSingle();
    if (!claimed) continue;

    const startsAt = new Date(ev.starts_at).toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    await sendMail({
      to: adminEmails(),
      subject: `【要対応】配信URLが未入力です：${ev.title}（${startsAt} 開演）`,
      text: [
        `「${ev.title}」は ${startsAt} 開演ですが、当日のライブ配信URL（YouTube限定公開）がまだ入力されていません。`,
        'スポンサーのマイページに配信リンクが表示されない状態です。',
        '',
        `会場：${ev.venue}`,
        '',
        `管理画面のイベント編集から入力してください：${SITE_URL}/admin/events`,
      ].join('\n'),
    });
    alerted.push(ev.id);
  }

  return NextResponse.json({ checked: events?.length ?? 0, alerted });
}

export const GET = run;
export const POST = run;
