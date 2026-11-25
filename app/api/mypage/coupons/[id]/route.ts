import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { HttpError, requireUserEmail, requireCouponSponsor, textField } from '@/lib/sponsorCoupons';
import { sendMail, adminEmails, ADMIN_CONSOLE_URL } from '@/lib/mailer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// クーポン編集
// - 内容（店舗名・特典）を変えたら、もう一度「審査中」に戻る
// - 公開/非公開の切り替えだけなら審査不要
export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  try {
    const email = await requireUserEmail(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const { data: coupon, error: fetchError } = await supabaseAdmin
      .from('sponsor_coupons')
      .select('id, sponsor_id')
      .eq('id', context.params.id)
      .maybeSingle();
    if (fetchError) throw new HttpError(500, 'データの取得に失敗しました');
    if (!coupon || !coupon.sponsor_id) throw new HttpError(404, 'クーポンが見つかりません');

    // 自分の契約のクーポンか
    const sponsor = await requireCouponSponsor(email, coupon.sponsor_id);

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    const contentChanged =
      body.shopName !== undefined || body.benefitTitle !== undefined || body.benefitDetail !== undefined;
    if (contentChanged) {
      update.shop_name = textField(body, 'shopName', '店舗名', 60);
      update.benefit_title = textField(body, 'benefitTitle', '特典タイトル', 60);
      update.benefit_detail = textField(body, 'benefitDetail', '特典の詳細・利用条件', 400);
      update.review_status = 'pending';
      update.review_note = null;
    }

    if (body.isPublished !== undefined) {
      if (typeof body.isPublished !== 'boolean') throw new HttpError(400, '公開設定の形式が不正です');
      update.is_published = body.isPublished;
    }

    if (Object.keys(update).length === 1) throw new HttpError(400, '変更する項目がありません');

    const { error } = await supabaseAdmin.from('sponsor_coupons').update(update).eq('id', coupon.id);
    if (error) throw new HttpError(500, 'クーポンの更新に失敗しました');

    // 内容が変わった（再申請）ときだけ外山企画へ通知
    if (contentChanged) {
      await sendMail({
        to: adminEmails(),
        subject: `【クーポン再申請】${String(update.shop_name)}「${String(update.benefit_title)}」`,
        text: [
          'スポンサーがLINEクーポンの内容を変更しました（再審査が必要です）。',
          '',
          `契約名：${sponsor.display_name}`,
          `申請者：${email}`,
          `店舗名：${String(update.shop_name)}`,
          `特典：${String(update.benefit_title)}`,
          '',
          '詳細・利用条件：',
          String(update.benefit_detail),
          '',
          '管理画面で承認または差し戻しをしてください：',
          ADMIN_CONSOLE_URL,
        ].join('\n'),
      });
    }

    return NextResponse.json({ success: true, reReview: contentChanged });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('PATCH /api/mypage/coupons/[id] error:', err);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
