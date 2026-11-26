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

// 文字列の項目だけ受け取り、前後の空白を除いて長さを制限する（型の違う値・長すぎる値は 400）
function text(body: Record<string, unknown>, key: string, label: string, max: number, required = false): string {
  const v = body[key];
  if (v === undefined || v === null || v === '') {
    if (required) throw new InputError(`${label}を入力してください`);
    return '';
  }
  if (typeof v !== 'string') throw new InputError(`${label}の形式が正しくありません`);
  const s = v.trim();
  if (required && !s) throw new InputError(`${label}を入力してください`);
  if (s.length > max) throw new InputError(`${label}は${max}文字以内で入力してください`);
  return s;
}
class InputError extends Error {}

// 半角の英数字と記号だけ（引用符・全角・国際化ドメインは受け付けない：メール送信ライブラリの誤配送の脆弱性対策）
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const ALL_HOURLY_LIMIT = 30; // 申込は全体で1時間に30件まで（大量の仮登録を防ぐ）
const SAME_EMAIL_WINDOW_MS = 10 * 60 * 1000; // 同じメールアドレスからの申込は10分に1回まで
const INVOICE_HOURLY_LIMIT = 10; // 請求書払いの申込は全体で1時間に10件まで（請求書メールの悪用を防ぐ）

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: '申込内容を読み取れませんでした' }, { status: 400 });
    }
    // プランは決まった3つだけ（"constructor" などの名前で通り抜けないよう、自分のキーか確かめる）
    const tier = typeof body.tier === 'string' && Object.prototype.hasOwnProperty.call(PRICE_MAP, body.tier) ? body.tier : '';
    if (!tier || !PRICE_MAP[tier]) {
      return NextResponse.json({ error: '無効なプランが指定されました' }, { status: 400 });
    }

    let applicantName: string, displayName: string, email: string, industry: string, address: string, contactNote: string;
    try {
      applicantName = text(body, 'applicantName', 'お名前（会社名・店名）', 60, true);
      displayName = text(body, 'displayName', '掲載名', 60);
      email = text(body, 'email', 'メールアドレス', 254, true).toLowerCase();
      industry = text(body, 'industry', '業種', 60);
      address = text(body, 'address', 'エリア', 100);
      contactNote = text(body, 'contactNote', '備考', 500);
      if (!EMAIL_RE.test(email)) throw new InputError('メールアドレスの形式が正しくありません');
    } catch (err) {
      if (err instanceof InputError) return NextResponse.json({ error: err.message }, { status: 400 });
      throw err;
    }
    const isPublic = body.isPublic === true;
    const paymentMethod = body.paymentMethod === 'invoice' ? 'invoice' : 'card';

    // 連続申込の制限：同じメールアドレスで10分以内の申込があれば断る
    {
      const since = new Date(Date.now() - SAME_EMAIL_WINDOW_MS).toISOString();
      const { count } = await supabaseAdmin
        .from('sponsors')
        .select('id', { count: 'exact', head: true })
        .eq('email', email)
        .gte('created_at', since);
      if ((count ?? 0) > 0) {
        return NextResponse.json(
          { error: '同じメールアドレスでのお申し込みを受け付けたばかりです。届いたメールをご確認ください（10分ほどあけて再度お試しいただけます）' },
          { status: 429 }
        );
      }
    }
    // 全体：1時間あたりの申込件数を制限
    {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabaseAdmin
        .from('sponsors')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since);
      if ((count ?? 0) >= ALL_HOURLY_LIMIT) {
        return NextResponse.json({ error: 'ただいまお申し込みが混み合っています。時間をおいてもう一度お試しください' }, { status: 429 });
      }
    }
    // 請求書払い：全体で1時間あたりの件数を制限（他人のメールアドレスに請求書を送りつける悪用を防ぐ）
    if (paymentMethod === 'invoice') {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabaseAdmin
        .from('sponsors')
        .select('id', { count: 'exact', head: true })
        .eq('payment_method', 'invoice')
        .gte('created_at', since);
      if ((count ?? 0) >= INVOICE_HOURLY_LIMIT) {
        return NextResponse.json(
          { error: 'ただいま請求書払いのお申し込みが混み合っています。時間をおくか、カード払いでお申し込みください' },
          { status: 429 }
        );
      }
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

    const finalDisplayName = displayName || applicantName;

    const { data: sponsor, error: dbError } = await supabaseAdmin
      .from('sponsors')
      .insert({
        tier,
        applicant_name: applicantName,
        display_name: finalDisplayName,
        is_public: isPublic,
        email,
        payment_method: paymentMethod,
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
        industry,
        address,
        contact_note: contactNote,
      });
    }

    // マイページにログインできるよう、ログイン用のユーザーを作っておく
    // （ログインのメールは登録済みのアドレスにしか送らない設定にしているため。すでにあれば何もしない）
    {
      const { error: userError } = await supabaseAdmin.auth.admin.createUser({ email, email_confirm: true });
      if (userError && !/already|registered|exists/i.test(userError.message)) {
        console.error('ログイン用ユーザーの作成に失敗しました:', userError.message);
      }
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    if (paymentMethod === 'invoice' && (tier === 'corporate' || tier === 'store')) {
      const customer = await stripe.customers.create({
        email,
        name: applicantName,
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
          applicant_name: applicantName,
          display_name: finalDisplayName,
          email,
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
      customer_email: email,
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
