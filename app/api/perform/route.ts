import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { HttpError } from '@/lib/sponsorCoupons';
import { sendMail, adminEmails } from '@/lib/mailer';
import { ACT_TYPES, SPONSOR_ADMIN_URL, applicationLines } from '@/lib/performerApplications';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 公開の出演応募（スポンサー契約がなくても、誰でも応募できる）
// 連投・いたずら対策：見えない入力欄（ボット除け）、同じ回線から1時間に3件・同じメールの結果待ち3件・全体で1時間30件まで

function fail(err: unknown) {
  if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error('/api/perform error:', err);
  return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
}

// 改行以外の制御文字・見えない文字を取り除く
function clean(v: unknown, multiline = false): string {
  if (typeof v !== 'string') return '';
  let s = v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩﻿]/g, '');
  if (!multiline) s = s.replace(/[\r\n\t]+/g, ' ');
  return s.trim();
}

function field(body: Record<string, unknown>, key: string, label: string, max: number, required: boolean, multiline = false): string {
  const s = clean(body[key], multiline);
  if (required && !s) throw new HttpError(400, `${label}を入力してください`);
  if (s.length > max) throw new HttpError(400, `${label}は${max}文字以内で入力してください`);
  return s;
}

function ipHash(req: NextRequest): string {
  const ip = req.headers.get('x-real-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  return createHmac('sha256', process.env.CRON_SECRET || 'machikippu').update(`perform:${ip}`).digest('hex').slice(0, 32);
}

// 出演者を募集中のイベント
async function recruitingEvents() {
  const { data, error } = await supabaseAdmin
    .from('live_events')
    .select('id, title, venue, starts_at, recruit_deadline, recruit_act_types, recruit_note')
    .eq('recruit_performers', true)
    .is('cancelled_at', null)
    .gt('recruit_deadline', new Date().toISOString())
    .order('starts_at', { ascending: true });
  if (error) throw new HttpError(500, 'イベントの取得に失敗しました');
  return data ?? [];
}

export async function GET() {
  try {
    return NextResponse.json({ events: await recruitingEvents() });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // ボット除け：人には見えない欄に何か入っていたら、受け付けたふりをして何もしない
    if (typeof body.website === 'string' && body.website.trim() !== '') return NextResponse.json({ ok: true });

    const actType = String(body.actType ?? '');
    // 決まった4種類だけ（"__proto__" などの名前で通り抜けないよう、自分のキーか確かめる）
    if (!Object.prototype.hasOwnProperty.call(ACT_TYPES, actType)) throw new HttpError(400, '出演形態を選んでください');
    const actName = field(body, 'actName', '出演名義', 60, true);
    const representativeName = field(body, 'representativeName', '代表者のお名前', 60, true);
    const email = clean(body.email).toLowerCase();
    if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email) || email.length > 254) {
      throw new HttpError(400, 'メールアドレスの形式が正しくありません');
    }
    const memberCount = Number(body.memberCount);
    if (!Number.isInteger(memberCount) || memberCount < 1 || memberCount > 30) throw new HttpError(400, '人数は1〜30人で入力してください');
    const memberNames = memberCount > 1 ? field(body, 'memberNames', 'メンバーのお名前', 600, true, true) : '';
    const genre = field(body, 'genre', 'ジャンル', 60, false);
    const links = field(body, 'links', '音源・動画・SNSのURL', 500, false, true);
    const message = field(body, 'message', 'PR・意気込み', 1000, false, true);
    if (body.minorConsent !== true) throw new HttpError(400, '未成年のメンバーについての確認にチェックを入れてください');

    // 出演するイベント：募集中であること
    const eventId = String(body.eventId ?? '');
    if (!/^[0-9a-f-]{36}$/i.test(eventId)) throw new HttpError(400, '出演するイベントを選んでください');
    const ev = (await recruitingEvents()).find((e) => e.id === eventId);
    if (!ev) throw new HttpError(400, 'このイベントの出演者募集は締め切りました');
    const allowed: string[] = ev.recruit_act_types ?? [];
    if (allowed.length > 0 && allowed.indexOf(actType) < 0) {
      throw new HttpError(400, `このイベントで募集している出演形態は「${allowed.map((t) => ACT_TYPES[t] ?? t).join('／')}」です`);
    }

    // 連投の確認
    const hash = ipHash(req);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const [byIp, byMail, dup, all] = await Promise.all([
      supabaseAdmin.from('performer_applications').select('id', { count: 'exact', head: true }).eq('ip_hash', hash).gt('created_at', hourAgo),
      supabaseAdmin.from('performer_applications').select('id', { count: 'exact', head: true }).eq('applicant_email', email).in('status', ['submitted', 'reviewing']),
      supabaseAdmin
        .from('performer_applications')
        .select('id', { count: 'exact', head: true })
        .eq('applicant_email', email)
        .eq('event_id', eventId)
        .in('status', ['submitted', 'reviewing']),
      supabaseAdmin.from('performer_applications').select('id', { count: 'exact', head: true }).eq('source', 'public').gt('created_at', hourAgo),
    ]);
    if ((dup.count ?? 0) > 0) throw new HttpError(400, 'このイベントにはすでに応募しています（結果待ち）');
    if ((byMail.count ?? 0) >= 3) throw new HttpError(429, '結果待ちの応募は3件までです。結果が出てから次の応募をお願いします');
    if ((byIp.count ?? 0) >= 3 || (all.count ?? 0) >= 30) throw new HttpError(429, '応募が集中しています。しばらく時間をおいてからお試しください');

    const { data, error } = await supabaseAdmin
      .from('performer_applications')
      .insert({
        sponsor_id: null,
        source: 'public',
        ip_hash: hash,
        applicant_email: email,
        act_type: actType,
        act_name: actName,
        representative_name: representativeName,
        member_count: memberCount,
        member_names: memberNames,
        members: [],
        all_members_sponsor_confirmed: false,
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
      event_title: ev.title,
    });

    // 外山企画への通知と、応募者への受付確認
    // （受付確認は、入力された文章を載せない決まった文面にする：他人のアドレスに好きな文章を送る踏み台にさせないため）
    await Promise.all([
      sendMail({
        to: adminEmails(),
        subject: `【出演応募・一般】${actName}（${ACT_TYPES[actType]}）`,
        text: ['公開の応募ページから出演応募がありました（スポンサー契約なし）。', '', `応募者メール：${email}`, '', ...lines, '', '管理画面で選考状況を更新してください：', SPONSOR_ADMIN_URL].join('\n'),
      }),
      sendMail({
        to: email,
        subject: `【受付完了】出演応募を受け付けました（${ev.title}）`,
        text: [
          '外山企画のイベントへの出演応募ありがとうございます。',
          `「${ev.title}」への応募を受け付けました。`,
          '',
          '選考結果は、このメールアドレス宛てにお知らせします。',
          '心当たりのない場合は、このメールを破棄してください。',
          '',
          '外山企画',
        ].join('\n'),
      }),
    ]);

    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    return fail(err);
  }
}
