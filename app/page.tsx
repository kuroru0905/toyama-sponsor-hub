'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { Badge, Button, Em, Field, Headline, Notice, TIER_METAL, Wordmark, buttonClass, rich } from '@/components/ui';
import { Shelf, Tilt } from '@/components/motion';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

type TierType = 'corporate' | 'store' | 'fan';

interface Sponsor {
  id: string;
  tier: TierType;
  display_name: string;
  created_at: string;
}

type Plan = {
  id: TierType;
  name: string;
  short: string;
  price: string;
  target: string;
  unit: string;
  lead: string;
  includes: string;
  features: string[];
};

const PLANS: Plan[] = [
  {
    id: 'corporate',
    name: '企業プレミアム枠',
    short: '企業',
    price: '10,000',
    target: '6社まで',
    unit: '社',
    lead: '地元企業の本気を、同世代の目線で若者のスマホと会場に届けます。採用や認知づくりに。',
    includes: '店舗ローカル枠・ファンサポーター枠の特典もすべて含みます',
    features: [
      'イベント会場メインビジョンでの**CM放映**（マイページから相談）',
      '企業PR**ショート動画の制作**（採用活動にも使えます・マイページから相談）',
      'Webサイト・会場パンフレットへの**企業ロゴ／名称の掲載**',
    ],
  },
  {
    id: 'store',
    name: '店舗ローカル枠',
    short: '店舗',
    price: '3,000',
    target: '20店まで',
    unit: '店',
    lead: 'ライブに入場したお客さんのLINEに、お店のクーポンが届きます。終演後の一軒目に。',
    includes: 'ファンサポーター枠の特典もすべて含みます',
    features: ['ライブ入場者向け**LINEクーポン**の掲載（マイページから申請）', '会場メインビジョンでの**店名掲載**'],
  },
  {
    id: 'fan',
    name: 'ファンサポーター枠',
    short: 'ファン',
    price: '300',
    target: '200人が目標',
    unit: '人',
    lead: '登別に、若い人が主役になれる場所をつくり続けるための応援枠です。',
    includes: '',
    features: [
      '**スポンサー先行販売**でチケットを先に買える・限定エリアの案内',
      '当日の**ライブ配信**（YouTube限定公開のリンクをマイページでお知らせ）',
      'バンド・DJ・パフォーマンスの**出演応募**',
      '公式サイトと会場エンドロールに**お名前を掲示**',
    ],
  },
];

const STEPS = [
  { title: 'スポンサーが月額で支える', body: '地元の企業・お店・ファンが、それぞれ**無理のない金額で毎月**支えます。' },
  { title: 'ライブを開く', body: '集まったお金で、若い人が主役のライブを登別で続けて開きます。' },
  { title: '入場するとクーポンが届く', body: 'LINEで買ったチケットで入場すると、**スポンサー店のクーポンが各店1回ずつ**使えるようになります。' },
  { title: '終演後、お店をはしご', body: '**ライブの翌日まで**、何軒でも回れるので、街のお店に人が流れます。' },
];

