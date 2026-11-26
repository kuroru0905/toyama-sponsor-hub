import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authErr,
    } = await supabaseAdmin.auth.getUser(token);

    if (authErr || !user || !user.email) {
      return NextResponse.json({ error: 'セッションが無効です' }, { status: 401 });
    }

    const { sponsorId } = await req.json();

    const { data: sponsor, error: dbErr } = await supabaseAdmin
      .from('sponsors')
      .select('stripe_customer_id')
      .eq('id', sponsorId)
      .eq('email', user.email)
      .single();

    if (dbErr || !sponsor?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'Stripeの顧客情報が見つかりません（決済完了後に利用可能になります）' },
        { status: 404 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://toyama-sponsor-hub.vercel.app';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sponsor.stripe_customer_id,
      return_url: `${siteUrl}/mypage`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err: any) {
    console.error('POST /api/portal error:', err);
    return NextResponse.json(
      { error: 'お支払い管理の画面を開けませんでした。時間をおいてもう一度お試しください' },
      { status: 500 }
    );
  }
}
