import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { HttpError } from '@/lib/sponsorCoupons';
import { requireAdminEmail } from '@/lib/adminAuth';
import { parseCouponInput, errorJson } from '@/lib/adminValidation';

export const dynamic = 'force-dynamic';

// 全クーポン（非公開・審査中含む）＋利用回数＋登録したスポンサー
export async function GET(req: NextRequest) {
  try {
    await requireAdminEmail(req);

    const { data: coupons, error } = await supabaseAdmin
      .from('sponsor_coupons')
      .select('id, shop_name, benefit_title, benefit_detail, is_published, review_status, review_note, sponsor_id, created_at, sponsors(display_name)')
      .order('created_at', { ascending: true });
    if (error) throw new HttpError(500, 'クーポンの取得に失敗しました');

    const { data: uses, error: usesError } = await supabaseAdmin.from('coupon_uses').select('coupon_id');
    if (usesError) throw new HttpError(500, '利用回数の取得に失敗しました');
    const counts: Record<string, number> = {};
    (uses ?? []).forEach((u) => {
      counts[u.coupon_id] = (counts[u.coupon_id] ?? 0) + 1;
    });

    return NextResponse.json({
      coupons: (coupons ?? []).map((c) => {
        const sp = Array.isArray(c.sponsors) ? c.sponsors[0] : c.sponsors;
        return {
          id: c.id,
          shop_name: c.shop_name,
          benefit_title: c.benefit_title,
          benefit_detail: c.benefit_detail,
          is_published: c.is_published,
          review_status: c.review_status,
          review_note: c.review_note,
          sponsor_name: c.sponsor_id ? ((sp as { display_name?: string } | null)?.display_name ?? '（不明なスポンサー）') : null,
          use_count: counts[c.id] ?? 0,
        };
      }),
    });
  } catch (err) {
    const { status, body } = errorJson(err);
    return NextResponse.json(body, { status });
  }
}

// クーポン作成（管理者が作るものは最初から承認済み）
export async function POST(req: NextRequest) {
  try {
    await requireAdminEmail(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const input = parseCouponInput(body, false);

    const { data, error } = await supabaseAdmin
      .from('sponsor_coupons')
      .insert({ ...input, review_status: 'approved' })
      .select('id')
      .single();
    if (error || !data) throw new HttpError(500, 'クーポンの作成に失敗しました');
    return NextResponse.json({ id: data.id });
  } catch (err) {
    const { status, body } = errorJson(err);
    return NextResponse.json(body, { status });
  }
}
