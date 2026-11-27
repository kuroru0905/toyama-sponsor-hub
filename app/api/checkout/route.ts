import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { TIER_CAPS } from '@/lib/tierCaps';
import { sendInvoiceAppliedMails } from '@/lib/sponsorMails';
import { EVENT_PRICES, isEventTier, paidCount, sponsorableEvents } from '@/lib/eventSponsorship';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

// 申し込めるプラン。企業・お店は「イベント1回ごと」の単発払い（金額は lib/eventSponsorship.ts）、
// ファンサポーター枠だけ月額サブスク（Stripeの価格ID）
const PLANS: Record<string, true> = { corporate: true, store: true, fan: true };
const FAN_PRICE = process.env.STRIPE_PRICE_FAN;
const TIER_NAME: Record<'corporate' | 'store', string> = { corporate: '企業プレミアム枠', store: '店舗ローカル枠' };

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

const jstDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' });

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: '申込内容を読み取れませんでした' }, { status: 400 });
    }
    // プランは決まった3つだけ（"constructor" などの名前で通り抜けないよう、自分のキーか確かめる）
    const tier = typeof body.tier === 'string' && Object.prototype.hasOwnProperty.call(PLANS, body.tier) ? body.tier : '';
    if (!tier || (tier === 'fan' && !FAN_PRICE)) {
      return NextResponse.json({ error: '無効なプランが指定されました' }, { status: 400 });
    }
    const business = isEventTier(tier);

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
    // 請求書払いは企業・お店だけ
    const paymentMethod = business && body.paymentMethod === 'invoice' ? 'invoice' : 'card';

    // 企業・お店：協賛するイベント（公開中・中止なし・開催7日前まで）
    let event: { id: string; title: string; venue: string; starts_at: string } | null = null;
    if (business) {
      const eventId = typeof body.eventId === 'string' ? body.eventId : '';
      event = (await sponsorableEvents()).find((e) => e.id === eventId) ?? null;
      if (!event) {
        return NextResponse.json({ error: '協賛するイベントを選んでください（受付は開催の7日前までです）' }, { status: 400 });
      }
    }

    // 連続申込の制限：同じメールアドレスで10分以内の申込があれば断る（契約の登録・イベントへの協賛のどちらでも）
    {
      const since = new Date(Date.now() - SAME_EMAIL_WINDOW_MS).toISOString();
      const [a, b] = await Promise.all([
        supabaseAdmin.from('sponsors').select('id', { count: 'exact', head: true }).eq('email', email).gte('created_at', since),
        supabaseAdmin
          .from('event_sponsorships')
          .select('id, sponsors!inner(email)', { count: 'exact', head: true })
          .eq('sponsors.email', email)
          .gte('created_at', since),
      ]);
      if ((a.count ?? 0) + (b.count ?? 0) > 0) {
        return NextResponse.json(
          { error: '同じメールアドレスでのお申し込みを受け付けたばかりです。届いたメールをご確認ください（10分ほどあけて再度お試しいただけます）' },
          { status: 429 }
        );
      }
    }
    // 全体：1時間あたりの申込件数を制限
    {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const [a, b] = await Promise.all([
        supabaseAdmin.from('sponsors').select('id', { count: 'exact', head: true }).gte('created_at', since),
        supabaseAdmin.from('event_sponsorships').select('id', { count: 'exact', head: true }).gte('created_at', since),
      ]);
      if ((a.count ?? 0) + (b.count ?? 0) >= ALL_HOURLY_LIMIT) {
        return NextResponse.json({ error: 'ただいまお申し込みが混み合っています。時間をおいてもう一度お試しください' }, { status: 429 });
      }
    }
    // 請求書払い：全体で1時間あたりの件数を制限（他人のメールアドレスに請求書を送りつける悪用を防ぐ）
    if (paymentMethod === 'invoice') {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabaseAdmin
        .from('event_sponsorships')
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

    // 枠の上限（企業6社・お店20店）はイベントごと
    if (business && event) {
      const cap = TIER_CAPS[tier];
      if (cap !== undefined && (await paidCount(event.id, tier)) >= cap) {
        return NextResponse.json(
          { error: `このイベントの${tier === 'corporate' ? '企業' : 'お店'}の協賛は満枠（${cap}${tier === 'corporate' ? '社' : '店'}）です` },
          { status: 409 }
        );
      }
    }

    const finalDisplayName = displayName || applicantName;

    // 会社・お店の登録情報：同じメールアドレス・同じ枠の登録があれば使い回す（掲載名・ロゴ・クーポンを引き継ぐ）
    let sponsor: { id: string; display_name: string; stripe_customer_id: string | null } | null = null;
    if (business) {
      const { data: existing } = await supabaseAdmin
        .from('sponsors')
        .select('id, display_name, stripe_customer_id')
        .eq('email', email)
        .eq('tier', tier)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      sponsor = existing ?? null;
    }
    if (!sponsor) {
      const { data: created, error: dbError } = await supabaseAdmin
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
        .select('id, display_name, stripe_customer_id')
        .single();
      if (dbError || !created) {
        console.error('Supabase insert error:', dbError);
        return NextResponse.json({ error: 'データベース登録に失敗しました' }, { status: 500 });
      }
      sponsor = created;
      if (business) {
        await supabaseAdmin.from('sponsor_assets').insert({
          sponsor_id: created.id,
          industry,
          address,
          contact_note: contactNote,
        });
      }
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

    // ===== ファンサポーター枠：今までどおり月額サブスク（カード） =====
    if (!business) {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        customer_email: email,
        line_items: [{ price: FAN_PRICE!, quantity: 1 }],
        metadata: { sponsorId: sponsor.id, tier },
        subscription_data: { metadata: { sponsorId: sponsor.id, tier } },
        success_url: `${siteUrl}/thanks?session_id={CHECKOUT_SESSION_ID}&name=${encodeURIComponent(finalDisplayName)}`,
        cancel_url: `${siteUrl}/#plans`,
      });
      return NextResponse.json({ url: session.url });
    }

    // ===== 企業・お店：イベント1回ごとの協賛（単発） =====
    const ev = event!;
    const bizTier = tier as 'corporate' | 'store';
    const amount = EVENT_PRICES[bizTier];
    const itemName = `まちきっぷ パートナーズ ${TIER_NAME[bizTier]}の協賛：${ev.title}（${jstDate(ev.starts_at)}）`;

    // 同じイベントへの協賛がすでにあるか（支払い済み、または請求書を送付済み）
    const { data: prev } = await supabaseAdmin
      .from('event_sponsorships')
      .select('id, status, payment_method, stripe_session_id')
      .eq('sponsor_id', sponsor.id)
      .eq('event_id', ev.id)
      .in('status', ['pending', 'paid'])
      .maybeSingle();
    if (prev?.status === 'paid') {
      return NextResponse.json({ error: 'このイベントにはすでにご協賛いただいています' }, { status: 409 });
    }
    if (prev?.status === 'pending' && prev.payment_method === 'invoice') {
      return NextResponse.json({ error: 'このイベントの請求書はお送り済みです。届いたメールをご確認ください' }, { status: 409 });
    }
    if (prev?.status === 'pending') {
      // カードの決済画面を開いたまま閉じた場合：前の決済画面を無効にして、申し込み直せるようにする
      if (prev.stripe_session_id) {
        try {
          await stripe.checkout.sessions.expire(prev.stripe_session_id);
        } catch (e) {
          console.warn('前の決済画面を無効にできませんでした（期限切れ・支払い済みの可能性）', e);
          const s = await stripe.checkout.sessions.retrieve(prev.stripe_session_id).catch(() => null);
          if (s?.payment_status === 'paid') {
            return NextResponse.json({ error: 'このイベントにはすでにご協賛いただいています（反映まで少しお待ちください）' }, { status: 409 });
          }
        }
      }
      await supabaseAdmin.from('event_sponsorships').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', prev.id).eq('status', 'pending');
    }

    const { data: sponsorship, error: spErr } = await supabaseAdmin
      .from('event_sponsorships')
      .insert({ sponsor_id: sponsor.id, event_id: ev.id, tier: bizTier, amount_jpy: amount, payment_method: paymentMethod })
      .select('id, follow_end_date')
      .single();
    if (spErr || !sponsorship) {
      if (spErr?.code === '23505') {
        return NextResponse.json({ error: 'このイベントへのお申し込みを処理中です。少し時間をおいてお試しください' }, { status: 409 });
      }
      console.error('協賛の登録に失敗しました:', spErr);
      return NextResponse.json({ error: 'データベース登録に失敗しました' }, { status: 500 });
    }

    const metadata = { sponsorId: sponsor.id, sponsorshipId: sponsorship.id, eventId: ev.id, tier: bizTier, kind: 'event_sponsorship' };

    if (paymentMethod === 'invoice') {
      // 請求書払い：1回分の請求書をStripeから送る（入金確認＝Webhook invoice.paid で協賛確定）
      const customerId =
        sponsor.stripe_customer_id ??
        (await stripe.customers.create({ email, name: applicantName, metadata: { sponsorId: sponsor.id, tier: bizTier } })).id;
      if (!sponsor.stripe_customer_id) {
        await supabaseAdmin.from('sponsors').update({ stripe_customer_id: customerId }).eq('id', sponsor.id);
      }

      const invoice = await stripe.invoices.create({
        customer: customerId,
        collection_method: 'send_invoice',
        days_until_due: 14,
        pending_invoice_items_behavior: 'exclude',
        description: `${itemName}／開催後3か月のフォロー付き`,
        metadata,
      });
      await stripe.invoiceItems.create({
        customer: customerId,
        invoice: invoice.id,
        amount,
        currency: 'jpy',
        description: itemName,
        metadata,
      });
      await supabaseAdmin.from('event_sponsorships').update({ stripe_invoice_id: invoice.id }).eq('id', sponsorship.id);

      let invoiceUrl: string | null = null;
      try {
        const finalized = await stripe.invoices.finalizeInvoice(invoice.id!);
        const sent = await stripe.invoices.sendInvoice(finalized.id!);
        invoiceUrl = sent.hosted_invoice_url ?? finalized.hosted_invoice_url ?? null;
      } catch (err) {
        console.error('請求書の確定・送信に失敗しました:', err);
      }

      await sendInvoiceAppliedMails(
        { id: sponsor.id, tier: bizTier, applicant_name: applicantName, display_name: sponsor.display_name, email, payment_method: 'invoice' },
        invoiceUrl,
        { title: ev.title, startsAt: ev.starts_at, followEnd: sponsorship.follow_end_date as string, amount }
      );

      return NextResponse.json({
        url: `${siteUrl}/thanks?method=invoice&name=${encodeURIComponent(sponsor.display_name)}&event=${encodeURIComponent(ev.title)}`,
      });
    }

    // カード払い：単発の決済画面（mode: payment）
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            unit_amount: amount,
            product_data: { name: itemName, description: '開催後3か月、公式LINEなどでご紹介します（税込）' },
          },
          quantity: 1,
        },
      ],
      metadata,
      payment_intent_data: { metadata, description: itemName },
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1時間で無効（同じイベントにまた申し込めるように）
      success_url: `${siteUrl}/thanks?session_id={CHECKOUT_SESSION_ID}&name=${encodeURIComponent(sponsor.display_name)}&event=${encodeURIComponent(ev.title)}`,
      cancel_url: `${siteUrl}/#plans`,
    });
    await supabaseAdmin.from('event_sponsorships').update({ stripe_session_id: session.id }).eq('id', sponsorship.id);

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Checkout API Error:', err);
    return NextResponse.json({ error: '決済画面の作成に失敗しました。時間をおいてもう一度お試しください' }, { status: 500 });
  }
}
