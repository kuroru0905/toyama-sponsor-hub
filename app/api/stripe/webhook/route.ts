import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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
          await supabaseAdmin
            .from('sponsors')
            .update({
              status: 'active',
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              updated_at: new Date().toISOString(),
            })
            .eq('id', sponsorId);
        }
        break;
      }

      // 請求書払い：入金が確認できたら有効化（カード払いの毎月の更新でも届く。未払い→支払い済みの復帰にも使う）
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const { subscriptionId, sponsorId } = invoiceSubscription(invoice);

        const update = {
          status: 'active',
          updated_at: new Date().toISOString(),
        };
        if (subscriptionId) {
          await supabaseAdmin
            .from('sponsors')
            .update(update)
            .eq('stripe_subscription_id', subscriptionId)
            .neq('status', 'canceled');
        } else if (sponsorId) {
          await supabaseAdmin.from('sponsors').update(update).eq('id', sponsorId).neq('status', 'canceled');
        }
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
