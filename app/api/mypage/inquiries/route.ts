import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { HttpError, requireUserEmail, requireActiveSponsor, textField } from '@/lib/sponsorCoupons';
import { sendMail, adminEmails } from '@/lib/mailer';
import { INQUIRY_KINDS } from '@/lib/inquiries';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://toyama-sponsor-hub.vercel.app';

function fail(err: unknown) {
  if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(err);
  return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
}

async function requireCorporate(req: NextRequest, sponsorId: string) {
  const email = await requireUserEmail(req);
  const sponsor = await requireActiveSponsor(email, sponsorId);
  if (sponsor.tier !== 'corporate') {
    throw new HttpError(403, 'CM放映・動画制作のお問い合わせは企業プレミアム枠の特典です');
  }
  return { email, sponsor };
}

// これまでの問い合わせ
export async function GET(req: NextRequest) {
  try {
    const sponsorId = req.nextUrl.searchParams.get('sponsorId') ?? '';
    await requireCorporate(req, sponsorId);
    const { data, error } = await supabaseAdmin
      .from('sponsor_inquiries')
      .select('id, kind, message, status, created_at')
      .eq('sponsor_id', sponsorId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw new HttpError(500, '問い合わせ履歴の取得に失敗しました');
    return NextResponse.json({ inquiries: data ?? [] });
  } catch (err) {
    return fail(err);
  }
}

// CM放映・動画制作の問い合わせ（企業枠のみ）。外山企画と本人にメール
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const sponsorId = typeof body.sponsorId === 'string' ? body.sponsorId : '';
    const { email, sponsor } = await requireCorporate(req, sponsorId);

    const kind = typeof body.kind === 'string' ? body.kind : '';
    if (!INQUIRY_KINDS[kind]) throw new HttpError(400, 'お問い合わせの種類を選んでください');
    const message = textField(body, 'message', 'お問い合わせ内容', 2000);
    const contactName = typeof body.contactName === 'string' ? body.contactName.trim().slice(0, 100) : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 30) : '';
    if (phone && !/^[0-9+\-() ]+$/.test(phone)) throw new HttpError(400, '電話番号は数字とハイフンで入力してください');

    const { data, error } = await supabaseAdmin
      .from('sponsor_inquiries')
      .insert({
        sponsor_id: sponsor.id,
        kind,
        message,
        contact_name: contactName || null,
        phone: phone || null,
      })
      .select('id, kind, message, status, created_at')
      .single();
    if (error || !data) throw new HttpError(500, 'お問い合わせの保存に失敗しました');

    const lines = [`種類：${INQUIRY_KINDS[kind]}`, `企業名：${sponsor.display_name}`];
    if (contactName) lines.push(`ご担当者：${contactName}`);
    lines.push(`メール：${email}`);
    if (phone) lines.push(`電話：${phone}`);
    lines.push('', '【内容】', message);

    await Promise.all([
      sendMail({
        to: adminEmails(),
        subject: `【企業枠お問い合わせ】${sponsor.display_name}：${INQUIRY_KINDS[kind]}`,
        text: [
          '企業プレミアム枠のスポンサーからお問い合わせがありました。',
          '返信は下記のメールアドレス宛にお願いします。',
          '',
          ...lines,
          '',
          `管理画面：${SITE_URL}/admin/sponsors`,
        ].join('\n'),
      }),
      sendMail({
        to: email,
        subject: `【外山企画】お問い合わせを受け付けました（${INQUIRY_KINDS[kind]}）`,
        text: [
          `${sponsor.display_name} ご担当者様`,
          '',
          '外山企画へのお問い合わせありがとうございます。以下の内容で受け付けました。',
          '担当者より、このメールアドレス宛にご連絡いたします。',
          '',
          ...lines,
          '',
          '外山企画',
        ].join('\n'),
      }),
    ]);

    return NextResponse.json({ inquiry: data });
  } catch (err) {
    return fail(err);
  }
}
