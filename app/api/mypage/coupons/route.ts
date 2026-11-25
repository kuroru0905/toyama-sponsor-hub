import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { HttpError, requireUserEmail, requireCouponSponsor, textField } from '@/lib/sponsorCoupons';
import { sendMail, adminEmails, ADMIN_CONSOLE_URL } from '@/lib/mailer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function handleError(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error('/api/mypage/coupons error:', err);
  return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
}

// 自分の契約のクーポン一覧（利用回数つき）  ?sponsorId=...
export async function GET(req: NextRequest) {
  try {
    const email = await requireUserEmail(req);
    const sponsorId = req.nextUrl.searchParams.get('sponsorId') ?? '';
    await requireCouponSponsor(email, sponsorId);

    const { data: coupons, error } = await supabaseAdmin
      .from('sponsor_coupons')
      .select('id, shop_name, benefit_title, benefit_detail, is_published, review_status, review_note, created_at')
      .eq('sponsor_id', sponsorId)
      .order('created_at', { ascending: true });
    if (error) throw new HttpError(500, 'クーポンの取得に失敗しました');

    const ids = (coupons ?? []).map((c) => c.id);
    const counts: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: uses, error: usesError } = await supabaseAdmin
        .from('coupon_uses')
        .select('coupon_id')
        .in('coupon_id', ids);
      if (usesError) throw new HttpError(500, '利用回数の取得に失敗しました');
      (uses ?? []).forEach((u) => {
        counts[u.coupon_id] = (counts[u.coupon_id] ?? 0) + 1;
      });
    }

    return NextResponse.json({
      coupons: (coupons ?? []).map((c) => ({ ...c, use_count: counts[c.id] ?? 0 })),
    });
  } catch (err) {
    return handleError(err);
  }
}

// クーポン作成（外山企画の承認待ちで登録）
export async function POST(req: NextRequest) {
  try {
    const email = await requireUserEmail(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const sponsor = await requireCouponSponsor(email, String(body.sponsorId ?? ''));

    const shopName = textField(body, 'shopName', '店舗名', 60);
    const benefitTitle = textField(body, 'benefitTitle', '特典タイトル', 60);
    const benefitDetail = textField(body, 'benefitDetail', '特典の詳細・利用条件', 400);

    // 1契約あたりの上限（スパム防止）
    const { count } = await supabaseAdmin
      .from('sponsor_coupons')
      .select('id', { count: 'exact', head: true })
      .eq('sponsor_id', sponsor.id);
    if ((count ?? 0) >= 10) {
      throw new HttpError(400, 'クーポンは1契約あたり10件まで登録できます');
    }

    const { data, error } = await supabaseAdmin
      .from('sponsor_coupons')
      .insert({
        sponsor_id: sponsor.id,
        shop_name: shopName,
        benefit_title: benefitTitle,
        benefit_detail: benefitDetail,
        is_published: true,
        review_status: 'pending',
      })
      .select('id')
      .single();
    if (error || !data) throw new HttpError(500, 'クーポンの登録に失敗しました');

    // 外山企画へ通知（失敗しても申請は成功扱い）
    await sendMail({
      to: adminEmails(),
      subject: `【クーポン申請】${shopName}「${benefitTitle}」`,
      text: [
        'スポンサーから新しいLINEクーポンの申請がありました。',
        '',
        `契約名：${sponsor.display_name}`,
        `申請者：${email}`,
        `店舗名：${shopName}`,
        `特典：${benefitTitle}`,
        '',
        '詳細・利用条件：',
        benefitDetail,
        '',
        `管理画面で承認または差し戻しをしてください：`,
        ADMIN_CONSOLE_URL,
      ].join('\n'),
    });

    return NextResponse.json({ id: data.id });
  } catch (err) {
    return handleError(err);
  }
}
