import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { HttpError, requireUserEmail, requireActiveSponsor } from '@/lib/sponsorCoupons';
import { sendMail, adminEmails } from '@/lib/mailer';
import {
  ACT_TYPES,
  GROUP_RULE,
  SPONSOR_ADMIN_URL,
  SPONSOR_MYPAGE_URL,
  applicationLines,
} from '@/lib/performerApplications';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function handleError(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error('/api/mypage/applications error:', err);
  return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
}

function str(body: Record<string, unknown>, key: string, label: string, max: number, required: boolean): string {
  const v = body[key];
  if (v === undefined || v === null || v === '') {
    if (required) throw new HttpError(400, `${label}を入力してください`);
    return '';
  }
  if (typeof v !== 'string') throw new HttpError(400, `${label}の形式が不正です`);
  const s = v.trim();
  if (required && !s) throw new HttpError(400, `${label}を入力してください`);
  if (s.length > max) throw new HttpError(400, `${label}は${max}文字以内で入力してください`);
  return s;
}

// 自分の契約の応募一覧 ＋ 応募できるイベント  ?sponsorId=...
export async function GET(req: NextRequest) {
  try {
    const email = await requireUserEmail(req);
    const sponsorId = req.nextUrl.searchParams.get('sponsorId') ?? '';

    // 契約の持ち主か（契約中でなくても一覧は見られる）
    const { data: owned } = await supabaseAdmin
      .from('sponsors')
      .select('id, status')
      .eq('id', sponsorId)
      .eq('email', email)
      .maybeSingle();
    if (!owned) throw new HttpError(403, '権限がありません');

    const { data: applications, error } = await supabaseAdmin
      .from('performer_applications')
      .select('id, act_type, act_name, member_count, status, admin_note, created_at, live_events(title)')
      .eq('sponsor_id', sponsorId)
      .order('created_at', { ascending: false });
    if (error) throw new HttpError(500, '応募履歴の取得に失敗しました');

    // 出演者を募集中のイベント（公開中・募集オン・締切前）
    const { data: events, error: eventsError } = await supabaseAdmin
      .from('live_events')
      .select('id, title, starts_at, recruit_deadline')
      .eq('is_published', true)
      .eq('recruit_performers', true)
      .gt('recruit_deadline', new Date().toISOString())
      .order('starts_at', { ascending: true });
    if (eventsError) throw new HttpError(500, 'イベントの取得に失敗しました');

    return NextResponse.json({
      isActive: owned.status === 'active',
      events: events ?? [],
      applications: (applications ?? []).map((a) => {
        const ev = Array.isArray(a.live_events) ? a.live_events[0] : a.live_events;
        return {
          id: a.id,
          act_type: a.act_type,
          act_name: a.act_name,
          member_count: a.member_count,
          status: a.status,
          admin_note: a.admin_note,
          created_at: a.created_at,
          event_title: (ev as { title?: string } | null)?.title ?? null,
        };
      }),
    });
  } catch (err) {
    return handleError(err);
  }
}

