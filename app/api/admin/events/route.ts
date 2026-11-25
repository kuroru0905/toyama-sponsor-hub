import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { HttpError } from '@/lib/sponsorCoupons';
import { requireAdminEmail } from '@/lib/adminAuth';
import { parseEventInput, errorJson } from '@/lib/adminValidation';

export const dynamic = 'force-dynamic';

type Stats = { sold: number; entered: number; revenue: number; sent: number; applications: number };

// 全イベント（非公開含む）＋販売・入場・売上・店舗送客・出演応募の集計
export async function GET(req: NextRequest) {
  try {
    await requireAdminEmail(req);

    const { data: events, error } = await supabaseAdmin
      .from('live_events')
      .select('id, title, venue, starts_at, price_jpy, capacity, description, is_published, recruit_performers, recruit_deadline, created_at')
      .order('starts_at', { ascending: true });
    if (error) throw new HttpError(500, 'イベントの取得に失敗しました');

    const stats: Record<string, Stats> = {};
    const get = (id: string) => (stats[id] = stats[id] ?? { sold: 0, entered: 0, revenue: 0, sent: 0, applications: 0 });

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('ticket_orders')
      .select('event_id, status, amount_jpy')
      .in('status', ['paid', 'used']);
    if (ordersError) throw new HttpError(500, '販売状況の取得に失敗しました');
    (orders ?? []).forEach((o) => {
      const s = get(o.event_id);
      s.sold += 1;
      if (o.status === 'used') s.entered += 1;
      s.revenue += o.amount_jpy;
    });

    // 入場特典クーポンの利用（イベント別の店舗送客数）
    const { data: uses, error: usesError } = await supabaseAdmin
      .from('coupon_uses')
      .select('ticket_orders(event_id)')
      .not('ticket_order_id', 'is', null);
    if (usesError) throw new HttpError(500, 'クーポン利用の取得に失敗しました');
    (uses ?? []).forEach((u) => {
      const t = Array.isArray(u.ticket_orders) ? u.ticket_orders[0] : u.ticket_orders;
      const eventId = (t as { event_id?: string } | null)?.event_id;
      if (eventId) get(eventId).sent += 1;
    });

    const { data: apps } = await supabaseAdmin.from('performer_applications').select('event_id').not('event_id', 'is', null);
    (apps ?? []).forEach((a) => {
      if (a.event_id) get(a.event_id).applications += 1;
    });

    return NextResponse.json({
      events: (events ?? []).map((e) => ({
        ...e,
        stats: stats[e.id] ?? { sold: 0, entered: 0, revenue: 0, sent: 0, applications: 0 },
      })),
    });
  } catch (err) {
    const { status, body } = errorJson(err);
    return NextResponse.json(body, { status });
  }
}

// イベント作成
export async function POST(req: NextRequest) {
  try {
    await requireAdminEmail(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const input = parseEventInput(body, false);

    const { data, error } = await supabaseAdmin.from('live_events').insert(input).select('id').single();
    if (error || !data) throw new HttpError(500, `イベントの作成に失敗しました${error ? `（${error.message}）` : ''}`);
    return NextResponse.json({ id: data.id });
  } catch (err) {
    const { status, body } = errorJson(err);
    return NextResponse.json(body, { status });
  }
}
