import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { HttpError } from '@/lib/sponsorCoupons';
import { requireAdminEmail } from '@/lib/adminAuth';
import { parseEventInput, checkEventTimeline, errorJson } from '@/lib/adminValidation';

export const dynamic = 'force-dynamic';

type Stats = { sold: number; entered: number; revenue: number; sent: number; applications: number; refunded: number; refundedAmount: number; unnotified: number };

// 全イベント（非公開含む）＋販売・入場・売上・店舗送客・出演応募の集計
export async function GET(req: NextRequest) {
  try {
    await requireAdminEmail(req);

    // 4つの問い合わせは互いに独立しているので同時に投げる
    const [eventsRes, ordersRes, usesRes, appsRes] = await Promise.all([
      supabaseAdmin
        .from('live_events')
        .select('id, title, venue, starts_at, price_jpy, capacity, description, is_published, recruit_performers, recruit_deadline, recruit_act_types, recruit_note, presale_start, general_sale_start, stream_enabled, stream_url, cancelled_at, cancel_reason, cancel_notify, created_at')
        .order('starts_at', { ascending: true }),
      supabaseAdmin.from('ticket_orders').select('event_id, status, amount_jpy, refund_notified_at').in('status', ['paid', 'used', 'refunded']),
      // 入場特典クーポンの利用（イベント別の店舗送客数）
      supabaseAdmin.from('coupon_uses').select('ticket_orders(event_id)').not('ticket_order_id', 'is', null),
      supabaseAdmin.from('performer_applications').select('event_id').not('event_id', 'is', null),
    ]);
    if (eventsRes.error) throw new HttpError(500, 'イベントの取得に失敗しました');
    if (ordersRes.error) throw new HttpError(500, '販売状況の取得に失敗しました');
    if (usesRes.error) throw new HttpError(500, 'クーポン利用の取得に失敗しました');
    const events = eventsRes.data;

    const stats: Record<string, Stats> = {};
    const empty = (): Stats => ({ sold: 0, entered: 0, revenue: 0, sent: 0, applications: 0, refunded: 0, refundedAmount: 0, unnotified: 0 });
    const get = (id: string) => (stats[id] = stats[id] ?? empty());

    (ordersRes.data ?? []).forEach((o) => {
      const s = get(o.event_id);
      if (o.status === 'refunded') {
        s.refunded += 1;
        s.refundedAmount += o.amount_jpy;
        if (!o.refund_notified_at) s.unnotified += 1;
        return;
      }
      s.sold += 1;
      if (o.status === 'used') s.entered += 1;
      s.revenue += o.amount_jpy;
    });
    (usesRes.data ?? []).forEach((u) => {
      const t = Array.isArray(u.ticket_orders) ? u.ticket_orders[0] : u.ticket_orders;
      const eventId = (t as { event_id?: string } | null)?.event_id;
      if (eventId) get(eventId).sent += 1;
    });
    (appsRes.data ?? []).forEach((a) => {
      if (a.event_id) get(a.event_id).applications += 1;
    });

    return NextResponse.json({
      events: (events ?? []).map((e) => ({
        ...e,
        stats: stats[e.id] ?? empty(),
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
    checkEventTimeline(input);
    // 開演が過去のイベントはLINEに出ず販売もできないので作らせない（スマホの日時入力で「いま」が入る事故の防止）
    if (new Date(String(input.starts_at)).getTime() <= Date.now()) {
      throw new HttpError(400, '開演日時が過去になっています。日付と時刻を確かめてください');
    }
    // 出演者募集の締切が過去だと、募集のお知らせも応募もできない
    if (input.recruit_performers && input.recruit_deadline && new Date(String(input.recruit_deadline)).getTime() <= Date.now()) {
      throw new HttpError(400, '出演者募集の締切が過去になっています。日付と時刻を確かめてください');
    }

    const { data, error } = await supabaseAdmin.from('live_events').insert(input).select('id').single();
    if (error || !data) throw new HttpError(500, `イベントの作成に失敗しました${error ? `（${error.message}）` : ''}`);
    return NextResponse.json({ id: data.id });
  } catch (err) {
    const { status, body } = errorJson(err);
    return NextResponse.json(body, { status });
  }
}