// ヒーローの見本チケット（このサービスの仕組みそのものを1枚で見せる）
function SampleTicket() {
  return (
    <Tilt
      max={10}
      aria-label="見本：ライブの電子チケットと、入場特典のクーポン"
      className="mx-auto w-full max-w-[400px] rounded-card bg-paper shadow-[0_30px_60px_-20px_rgba(0,0,0,0.25)]"
      style={{ ['--notch-bg' as string]: 'var(--surface)' }}
    >
      <div className="metal-surface metal-silver rounded-t-card px-7 pt-7 pb-6">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-ink-2">電子チケット</span>
          <Badge tone="ok">入場済み</Badge>
        </div>
        <p className="mt-4 text-[28px] font-semibold leading-tight tracking-tight">MMS ライブ</p>
        <p className="mt-1 text-[15px] text-ink-2">登別市民会館 大ホール</p>
        <dl className="mt-6 grid grid-cols-3 gap-3">
          {[
            ['日付', '6/20'],
            ['開演', '18:00'],
            ['料金', '¥2,000'],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[12px] text-ink-2">{k}</dt>
              <dd className="num text-[24px] font-semibold tracking-tight">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="ticket-perf" />
      <div className="metal-surface metal-cobalt rounded-b-card px-7 py-6">
        <p className="metal-sub text-[13px] font-medium">入場特典</p>
        <p className="mt-1 text-[19px] font-semibold leading-snug">お店のクーポンが各店で使えます</p>
        <p className="metal-sub mt-1 text-[14px]">例：居酒屋〇〇の焼き鳥1本サービス。はしごOK・翌日23:59まで。</p>
      </div>
    </Tilt>
  );
}

export default function SponsorHubPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [availability, setAvailability] = useState<Record<string, { cap: number; remaining: number }>>({});

  const [applicantName, setApplicantName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [email, setEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'invoice'>('card');
  const [industry, setIndustry] = useState('');
  const [address, setAddress] = useState('');
  const [contactNote] = useState('');

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const fetchSponsors = async () => {
    const { data, error } = await supabase
      .from('sponsors')
      .select('id, tier, display_name, created_at')
      .eq('status', 'active')
      .eq('is_public', true)
      .order('created_at', { ascending: false });
    if (!error && data) setSponsors(data as Sponsor[]);
  };

  useEffect(() => {
    fetch('/api/availability', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setAvailability(j.availability ?? {}))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchSponsors();
    const channel = supabase
      .channel('realtime-sponsors')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sponsors' }, () => {
        fetchSponsors();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 申込フォームを開いている間：背景のスクロールを止め、Escで閉じ、最初の欄にフォーカス
  useEffect(() => {
    if (!selectedPlan) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => firstFieldRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) setSelectedPlan(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [selectedPlan, loading]);

  const openModal = (plan: Plan) => {
    setSelectedPlan(plan);
    setPaymentMethod('card');
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: selectedPlan.id,
          applicantName,
          displayName,
          isPublic,
          email,
          paymentMethod,
          industry,
          address,
          contactNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'お申し込みを完了できませんでした。時間をおいてもう一度お試しください');
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      setErrorMsg(err.message);
      setLoading(false);
    }
  };

  const byTier = (t: TierType) => sponsors.filter((s) => s.tier === t);
  const isBusiness = selectedPlan?.id === 'corporate' || selectedPlan?.id === 'store';

  return (
    <div className="min-h-screen text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-paper focus:px-4 focus:py-2">
        本文へ移動
      </a>

      <header className="glass sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex h-[52px] max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="text-[17px]">
            <Wordmark />
          </Link>
          <nav aria-label="ページ内" className="flex items-center gap-1 sm:gap-4">
            {[
              ['#how', '仕組み'],
              ['#plans', '料金プラン'],
              ['#supporters', 'サポーター'],
            ].map(([href, label]) => (
              <a key={href} href={href} className="hidden px-2 py-2 text-[13px] text-ink-2 hover:text-ink md:inline-block">
                {label}
              </a>
            ))}
            <Link href="/mypage" className="px-2 py-2 text-[13px] text-ink-2 hover:text-ink">
              マイページ
            </Link>
            <a href="#plans" className={buttonClass('primary', 'sm')}>
              申し込む
            </a>
          </nav>
        </div>
      </header>

      <main id="main">
        {/* ヒーロー */}
        <section className="overflow-hidden">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-14 pb-20 sm:pt-20 lg:grid-cols-[1.25fr_1fr] lg:pt-24 lg:pb-28">
            <div>
              <p className="text-[17px] font-semibold">
                <span className="text-brand">まちきっぷ</span>
                <span className="ml-3 text-ink-2">若者と地元企業をつなぐ、登別のスポンサー制度</span>
              </p>
              <h1 className="mt-4 text-[40px] font-semibold leading-[1.15] tracking-tight sm:text-[64px] sm:leading-[1.08]">
                <span className="inline-block">ライブの入場券を、</span>
                <span className="inline-block">お店へのきっぷに。</span>
              </h1>
              <p className="mt-6 max-w-[34rem] text-[19px] leading-[1.6] text-ink-2 sm:text-[21px]">
                地元の企業・お店・ファンが月額で少しずつ支え、若い人が主役のライブを続けて開く。ライブに来た若者は、LINEに届く<Em>スポンサーのクーポン</Em>で、地元のお店や企業と出会う。
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
                <a href="#plans" className={buttonClass('primary', 'md')}>
                  料金プランを見る
                </a>
                <a href="#how" className="inline-flex min-h-[44px] items-center text-[17px] text-brand hover:underline underline-offset-4">
                  仕組みを見る ›
                </a>
              </div>
              <p className="mt-10 text-[15px] text-ink-2">
                いま <span className="num text-[21px] font-semibold text-ink">{sponsors.length}</span> 組のサポーターが参加しています
              </p>
            </div>
            <SampleTicket />
          </div>
        </section>

        {/* 仕組み（順番に意味があるので番号つき） */}
        <section id="how" className="scroll-mt-16 pb-16 sm:pb-24">
          <div className="mx-auto max-w-6xl px-4">
            <Headline lead="仕組み。" rest="ライブの熱気が、街のお店に流れるまで。" />
          </div>
          <div className="mt-8">
            <Shelf ariaLabel="仕組み">
              {STEPS.map((st, i) => (
                <article key={st.title} className="card card-lift flex min-h-[320px] flex-col p-8">
                  <span className="num text-[56px] font-semibold leading-none tracking-tight text-brand">{i + 1}</span>
                  <h3 className="mt-auto text-[24px] font-semibold leading-snug">{st.title}</h3>
                  <p className="mt-3 text-[17px] leading-relaxed text-ink-2">{rich(st.body)}</p>
                </article>
              ))}
            </Shelf>
          </div>
        </section>

        {/* 料金プラン */}
        <section id="plans" className="scroll-mt-16 pb-16 sm:pb-24">
          <div className="mx-auto max-w-6xl px-4">
            <Headline lead="料金プラン。" rest="月300円から、登別のライブを支えられます。" />
          </div>
          <div className="mt-8" style={{ ['--notch-bg' as string]: 'var(--surface)' }}>
            <Shelf ariaLabel="料金プラン">
              {PLANS.map((plan) => {
                const avail = availability[plan.id];
                const full = avail?.remaining === 0;
                return (
                  <Tilt
                    as="article"
                    key={plan.id}
                    touch={false}
                    max={4}
                    id={`plan-${plan.id}`}
                    aria-labelledby={`plan-${plan.id}-name`}
                    className="card flex h-full scroll-mt-24 flex-col"
                  >
                    <div className={`metal-surface ${TIER_METAL[plan.id]} rounded-t-card px-8 pt-8 pb-6`}>
                      <div className="flex items-start justify-between gap-3">
                        <h3 id={`plan-${plan.id}-name`} className="text-[24px] font-semibold">
                          {plan.name}
                        </h3>
                        {avail ? (
                          full ? (
                            <Badge tone="danger">満枠</Badge>
                          ) : (
                            <Badge tone="neutral">
                              残り <span className="num mx-0.5">{avail.remaining}</span>
                              {plan.unit}
                            </Badge>
                          )
                        ) : (
                          <Badge tone="neutral">{plan.target}</Badge>
                        )}
                      </div>
                      <p className="mt-5 flex items-baseline gap-1.5">
                        <span className="num text-[40px] font-semibold leading-none tracking-tight sm:text-[48px]">¥{plan.price}</span>
                        <span className="whitespace-nowrap text-[15px] text-ink-2">／月（税込）</span>
                      </p>
                      <p className="mt-5 text-[17px] leading-relaxed text-ink-2">{plan.lead}</p>
                    </div>

                    <div className="ticket-perf mx-0" />

                    <div className="flex flex-1 flex-col px-8 pt-6 pb-8">
                      {plan.includes && <p className="text-[15px] font-semibold text-brand">{plan.includes}</p>}
                      <ul className={`${plan.includes ? 'mt-4' : ''} space-y-3`}>
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-3 text-[15px] leading-relaxed">
                            <Check aria-hidden className="mt-1 h-4 w-4 shrink-0 text-brand" strokeWidth={2.6} />
                            <span>{rich(f)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto pt-8">
                        {full ? (
                          <p className="rounded-full bg-surface px-4 py-3 text-center text-[15px] text-ink-2">満枠のため、受付を止めています</p>
                        ) : (
                          <Button block onClick={() => openModal(plan)}>
                            {plan.short}枠で申し込む
                          </Button>
                        )}
                      </div>
                    </div>
                  </Tilt>
                );
              })}
            </Shelf>
            <p className="mx-auto max-w-6xl px-4 text-[15px] leading-relaxed text-ink-2">
              上の枠は、下の枠の特典もすべて使えます。どのプランもマイページから<Em>いつでも解約</Em>できます。企業・お店は<Em>請求書払い</Em>も選べます。
            </p>
          </div>
        </section>

        {/* サポーター一覧 */}
        <section id="supporters" className="scroll-mt-16 pb-24">
          <div className="mx-auto max-w-6xl px-4">
            <Headline lead="サポーター。" rest="登別を一緒に支えている皆さん。" />
            <p className="mt-3 text-[15px] text-ink-2">お名前の掲載に同意いただいた方だけを載せています。</p>
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {[
                { tier: 'corporate' as TierType, title: '企業スポンサー', unit: '社', empty: '第1号の企業スポンサーを募集しています。' },
                { tier: 'store' as TierType, title: '店舗スポンサー・クーポン加盟店', unit: '店', empty: '加盟店を募集しています。' },
                { tier: 'fan' as TierType, title: 'ファンサポーター', unit: '名', empty: '月300円から、お名前が会場のエンドロールに載ります。' },
              ].map((g) => {
                const list = byTier(g.tier);
                return (
                  <div key={g.tier} className="card p-8">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="flex items-center gap-2 text-[19px] font-semibold"><span className={`metal-dot ${TIER_METAL[g.tier]}`} aria-hidden />{g.title}</h3>
                      <span className="text-[15px] text-ink-2">
                        <span className="num text-[28px] font-semibold text-ink">{list.length}</span> {g.unit}
                      </span>
                    </div>
                    {list.length === 0 ? (
                      <p className="mt-4 text-[15px] leading-relaxed text-ink-2">{g.empty}</p>
                    ) : (
                      <ul className="mt-4 divide-y divide-line">
                        {list.map((sp) => (
                          <li key={sp.id} className="py-3 text-[17px]">
                            {sp.display_name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-8 text-[12px] leading-relaxed text-ink-2">
          <p>まちきっぷは外山企画が運営しています。スポンサー・サポーターの月額料金はすべて税込です。チケットの購入と入場特典クーポンは、外山企画の公式LINEから利用できます。</p>
          <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p>Copyright © {new Date().getFullYear()} 外山企画（北海道登別市）</p>
            <nav aria-label="フッター" className="flex flex-wrap gap-x-5 gap-y-1">
              <Link href="/mypage" className="py-1 hover:underline">
                マイページ・解約
              </Link>
              <Link href="/privacy" className="py-1 hover:underline">
                プライバシーポリシー
              </Link>
              <Link href="/tokushoho" className="py-1 hover:underline">
                特定商取引法に基づく表記
              </Link>
            </nav>
          </div>
        </div>
      </footer>

      {/* 申込フォーム（PCは中央のダイアログ、スマホは全画面） */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-[rgba(0,0,0,0.4)] backdrop-blur-sm sm:items-center sm:p-6">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="apply-title"
            className="flex h-[100dvh] w-full flex-col bg-paper sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-card sm:shadow-card-hover"
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-8 sm:py-6">
              <div>
                <p className="text-[13px] text-ink-2">スポンサーのお申し込み</p>
                <h2 id="apply-title" className="text-[24px] font-semibold">
                  {selectedPlan.name}
                  <span className="ml-2 text-base font-normal text-ink-2">
                    月額 <span className="num text-lg font-semibold text-ink">¥{selectedPlan.price}</span>（税込）
                  </span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => !loading && setSelectedPlan(null)}
                aria-label="閉じる"
                className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-ink-2 hover:bg-line"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-7 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8">
                <Field
                  label={selectedPlan.id === 'fan' ? 'お名前（本名）' : '法人名・店舗名'}
                  htmlFor="applicantName"
                  required
                  hint={selectedPlan.id === 'fan' ? '記入例：登別 太郎' : '記入例：株式会社〇〇、居酒屋〇〇'}
                >
                  <input
                    ref={firstFieldRef}
                    id="applicantName"
                    type="text"
                    required
                    autoComplete={selectedPlan.id === 'fan' ? 'name' : 'organization'}
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    className="field-input"
                  />
                </Field>

                <Field
                  label="サイト・会場に載せるお名前"
                  htmlFor="displayName"
                  optional
                  hint="ニックネームでも大丈夫です。空欄なら上のお名前を載せます。"
                >
                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="field-input"
                  />
                  <label className="mt-3 flex min-h-[44px] cursor-pointer items-center gap-3 text-[15px]">
                    <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                    公式サイトとイベント会場にお名前を載せる
                  </label>
                </Field>

                <Field
                  label="メールアドレス"
                  htmlFor="email"
                  required
                  hint="領収書やご案内を送ります。マイページへのログインにも使います。"
                >
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="field-input"
                  />
                </Field>

                {isBusiness && (
                  <>
                    <Field label="業種" htmlFor="industry" optional hint="記入例：飲食店、建設業">
                      <input id="industry" type="text" value={industry} onChange={(e) => setIndustry(e.target.value)} className="field-input" />
                    </Field>
                    <Field label="お店・事業所のエリア" htmlFor="address" optional hint="記入例：登別市中央町、幌別町">
                      <input id="address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="field-input" />
                    </Field>

                    <fieldset>
                      <legend className="text-[15px] font-semibold">お支払い方法</legend>
                      <div className="mt-2 grid gap-3">
                        {[
                          { v: 'card' as const, t: 'クレジットカード', d: '毎月自動でお支払い。すぐに特典が使えます。' },
                          { v: 'invoice' as const, t: '請求書払い', d: '請求書をメールでお送りします。お支払いの確認後に特典が使えます。' },
                        ].map((o) => (
                          <label
                            key={o.v}
                            className={`flex cursor-pointer items-start gap-3 rounded-ctl border px-4 py-3 ${
                              paymentMethod === o.v ? 'border-brand bg-brand-soft shadow-[0_0_0_1px_var(--brand)]' : 'border-line bg-paper hover:bg-surface'
                            }`}
                          >
                            <input
                              type="radio"
                              name="paymentMethod"
                              className="mt-1"
                              checked={paymentMethod === o.v}
                              onChange={() => setPaymentMethod(o.v)}
                            />
                            <span>
                              <span className="block font-semibold">{o.t}</span>
                              <span className="block text-sm text-ink-2">{o.d}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </>
                )}
              </div>

              <div className="border-t border-line px-5 py-4 sm:px-8 sm:py-5">
                {errorMsg && (
                  <Notice tone="danger" className="mb-3">
                    {errorMsg}
                  </Notice>
                )}
                <Button type="submit" block disabled={loading}>
                  {loading
                    ? '手続きの画面へ移動しています…'
                    : paymentMethod === 'invoice' && isBusiness
                      ? '請求書を発行して申し込む'
                      : 'カード決済の画面へ進む'}
                </Button>
                <p className="mt-2 text-center text-xs text-ink-2">
                  お申し込みの前に
                  <Link href="/tokushoho" className="mx-1 underline underline-offset-2" target="_blank">
                    特定商取引法に基づく表記
                  </Link>
                  と
                  <Link href="/privacy" className="mx-1 underline underline-offset-2" target="_blank">
                    プライバシーポリシー
                  </Link>
                  をご確認ください。
                </p>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
