import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-10-28.acacia',
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
          status: 'active',
        })
        .eq('id', sponsor.id);

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
