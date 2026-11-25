import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { HttpError } from '@/lib/sponsorCoupons';
import { requireAdminEmail } from '@/lib/adminAuth';
import { parseCouponInput, errorJson } from '@/lib/adminValidation';
import { sendMail } from '@/lib/mailer';
import { SPONSOR_MYPAGE_URL } from '@/lib/performerApplications';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// クーポン編集・審査。承認・差し戻しをしたら、スポンサーの登録メールアドレスに結果を送る
export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  try {
    await requireAdminEmail(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const input = parseCouponInput(body, true);
    if (Object.keys(input).length === 0) throw new HttpError(400, '変更する項目がありません');

    const { data, error } = await supabaseAdmin
      .from('sponsor_coupons')
      .update(input)
      .eq('id', context.params.id)
      .select('id, shop_name, benefit_title, review_status, review_note, sponsor_id')
      .maybeSingle();
    if (error) throw new HttpError(500, 'クーポンの更新に失敗しました');
    if (!data) throw new HttpError(404, 'クーポンが見つかりません');

    let mailed = false;
    const decided = input.review_status === 'approved' || input.review_status === 'rejected';
    if (decided && data.sponsor_id) {
      const { data: sponsor } = await supabaseAdmin
        .from('sponsors')
        .select('email, display_name')
        .eq('id', data.sponsor_id)
        .maybeSingle();

      if (sponsor?.email) {
        const approved = data.review_status === 'approved';
        mailed = await sendMail({
          to: sponsor.email,
          subject: approved
            ? `【承認】LINEクーポン「${data.benefit_title}」の掲載を開始しました`
            : `【差し戻し】LINEクーポン「${data.benefit_title}」の内容をご確認ください`,
          text: (approved
            ? [
                `${sponsor.display_name} 様`,
                '',
                'いつも外山企画のイベントにご協賛いただきありがとうございます。',
                '申請いただいたLINEクーポンを承認し、LINEのクーポン画面への掲載を開始しました。',
                'ライブに入場したお客様が、入場特典としてご利用になれます。',
                '',
                `店舗名：${data.shop_name}`,
                `特典：${data.benefit_title}`,
                '',
                'クーポンの利用回数や掲載の停止・再開は、スポンサーマイページから確認・操作できます。',
                SPONSOR_MYPAGE_URL,
              ]
            : [
                `${sponsor.display_name} 様`,
                '',
                'いつも外山企画のイベントにご協賛いただきありがとうございます。',
                '申請いただいたLINEクーポンについて、内容の修正をお願いしたい点がございます。',
                '',
                `店舗名：${data.shop_name}`,
                `特典：${data.benefit_title}`,
                '',
                '修正のお願い：',
                data.review_note ?? '',
                '',
                'お手数ですが、スポンサーマイページから内容を修正して再申請してください。',
                SPONSOR_MYPAGE_URL,
              ]
          )
            .concat(['', '外山企画 スポンサー事務局'])
            .join('\n'),
        });
      }
    }

    return NextResponse.json({ id: data.id, mailed });
  } catch (err) {
    const { status, body } = errorJson(err);
    return NextResponse.json(body, { status });
  }
}
