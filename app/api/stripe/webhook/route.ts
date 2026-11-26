import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendActivatedMails, type SponsorForMail } from '@/lib/sponsorMails';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

// 請求書のサブスクIDとメタデータ。新しいAPIバージョン（2025-03-31以降）では
// invoice.parent.subscription_details に移ったので、新旧どちらの形でも読む
function invoiceSubscription(invoice: Stripe.Invoice): { subscriptionId: string | null; sponsorId: string | null } {
  const inv = invoice as any;
  const details = inv.parent?.subscription_details ?? inv.subscription_details ?? null;
  const sub = inv.subscription ?? details?.subscription ?? null;
  const subscriptionId = typeof sub === 'string' ? sub : sub?.id ?? null;
  const sponsorId = details?.metadata?.sponsorId ?? null;
  return { subscriptionId, sponsorId };
}

const MAIL_FIELDS = 'id, tier, applicant_name, display_name, email, payment_method';

// 入金待ち・未払いから有効に変わった行だけを返す（同じ通知が重なってもメールは1回）
async function activate(match: { column: 'id' | 'stripe_subscription_id'; value: string }, extra: Record<string, unknown> = {}) {
  const { data, error } = await supabaseAdmin
    .from('sponsors')
    .update({ status: 'active', updated_at: new Date().toISOString(), ...extra })
    .eq(match.column, match.value)
    .in('status', ['pending', 'past_due'])
    .select(MAIL_FIELDS);
  if (error) throw error;
  return (data ?? []) as SponsorForMail[];
}

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const sponsorId = session.metadata?.sponsorId;

        if (sponsorId) {
          const ids = {
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
          };
          const activated = await activate({ column: 'id', value: sponsorId }, ids);
          // 先に invoice.paid で有効化済みでも、顧客ID・サブスクIDは保存しておく
          if (activated.length === 0) {
            await supabaseAdmin.from('sponsors').update(ids).eq('id', sponsorId);
          }
          await Promise.all(activated.map((s) => sendActivatedMails(s)));
        }

        // LINEのチケット購入（同じStripeアカウント）：支払い済みなら注文を確定する。
        // 購入者が決済後に画面を閉じても、チケットが「購入済み」になるための保険
        const orderId = session.metadata?.order_id;
        if (orderId && session.payment_status === 'paid') {
          const { error } = await supabaseAdmin
            .from('ticket_orders')
            .update({ status: 'paid', paid_at: new Date().toISOString() })
            .eq('id', orderId)
            .eq('stripe_session_id', session.id)
            .eq('status', 'pending');
          // 23505 = 同じ公演をすでに購入済み（二重購入）。ほかのエラーはStripeに再送してもらう
          if (error && error.code !== '23505') throw new Error(`チケット注文の確定に失敗しました（${error.message}）`);
        }
        break;
      }

      // 請求書払い：入金が確認できたら有効化（カード払いの毎月の更新でも届く。未払い→支払い済みの復帰にも使う）
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const { subscriptionId, sponsorId } = invoiceSubscription(invoice);

        let activated: SponsorForMail[] = [];
        if (subscriptionId) {
          activated = await activate({ column: 'stripe_subscription_id', value: subscriptionId });
        }
        if (activated.length === 0 && sponsorId) {
          activated = await activate({ column: 'id', value: sponsorId });
        }
        await Promise.all(activated.map((s) => sendActivatedMails(s)));
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const { subscriptionId } = invoiceSubscription(invoice);

        if (subscriptionId) {
          await supabaseAdmin
            .from('sponsors')
            .update({
              status: 'past_due',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', subscriptionId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        await supabaseAdmin
          .from('sponsors')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Webhook handler error:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
