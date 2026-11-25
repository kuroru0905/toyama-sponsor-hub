import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { TIER_CAPS } from '@/lib/tierCaps';
import { sendInvoiceAppliedMails } from '@/lib/sponsorMails';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

const PRICE_MAP: Record<string, string | undefined> = {
  corporate: process.env.STRIPE_PRICE_CORPORATE,
  store: process.env.STRIPE_PRICE_STORE,
  fan: process.env.STRIPE_PRICE_FAN,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tier,
      applicantName,
      displayName,
      isPublic,
      email,
      paymentMethod,
      industry,
      address,
      contactNote,
    } = body;

    if (!tier || !PRICE_MAP[tier]) {
      return NextResponse.json({ error: '無効なプランが指定されました' }, { status: 400 });
    }
    if (!applicantName || !email) {
      return NextResponse.json({ error: '必須項目が入力されていません' }, { status: 400 });
    }

    const cap = TIER_CAPS[tier];
    if (cap !== undefined) {
      const { count, error: countError } = await supabaseAdmin
        .from('sponsors')
        .select('id', { count: 'exact', head: true })
        .eq('tier', tier)
        .eq('status', 'active');
      if (countError) {
        return NextResponse.json({ error: '募集状況の確認に失敗しました' }, { status: 500 });
      }
      if ((count ?? 0) >= cap) {
        return NextResponse.json(
          { error: `この枠は満枠（${cap}社/店）のため、現在お申し込みを受け付けていません` },
          { status: 409 }
        );
      }
    }

    const finalDisplayName = displayName?.trim() ? displayName.trim() : applicantName.trim();

    const { data: sponsor, error: dbError } = await supabaseAdmin
      .from('sponsors')
      .insert({
        tier,
        applicant_name: applicantName.trim(),
        display_name: finalDisplayName,
        is_public: Boolean(isPublic),
        email: email.trim(),
        payment_method: paymentMethod === 'invoice' ? 'invoice' : 'card',
        status: 'pending',
      })
      .select()
      .single();

    if (dbError || !sponsor) {
      console.error('Supabase insert error:', dbError);
      return NextResponse.json({ error: 'データベース登録に失敗しました' }, { status: 500 });
    }

    if (tier === 'corporate' || tier === 'store') {
      await supabaseAdmin.from('sponsor_assets').insert({
        sponsor_id: sponsor.id,
        industry: industry || '',
        address: address || '',
        contact_note: contactNote || '',
      });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    if (paymentMethod === 'invoice' && (tier === 'corporate' || tier === 'store')) {
      const customer = await stripe.customers.create({
        email: email.trim(),
        name: applicantName.trim(),
        metadata: {
          sponsorId: sponsor.id,
          tier,
        },
      });

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: PRICE_MAP[tier]! }],
        collection_method: 'send_invoice',
        days_until_due: 14,
        metadata: {
          sponsorId: sponsor.id,
          tier,
        },
      });

      await supabaseAdmin
        .from('sponsors')
        .update({
          stripe_customer_id: customer.id,
          stripe_subscription_id: subscription.id,
          // 請求書払いは入金確認（Webhook invoice.paid）まで有効化しない
          status: 'pending',
        })
        .eq('id', sponsor.id);

      // 最初の請求書は「下書き」で作られ、そのままだと約1時間後まで確定・送信されない。
      // 申込と同時に確定して、Stripeから請求書メールを送る
      let invoiceUrl: string | null = null;
      const latest = subscription.latest_invoice;
      const invoiceId = typeof latest === 'string' ? latest : latest?.id;
      if (invoiceId) {
        try {
          const current = await stripe.invoices.retrieve(invoiceId);
          const finalized =
            current.status === 'draft' ? await stripe.invoices.finalizeInvoice(invoiceId) : current;
          const sent = await stripe.invoices.sendInvoice(finalized.id!);
          invoiceUrl = sent.hosted_invoice_url ?? finalized.hosted_invoice_url ?? null;
        } catch (err) {
          console.error('請求書の確定・送信に失敗しました:', err);
        }
      }

      await sendInvoiceAppliedMails(
        {
          id: sponsor.id,
          tier,
          applicant_name: applicantName.trim(),
          display_name: finalDisplayName,
          email: email.trim(),
          payment_method: 'invoice',
        },
        invoiceUrl
      );

      return NextResponse.json({
        url: `${siteUrl}/thanks?method=invoice&name=${encodeURIComponent(finalDisplayName)}`,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email.trim(),
      line_items: [
        {
          price: PRICE_MAP[tier]!,
          quantity: 1,
        },
      ],
      metadata: {
        sponsorId: sponsor.id,
        tier,
      },
      subscription_data: {
        metadata: {
          sponsorId: sponsor.id,
          tier,
        },
      },
      success_url: `${siteUrl}/thanks?session_id={CHECKOUT_SESSION_ID}&name=${encodeURIComponent(finalDisplayName)}`,
      cancel_url: `${siteUrl}/#plans`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Checkout API Error:', err);
    return NextResponse.json(
      { error: err.message || '決済セッションの作成に失敗しました' },
      { status: 500 }
    );
  }
}
