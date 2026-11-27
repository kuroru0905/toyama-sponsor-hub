import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { TIER_CAPS } from '@/lib/tierCaps';
import { sendMail, adminEmails } from '@/lib/mailer';
import { sendActivatedMails, type SponsorForMail } from '@/lib/sponsorMails';

// まちきっぷ パートナーズ：企業・お店の協賛は「イベント1回ごと」の単発払い（税込）
export const EVENT_PRICES: Record<'corporate' | 'store', number> = {
  corporate: 30000,
  store: 10000,
};

// 開催の何日前まで協賛を受け付けるか
export const SPONSOR_DEADLINE_DAYS = 7;

export const isEventTier = (tier: string): tier is 'corporate' | 'store' => tier === 'corporate' || tier === 'store';

export type SponsorableEvent = { id: string; title: string; venue: string; starts_at: string; deadline: string };

// 協賛を受け付けているイベント：公開中・中止されていない・締切（開催7日前）より前
export async function sponsorableEvents(): Promise<SponsorableEvent[]> {
  const deadlineFloor = new Date(Date.now() + SPONSOR_DEADLINE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('live_events')
    .select('id, title, venue, starts_at')
    .eq('is_published', true)
    .is('cancelled_at', null)
    .gt('starts_at', deadlineFloor)
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((e) => ({
    ...(e as { id: string; title: string; venue: string; starts_at: string }),
    deadline: new Date(new Date(e.starts_at as string).getTime() - SPONSOR_DEADLINE_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  }));
}

// そのイベントの、支払い済みの協賛の数（枠の上限はイベントごと）
export async function paidCount(eventId: string, tier: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('event_sponsorships')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('tier', tier)
    .eq('status', 'paid');
  if (error) throw error;
  return count ?? 0;
}

const MAIL_FIELDS = 'id, tier, applicant_name, display_name, email, payment_method';

// 支払いを確認した協賛を「支払い済み」にし、会社・お店を「協賛中」にする。
// 同じ通知が重なっても1回だけ処理する（未払い→支払い済みに変わった行だけ）
export async function markSponsorshipPaid(
  match: { column: 'id' | 'stripe_session_id' | 'stripe_invoice_id'; value: string },
  extra: { stripe_payment_intent_id?: string | null } = {}
): Promise<boolean> {
  const { data: rows, error } = await supabaseAdmin
    .from('event_sponsorships')
    .update({ status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...extra })
    .eq(match.column, match.value)
    .eq('status', 'pending')
    .select('id, sponsor_id, event_id, tier, amount_jpy, payment_method, follow_end_date, live_events(title, starts_at)');
  if (error) throw error;
  if (!rows || rows.length === 0) return false;

  for (const r of rows) {
    // 協賛中にする（前の協賛のフォロー期間が終わっていた・月額を解約していた場合も、また協賛中に戻す）
    const { data: sp, error: spErr } = await supabaseAdmin
      .from('sponsors')
      .update({ status: 'active', payment_method: r.payment_method, updated_at: new Date().toISOString() })
      .eq('id', r.sponsor_id)
      .select(MAIL_FIELDS)
      .maybeSingle();
    if (spErr) throw spErr;
    const ev = (Array.isArray(r.live_events) ? r.live_events[0] : r.live_events) as { title: string; starts_at: string } | null;
    if (sp && ev) {
      await sendActivatedMails(sp as SponsorForMail, {
        title: ev.title,
        startsAt: ev.starts_at,
        followEnd: r.follow_end_date as string,
        amount: r.amount_jpy as number,
      });
    }
    await warnIfOverCap(r.event_id as string, r.tier as string, ev?.title ?? '');
  }
  return true;
}

// 同時に申し込んだ人が両方支払うと、イベントごとの枠の上限を超えることがある。支払い済みの人は止めず、管理者に知らせる
async function warnIfOverCap(eventId: string, tier: string, title: string) {
  const cap = TIER_CAPS[tier];
  if (cap === undefined) return;
  const n = await paidCount(eventId, tier);
  if (n > cap) {
    await sendMail({
      to: adminEmails(),
      subject: `【要確認】「${title}」の${tier === 'corporate' ? '企業' : 'お店'}の協賛が上限を超えました（${n}/${cap}）`,
      text: `同時のお申し込みが重なり、「${title}」の${tier === 'corporate' ? '企業' : 'お店'}の協賛が上限（${cap}）を超えて ${n} 件になりました。\n管理画面の「協賛」で確認してください。`,
    }).catch((e) => console.error('[sponsorship] 上限超過の通知に失敗', e));
  }
}

// 未払いのまま終わった協賛（決済画面の期限切れ・請求書の無効化）を取り消す。同じイベントにまた申し込めるようにするため
export async function cancelPendingSponsorship(match: { column: 'stripe_session_id' | 'stripe_invoice_id'; value: string }) {
  await supabaseAdmin
    .from('event_sponsorships')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq(match.column, match.value)
    .eq('status', 'pending');
}

// 日本時間の日付表示（フォロー終了日など）
export const fmtDateJst = (isoOrDate: string) =>
  new Date(isoOrDate.length === 10 ? `${isoOrDate}T00:00:00+09:00` : isoOrDate).toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
