import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { HttpError } from '@/lib/sponsorCoupons';
import { requireAdminEmail } from '@/lib/adminAuth';
import { errorJson } from '@/lib/adminValidation';
import { pushLine, retryKeyFromSeed } from '@/lib/lineMessaging';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 公演中止・全額返金
// 1. イベントを「中止」にする（LINEで販売・入場が止まり、「公演中止」と表示される）
// 2. 決済画面を開いただけの注文は、決済画面を閉じて取り消す
// 3. 支払い済み・入場済みのチケットを、Stripeで全額返金する（入場済みも含む）
// 4. 購入者にLINEで中止と返金を知らせる
// 途中で止まっても、もう一度押せば残りだけを続ける（返金・お知らせは二重にならない）
const TIME_BUDGET_MS = 45_000;

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  const started = Date.now();
  try {
    await requireAdminEmail(req);
    const id = context.params.id;
    const body = (await req.json().catch(() => ({}))) as { reason?: unknown };
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : '';

    const { data: ev, error: evError } = await supabaseAdmin
      .from('live_events')
      .select('id, title, starts_at, cancelled_at, cancel_reason')
      .eq('id', id)
      .maybeSingle();
    if (evError) throw new HttpError(500, `イベントの取得に失敗しました（${evError.message}）`);
    if (!ev) throw new HttpError(404, 'イベントが見つかりません');

    // 1. 中止にする（2回目以降は理由だけ更新しない）
    if (!ev.cancelled_at) {
      const { error } = await supabaseAdmin
        .from('live_events')
        .update({ cancelled_at: new Date().toISOString(), cancel_reason: reason || null })
        .eq('id', id)
        .is('cancelled_at', null);
      if (error) throw new HttpError(500, `中止の記録に失敗しました（${error.message}）`);
    }
    const cancelReason = ev.cancelled_at ? ev.cancel_reason : reason || null;

    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new HttpError(500, 'STRIPE_SECRET_KEY が未設定です');
    const stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' });

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('ticket_orders')
      .select('id, status, line_user_id, amount_jpy, stripe_session_id, refund_notified_at')
      .eq('event_id', id)
      .in('status', ['pending', 'paid', 'used', 'refunded']);
    if (ordersError) throw new HttpError(500, `注文の取得に失敗しました（${ordersError.message}）`);

    const failed: string[] = [];
    let refunded = 0;
    let refundedAmount = 0;
    let notified = 0;
    let remaining = 0;

    for (const o of orders ?? []) {
      if (Date.now() - started > TIME_BUDGET_MS) {
        remaining += 1;
        continue;
      }
      try {
        // 2. 支払い途中：決済画面を閉じる。実はもう支払われていたら返金に回す
        let status = o.status as string;
        if (status === 'pending') {
          if (!o.stripe_session_id) continue;
          const s = await stripe.checkout.sessions.retrieve(o.stripe_session_id);
          if (s.payment_status === 'paid') {
            status = 'paid';
          } else {
            if (s.status === 'open') await stripe.checkout.sessions.expire(s.id);
            await supabaseAdmin.from('ticket_orders').update({ status: 'canceled' }).eq('id', o.id).eq('status', 'pending');
            continue;
          }
        }

        // 3. 返金（同じ注文には1回だけ：idempotencyKey）
        if (status === 'paid' || status === 'used') {
          if (!o.stripe_session_id) throw new Error('決済の記録がありません');
          const s = await stripe.checkout.sessions.retrieve(o.stripe_session_id);
          const pi = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id;
          if (!pi) throw new Error('支払いが見つかりません');
          const refund = await stripe.refunds.create(
            { payment_intent: pi, reason: 'requested_by_customer', metadata: { order_id: o.id, event_id: id, cause: 'event_cancelled' } },
            { idempotencyKey: `event-cancel-refund-${o.id}` }
          );
          const { error } = await supabaseAdmin
            .from('ticket_orders')
            .update({ status: 'refunded', refunded_at: new Date().toISOString(), stripe_refund_id: refund.id })
            .eq('id', o.id)
            .in('status', ['pending', 'paid', 'used']);
          if (error) throw new Error(error.message);
          refunded += 1;
          refundedAmount += o.amount_jpy ?? 0;
          status = 'refunded';
        }

        // 4. LINEでお知らせ（1人1回）
        if (status === 'refunded' && !o.refund_notified_at && o.line_user_id) {
          const text = [
            `【公演中止のお知らせ】${ev.title}`,
            `${fmt(ev.starts_at)} 開演の公演は中止になりました。`,
            cancelReason ? `理由：${cancelReason}` : null,
            '',
            `チケット代 ¥${(o.amount_jpy ?? 0).toLocaleString('ja-JP')} は全額返金しました。`,
            'カードの明細に反映されるまで、5〜10営業日ほどかかります。',
            '',
            'ご迷惑をおかけして申し訳ありません。',
            '外山企画',
          ]
            .filter((l) => l !== null)
            .join('\n');
          const ok = await pushLine(o.line_user_id, text, retryKeyFromSeed(`cancel:${o.id}`));
          if (ok) {
            await supabaseAdmin.from('ticket_orders').update({ refund_notified_at: new Date().toISOString() }).eq('id', o.id);
            notified += 1;
          }
        }
      } catch (err) {
        failed.push(`${o.id}: ${err instanceof Error ? err.message : 'error'}`);
      }
    }

    if (failed.length > 0) console.error('[cancel] 返金・お知らせに失敗した注文', failed);
    return NextResponse.json({ cancelled: true, refunded, refundedAmount, notified, failed: failed.length, remaining });
  } catch (err) {
    const { status, body } = errorJson(err);
    return NextResponse.json(body, { status });
  }
}