// 出演応募
export async function POST(req: NextRequest) {
  try {
    const email = await requireUserEmail(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const sponsor = await requireActiveSponsor(email, String(body.sponsorId ?? ''));

    const actType = String(body.actType ?? '');
    if (!ACT_TYPES[actType]) throw new HttpError(400, '出演形態を選んでください');

    const actName = str(body, 'actName', '出演名義', 60, true);
    const representativeName = str(body, 'representativeName', '代表者名', 60, true);
    const memberNames = str(body, 'memberNames', 'メンバーの名前', 500, false);
    const genre = str(body, 'genre', 'ジャンル', 60, false);
    const links = str(body, 'links', '音源・動画・SNSのURL', 500, false);
    const message = str(body, 'message', 'PR・意気込み', 1000, false);

    const memberCount = Number(body.memberCount);
    if (!Number.isInteger(memberCount) || memberCount < 1 || memberCount > 30) {
      throw new HttpError(400, '人数は1〜30人で入力してください');
    }
    const confirmed = body.allMembersSponsorConfirmed === true;
    if (memberCount > 1) {
      if (!memberNames) throw new HttpError(400, 'グループの場合はメンバー全員の名前を入力してください');
      if (!confirmed) throw new HttpError(400, GROUP_RULE);
    }

    // 出演するイベント（必須）：募集中であること
    if (!body.eventId) throw new HttpError(400, '出演するイベントを選んでください');
    const { data: ev } = await supabaseAdmin
      .from('live_events')
      .select('id, title, recruit_performers, recruit_deadline, is_published')
      .eq('id', String(body.eventId))
      .maybeSingle();
    if (!ev || !ev.is_published) throw new HttpError(400, 'イベントが見つかりません');
    if (!ev.recruit_performers || !ev.recruit_deadline || new Date(ev.recruit_deadline).getTime() <= Date.now()) {
      throw new HttpError(400, 'このイベントの出演者募集は締め切りました');
    }
    const eventId: string = ev.id;
    const eventTitle: string = ev.title;

    // 同じイベントへの重複応募（結果待ち）は不可
    const { count: dup } = await supabaseAdmin
      .from('performer_applications')
      .select('id', { count: 'exact', head: true })
      .eq('sponsor_id', sponsor.id)
      .eq('event_id', eventId)
      .in('status', ['submitted', 'reviewing']);
    if ((dup ?? 0) > 0) throw new HttpError(400, 'このイベントにはすでに応募しています（結果待ち）');

    // 同じ契約からの「結果待ち」の応募は3件まで
    const { count } = await supabaseAdmin
      .from('performer_applications')
      .select('id', { count: 'exact', head: true })
      .eq('sponsor_id', sponsor.id)
      .in('status', ['submitted', 'reviewing']);
    if ((count ?? 0) >= 3) {
      throw new HttpError(400, '結果待ちの応募は3件までです。結果が出てから次の応募をお願いします');
    }

    const { data, error } = await supabaseAdmin
      .from('performer_applications')
      .insert({
        sponsor_id: sponsor.id,
        applicant_email: email,
        act_type: actType,
        act_name: actName,
        representative_name: representativeName,
        member_count: memberCount,
        member_names: memberNames,
        all_members_sponsor_confirmed: memberCount > 1 ? confirmed : false,
        event_id: eventId,
        genre,
        links,
        message,
      })
      .select('id')
      .single();
    if (error || !data) throw new HttpError(500, '応募の登録に失敗しました');

    const lines = applicationLines({
      act_type: actType,
      act_name: actName,
      representative_name: representativeName,
      member_count: memberCount,
      member_names: memberNames,
      genre,
      links,
      message,
      event_title: eventTitle,
    });

    // 外山企画への通知と、応募者への受付確認を同時に送る
    await Promise.all([
      sendMail({
      to: adminEmails(),
      subject: `【出演応募】${actName}（${ACT_TYPES[actType]}）`,
      text: [
        'スポンサーマイページから出演応募がありました。',
        '',
        `契約名：${sponsor.display_name}`,
        `応募者メール：${email}`,
        ...(memberCount > 1 ? ['メンバー全員（または保護者）のスポンサー契約：応募者が確認済みと回答'] : []),
        '',
        ...lines,
        '',
        '管理画面で選考状況を更新してください：',
        SPONSOR_ADMIN_URL,
      ].join('\n'),
      }),
      sendMail({
      to: email,
      subject: `【受付完了】出演応募を受け付けました（${actName}）`,
      text: [
        `${representativeName} 様`,
        '',
        '外山企画のイベントへの出演応募ありがとうございます。以下の内容で受け付けました。',
        '選考結果は、このメールアドレス宛てにお知らせします。マイページでも確認できます。',
        '',
        ...lines,
        '',
        '【ご注意】',
        GROUP_RULE,
        '',
        SPONSOR_MYPAGE_URL,
        '',
        '外山企画 スポンサー事務局',
      ].join('\n'),
      }),
    ]);

    return NextResponse.json({ id: data.id });
  } catch (err) {
    return handleError(err);
  }
}
