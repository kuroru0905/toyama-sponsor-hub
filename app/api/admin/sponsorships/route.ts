import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminEmail } from '@/lib/adminAuth';
import { HttpError } from '@/lib/sponsorCoupons';
import { TIER_CAPS } from '@/lib/tierCaps';

export const dynamic = 'force-dynamic';

// 管理画面：イベントごとの協賛企業・お店の一覧（フォロー期間中かどうか付き）
export async function GET(req: NextRequest) {
  try {
    await requireAdminEmail(req);
    const [evRes, spRes] = await Promise.all([
      supabaseAdmin.from('live_events').select('id, title, venue, starts_at, is_published, cancelled_at').order('starts_at', { ascending: false }),
      supabaseAdmin
        .from('event_sponsorships')
        .select('id, event_id, tier, amount_jpy, status, payment_method, paid_at, refunded_at, follow_end_date, created_at, sponsors(id, display_name, applicant_name, email)')
        .in('status', ['pending', 'paid', 'refunded'])
        .order('created_at', { ascending: true }),
    ]);
    if (evRes.error || spRes.error) throw new HttpError(500, '協賛の一覧を読み込めませんでした');

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
    const byEvent: Record<string, unknown[]> = {};
    for (const x of spRes.data ?? []) {
      const sp = (Array.isArray(x.sponsors) ? x.sponsors[0] : x.sponsors) as { id: string; display_name: string; applicant_name: string; email: string } | null;
      (byEvent[x.event_id as string] ??= []).push({
        id: x.id,
        tier: x.tier,
        amount: x.amount_jpy,
        status: x.status,
        paymentMethod: x.payment_method,
        paidAt: x.paid_at,
        refundedAt: x.refunded_at,
        followEnd: x.follow_end_date,
        inFollow: x.status === 'paid' && (x.follow_end_date as string) >= today,
        sponsorId: sp?.id ?? null,
        displayName: sp?.display_name ?? '',
        applicantName: sp?.applicant_name ?? '',
        email: sp?.email ?? '',
      });
    }
    return NextResponse.json({
      caps: TIER_CAPS,
      events: (evRes.data ?? []).map((e) => ({ ...e, sponsorships: byEvent[e.id as string] ?? [] })),
    });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('/api/admin/sponsorships error:', err);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
