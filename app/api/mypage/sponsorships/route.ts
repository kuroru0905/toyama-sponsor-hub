import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { HttpError, requireUserEmail } from '@/lib/sponsorCoupons';

export const dynamic = 'force-dynamic';

// マイページ：自分の会社・お店の、イベントごとの協賛の履歴  ?sponsorId=...
export async function GET(req: NextRequest) {
  try {
    const email = await requireUserEmail(req);
    const sponsorId = req.nextUrl.searchParams.get('sponsorId') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(sponsorId)) throw new HttpError(400, '対象の契約が指定されていません');
    const { data: owned } = await supabaseAdmin.from('sponsors').select('id').eq('id', sponsorId).eq('email', email).maybeSingle();
    if (!owned) throw new HttpError(403, '権限がありません');

    const { data, error } = await supabaseAdmin
      .from('event_sponsorships')
      .select('id, tier, amount_jpy, status, payment_method, paid_at, follow_end_date, created_at, live_events(title, starts_at, cancelled_at)')
      .eq('sponsor_id', sponsorId)
      .in('status', ['pending', 'paid', 'refunded'])
      .order('created_at', { ascending: false });
    if (error) throw new HttpError(500, '協賛の履歴を読み込めませんでした');

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
    return NextResponse.json({
      sponsorships: (data ?? []).map((x) => {
        const ev = (Array.isArray(x.live_events) ? x.live_events[0] : x.live_events) as { title: string; starts_at: string; cancelled_at: string | null } | null;
        return {
          id: x.id,
          tier: x.tier,
          amount: x.amount_jpy,
          status: x.status,
          paymentMethod: x.payment_method,
          paidAt: x.paid_at,
          followEnd: x.follow_end_date,
          inFollow: x.status === 'paid' && (x.follow_end_date as string) >= today,
          eventTitle: ev?.title ?? '',
          eventStartsAt: ev?.starts_at ?? null,
          eventCancelled: !!ev?.cancelled_at,
        };
      }),
    });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('/api/mypage/sponsorships error:', err);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
