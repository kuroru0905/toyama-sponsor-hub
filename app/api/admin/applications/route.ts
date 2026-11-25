import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { HttpError } from '@/lib/sponsorCoupons';
import { requireAdminEmail } from '@/lib/adminAuth';
import { sendMail } from '@/lib/mailer';
import {
  ACT_TYPES,
  APPLICATION_STATUS,
  GROUP_RULE,
  SPONSOR_MYPAGE_URL,
} from '@/lib/performerApplications';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function handleError(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error('/api/admin/applications error:', err);
  return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
}

// 出演応募の一覧（新しい順）
export async function GET(req: NextRequest) {
  try {
    await requireAdminEmail(req);

    const { data, error } = await supabaseAdmin
      .from('performer_applications')
      .select('*, sponsors(display_name, tier, status), live_events(title, starts_at)')
      .order('created_at', { ascending: false });
    if (error) throw new HttpError(500, '応募一覧の取得に失敗しました');

    return NextResponse.json({
      applications: (data ?? []).map((a) => {
        const sp = Array.isArray(a.sponsors) ? a.sponsors[0] : a.sponsors;
        const ev = Array.isArray(a.live_events) ? a.live_events[0] : a.live_events;
        return {
          ...a,
          sponsors: undefined,
          live_events: undefined,
          sponsor_name: sp?.display_name ?? null,
          sponsor_tier: sp?.tier ?? null,
          sponsor_status: sp?.status ?? null,
          event_title: ev?.title ?? null,
        };
      }),
    });
  } catch (err) {
    return handleError(err);
  }
}

// 選考状況の更新。採用・見送りにしたら応募者へ結果メール
export async function PATCH(req: NextRequest) {
  try {
    await requireAdminEmail(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const id = String(body.id ?? '');
    const status = String(body.status ?? '');
    if (!id) throw new HttpError(400, '対象の応募が指定されていません');
    if (!APPLICATION_STATUS[status]) throw new HttpError(400, '不正な選考状況です');

    const adminNote = typeof body.adminNote === 'string' ? body.adminNote.trim().slice(0, 1000) : '';

    const { data: app, error } = await supabaseAdmin
      .from('performer_applications')
      .update({ status, admin_note: adminNote || null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, applicant_email, act_type, act_name, representative_name, member_count, live_events(title)')
      .maybeSingle();
    if (error) throw new HttpError(500, '更新に失敗しました');
    if (!app) throw new HttpError(404, '応募が見つかりません');

    let mailed = false;
    if (status === 'accepted' || status === 'declined') {
      const ev = Array.isArray(app.live_events) ? app.live_events[0] : app.live_events;
      const eventTitle = (ev as { title?: string } | null)?.title ?? null;
      const accepted = status === 'accepted';

      mailed = await sendMail({
        to: app.applicant_email,
        subject: accepted
          ? `【採用のお知らせ】出演応募（${app.act_name}）`
          : `【選考結果のお知らせ】出演応募（${app.act_name}）`,
        text: [
          `${app.representative_name} 様`,
          '',
          accepted
            ? `このたびは出演応募ありがとうございました。「${app.act_name}」の出演を採用させていただくことになりました！`
            : `このたびは出演応募ありがとうございました。慎重に検討しましたが、今回は「${app.act_name}」の出演を見送らせていただくことになりました。`,
          '',
          `出演形態：${ACT_TYPES[app.act_type] ?? app.act_type}`,
          `希望イベント：${eventTitle ?? '指定なし'}`,
          ...(adminNote ? ['', '外山企画からのメッセージ：', adminNote] : []),
          '',
          ...(accepted && app.member_count > 1 ? ['【ご確認ください】', GROUP_RULE, ''] : []),
          accepted
            ? '今後の詳細（出演日時・リハーサル・機材など）は、外山企画からこのメールアドレス宛にご連絡します。'
            : '次回以降のイベントでも出演応募を受け付けています。またのご応募をお待ちしています。',
          '',
          SPONSOR_MYPAGE_URL,
          '',
          '外山企画 スポンサー事務局',
        ].join('\n'),
      });
    }

    return NextResponse.json({ success: true, mailed });
  } catch (err) {
    return handleError(err);
  }
}
