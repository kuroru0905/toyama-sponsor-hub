import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { HttpError } from '@/lib/sponsorCoupons';
import { requireAdminEmail } from '@/lib/adminAuth';
import { parseEventInput, checkEventTimeline, errorJson } from '@/lib/adminValidation';

export const dynamic = 'force-dynamic';

// イベント編集（送られた項目だけ）。誤って作ったイベントは DELETE で削除できる（購入・応募があるものは非公開に）
export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  try {
    await requireAdminEmail(req);
    if (!/^[0-9a-f-]{36}$/i.test(context.params.id)) throw new HttpError(404, 'イベントが見つかりません');
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const input = parseEventInput(body, true);
    if (Object.keys(input).length === 0) throw new HttpError(400, '変更する項目がありません');

    const { data: current, error: currentError } = await supabaseAdmin
      .from('live_events')
      .select('starts_at, recruit_performers, recruit_deadline, presale_start, general_sale_start')
      .eq('id', context.params.id)
      .maybeSingle();
    if (currentError) throw new HttpError(500, `イベントの取得に失敗しました（${currentError.message}）`);
    if (!current) throw new HttpError(404, 'イベントが見つかりません');
    checkEventTimeline({ ...current, ...input });
    // 開演日時を過去の日時に変えるのは止める（過去のイベントの説明などの修正はできる）
    if (
      input.starts_at !== undefined &&
      new Date(String(input.starts_at)).getTime() !== new Date(String(current.starts_at)).getTime() &&
      new Date(String(input.starts_at)).getTime() <= Date.now()
    ) {
      throw new HttpError(400, '開演日時が過去になっています。日付と時刻を確かめてください');
    }
    // 出演者募集を始める・締切を変えるときは、締切が未来であること
    {
      const recruit = input.recruit_performers ?? current.recruit_performers;
      const deadline = input.recruit_deadline !== undefined ? input.recruit_deadline : current.recruit_deadline;
      const changed =
        (input.recruit_performers === true && !current.recruit_performers) ||
        (input.recruit_deadline !== undefined &&
          new Date(String(input.recruit_deadline)).getTime() !== new Date(String(current.recruit_deadline)).getTime());
      if (recruit && changed && deadline && new Date(String(deadline)).getTime() <= Date.now()) {
        throw new HttpError(400, '出演者募集の締切が過去になっています。日付と時刻を確かめてください');
      }
    }

    const { data, error } = await supabaseAdmin
      .from('live_events')
      .update(input)
      .eq('id', context.params.id)
      .select('id')
      .maybeSingle();
    if (error) throw new HttpError(500, `イベントの更新に失敗しました（${error.message}）`);
    if (!data) throw new HttpError(404, 'イベントが見つかりません');
    return NextResponse.json({ id: data.id });
  } catch (err) {
    const { status, body } = errorJson(err);
    return NextResponse.json(body, { status });
  }
}

// イベント削除（誤って作ったイベント用）
// - 支払い済み・入場済みのチケットがある、または出演応募があるイベントは消せない（非公開にする）
// - 支払い途中（決済画面を開いただけ）の注文は、Stripeの決済画面を閉じてから注文ごと消す
//   （消したあとに支払われて、チケットのないまま請求される事故を防ぐ）
export async function DELETE(req: NextRequest, context: { params: { id: string } }) {
  try {
    await requireAdminEmail(req);
    if (!/^[0-9a-f-]{36}$/i.test(context.params.id)) throw new HttpError(404, 'イベントが見つかりません');
    const id = context.params.id;

    const { data: ev, error: evError } = await supabaseAdmin.from('live_events').select('id, title').eq('id', id).maybeSingle();
    if (evError) throw new HttpError(500, `イベントの取得に失敗しました（${evError.message}）`);
    if (!ev) throw new HttpError(404, 'イベントが見つかりません');

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('ticket_orders')
      .select('id, status, stripe_session_id')
      .eq('event_id', id);
    if (ordersError) throw new HttpError(500, `注文の取得に失敗しました（${ordersError.message}）`);
    if ((orders ?? []).some((o) => o.status !== 'pending')) {
      throw new HttpError(409, '購入済みのチケットがあるため削除できません。販売をやめるときは「非公開にする」を使ってください');
    }

    const { count: apps, error: appsError } = await supabaseAdmin
      .from('performer_applications')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', id);
    if (appsError) throw new HttpError(500, `出演応募の確認に失敗しました（${appsError.message}）`);
    if ((apps ?? 0) > 0) {
      throw new HttpError(409, '出演応募があるため削除できません。「非公開にする」を使ってください');
    }
    // 協賛（企業・お店）の申込があるイベントは消せない（返金・フォローの記録を残すため）
    const { count: sps, error: spsError } = await supabaseAdmin
      .from('event_sponsorships')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', id);
    if (spsError) throw new HttpError(500, `協賛の確認に失敗しました（${spsError.message}）`);
    if ((sps ?? 0) > 0) {
      throw new HttpError(409, '協賛の申込があるため削除できません。「非公開にする」か「公演中止・全額返金」を使ってください');
    }

    // 支払い途中の注文：決済画面がまだ開いていれば閉じる。すでに支払われていたら消さない
    const pending = (orders ?? []).filter((o) => o.stripe_session_id);
    if (pending.length > 0) {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) throw new HttpError(500, 'STRIPE_SECRET_KEY が未設定です');
      const stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' });
      for (const o of pending) {
        const session = await stripe.checkout.sessions.retrieve(o.stripe_session_id as string);
        if (session.payment_status === 'paid') {
          throw new HttpError(409, '支払い済みの注文があるため削除できません。「非公開にする」を使ってください');
        }
        if (session.status === 'open') await stripe.checkout.sessions.expire(session.id);
      }
    }

    if ((orders ?? []).length > 0) {
      const { error } = await supabaseAdmin.from('ticket_orders').delete().eq('event_id', id).eq('status', 'pending');
      if (error) throw new HttpError(500, `支払い途中の注文の削除に失敗しました（${error.message}）`);
    }
    const { error: delError } = await supabaseAdmin.from('live_events').delete().eq('id', id);
    if (delError) throw new HttpError(500, `イベントの削除に失敗しました（${delError.message}）`);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    const { status, body } = errorJson(err);
    return NextResponse.json(body, { status });
  }
}
