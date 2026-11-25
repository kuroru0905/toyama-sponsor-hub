'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { Badge, Button, Field, Notice, Wordmark, buttonClass } from '@/components/ui';

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
      'イベント会場メインビジョンでのCM放映（マイページから相談）',
      '企業PRショート動画の制作（採用活動にも使えます・マイページから相談）',
      'Webサイト・会場パンフレットへの企業ロゴ／名称の掲載',
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
    features: ['ライブ入場者向けLINEクーポンの掲載（マイページから申請）', '会場メインビジョンでの店名掲載'],
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
      'スポンサー先行販売でチケットを先に買える・限定エリアの案内',
      '当日のライブ配信（YouTube限定公開のリンクをマイページでお知らせ）',
      'バンド・DJ・パフォーマンスの出演応募',
      '公式サイトと会場エンドロールにお名前を掲示',
    ],
  },
];

const STEPS = [
  { title: 'スポンサーが月額で支える', body: '地元の企業・お店・ファンが、それぞれ無理のない金額で毎月支えます。' },
  { title: 'ライブを開く', body: '集まったお金で、若い人が主役のライブを登別で続けて開きます。' },
  { title: '入場するとクーポンが届く', body: 'LINEで買ったチケットで入場すると、スポンサー店のクーポンが1枚使えるようになります。' },
  { title: '終演後、お店へ', body: '入場の翌日まで使えるので、そのまま街のお店に人が流れます。' },
];

// ヒーローの見本チケット（このサービスの仕組みそのものを1枚で見せる）
function SampleTicket() {
  return (
    <div
      aria-label="見本：ライブの電子チケットと、入場特典のクーポン"
      className="relative mx-auto w-full max-w-sm rounded-panel border border-line bg-paper shadow-[0_1px_0_var(--line),0_12px_32px_-12px_rgba(28,34,48,0.25)]"
      style={{ ['--notch-bg' as string]: 'var(--surface)' }}
    >
      <div className="px-6 pt-6 pb-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-ink-2">電子チケット</span>
          <Badge tone="ok">入場済み</Badge>
        </div>
        <p className="mt-3 text-2xl font-bold leading-snug">MMS ライブ</p>
        <p className="text-sm text-ink-2">登別市民会館 大ホール</p>
        <dl className="mt-4 grid grid-cols-3 gap-2">
          <div>
            <dt className="text-xs text-ink-3">日付</dt>
            <dd className="num text-2xl font-semibold">6/20</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">開演</dt>
            <dd className="num text-2xl font-semibold">18:00</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">料金</dt>
            <dd className="num text-2xl font-semibold">¥2,000</dd>
          </div>
        </dl>
      </div>
      <div className="ticket-perf" />
      <div className="rounded-b-panel bg-accent px-6 py-5 text-accent-ink">
        <p className="text-sm font-bold">入場特典</p>
        <p className="mt-1 text-lg font-bold leading-snug">スポンサー店のクーポンが1枚使えます</p>
        <p className="mt-1 text-sm">例：居酒屋〇〇 焼き鳥1本サービス（翌日23:59まで）</p>
      </div>
    </div>
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
    <div className="min-h-screen bg-paper text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-ctl focus:bg-paper focus:px-4 focus:py-2">
        本文へ移動
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-paper">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="text-lg">
            <Wordmark />
          </Link>
          <nav aria-label="ページ内" className="flex items-center gap-1 sm:gap-2">
            <a href="#how" className="hidden rounded-ctl px-3 py-2 text-[15px] text-ink-2 hover:bg-surface hover:text-ink md:inline-block">
              仕組み
            </a>
            <a href="#plans" className="hidden rounded-ctl px-3 py-2 text-[15px] text-ink-2 hover:bg-surface hover:text-ink md:inline-block">
              料金プラン
            </a>
            <a href="#supporters" className="hidden rounded-ctl px-3 py-2 text-[15px] text-ink-2 hover:bg-surface hover:text-ink md:inline-block">
              サポーター
            </a>
            <Link href="/mypage" className={buttonClass('secondary', 'sm')}>
              マイページ
            </Link>
          </nav>
        </div>
      </header>

      <main id="main">
        {/* ヒーロー */}
        <section className="border-b border-line bg-surface">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-[15px] font-bold text-brand">北海道登別市・音楽とまちのスポンサー制度</p>
              <h1 className="mt-4 text-[2rem] font-bold leading-[1.35] sm:text-5xl sm:leading-[1.3]">
                ライブの入場券を、
                <br />
                登別のお店へのきっぷに。
              </h1>
              <p className="mt-6 max-w-prose text-base leading-[1.9] text-ink-2 sm:text-lg">
                地元の企業・お店・ファンが月額で少しずつ支え、若い人が主役のライブを続けて開きます。
                入場したお客さんのLINEには、スポンサー店のクーポンが届きます。ライブの熱気が、そのまま街のお店に流れる仕組みです。
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#plans" className={buttonClass('primary', 'md')}>
                  料金プランを見る
                </a>
                <a href="#how" className={buttonClass('secondary', 'md')}>
                  仕組みを見る
                </a>
              </div>
              <p className="mt-6 text-sm text-ink-2">
                現在のサポーター <span className="num text-xl font-semibold text-ink">{sponsors.length}</span> 組
              </p>
            </div>
            <SampleTicket />
          </div>
        </section>

        {/* 仕組み（順番に意味があるので番号つき） */}
        <section id="how" className="scroll-mt-20 border-b border-line">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
            <h2 className="text-2xl font-bold sm:text-3xl">お金と人の流れ</h2>
            <p className="mt-3 max-w-prose text-ink-2">
              企画・音響・IT・動画制作はすべて外山企画が自分たちで行うので、月額のお金はイベントの運営と次の世代づくりにそのまま回ります。
            </p>
            <ol className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="border-t-2 border-ink pt-4">
                  <span className="num text-3xl font-semibold text-ink-3">{i + 1}</span>
                  <h3 className="mt-1 text-lg font-bold">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 料金プラン */}
        <section id="plans" className="scroll-mt-20 border-b border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
            <h2 className="text-2xl font-bold sm:text-3xl">料金プラン</h2>
            <p className="mt-3 max-w-prose text-ink-2">
              どのプランもマイページからいつでも解約できます。企業・お店は請求書払いも選べます。上の枠は、下の枠の特典もすべて使えます。
            </p>

            <div className="mt-10 grid gap-6 lg:grid-cols-3" style={{ ['--notch-bg' as string]: 'var(--surface)' }}>
              {PLANS.map((plan) => {
                const avail = availability[plan.id];
                const full = avail?.remaining === 0;
                return (
                  <article
                    key={plan.id}
                    id={`plan-${plan.id}`}
                    aria-labelledby={`plan-${plan.id}-name`}
                    className="flex scroll-mt-24 flex-col rounded-panel border border-line bg-paper"
                  >
                    <div className="px-6 pt-6 pb-5">
                      <div className="flex items-start justify-between gap-3">
                        <h3 id={`plan-${plan.id}-name`} className="text-xl font-bold">
                          {plan.name}
                        </h3>
                        {avail ? (
                          full ? (
                            <Badge tone="danger">満枠</Badge>
                          ) : (
                            <Badge tone="neutral">
                              残り <span className="num mx-0.5 text-sm">{avail.remaining}</span>
                              {plan.unit}
                            </Badge>
                          )
                        ) : (
                          <Badge tone="neutral">{plan.target}</Badge>
                        )}
                      </div>
                      <p className="mt-4 flex items-baseline gap-1">
                        <span className="num text-5xl font-semibold tracking-tight">¥{plan.price}</span>
                        <span className="text-sm text-ink-2">／月（税込）</span>
                      </p>
                      <p className="mt-4 text-[15px] leading-relaxed text-ink-2">{plan.lead}</p>
                    </div>

                    <div className="ticket-perf" />

                    <div className="flex flex-1 flex-col px-6 pt-5 pb-6">
                      <h4 className="text-sm font-bold text-ink-2">特典</h4>
                      {plan.includes && <p className="mt-2 text-sm font-bold text-brand">{plan.includes}</p>}
                      <ul className="mt-3 space-y-3">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2.5 text-[15px] leading-relaxed">
                            <Check aria-hidden className="mt-1 h-4 w-4 shrink-0 text-ok" strokeWidth={3} />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto pt-6">
                        {full ? (
                          <p className="rounded-ctl bg-surface px-4 py-3 text-center text-sm font-bold text-ink-2">
                            満枠のため、受付を止めています
                          </p>
                        ) : (
                          <Button block onClick={() => openModal(plan)}>
                            {plan.short}枠で申し込む
                          </Button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* サポーター一覧 */}
        <section id="supporters" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
            <h2 className="text-2xl font-bold sm:text-3xl">登別を一緒に支えている皆さん</h2>
            <p className="mt-3 text-ink-2">お名前の掲載に同意いただいた方だけを載せています。</p>

            <div className="mt-10 grid gap-10 lg:grid-cols-3">
              {[
                { tier: 'corporate' as TierType, title: '企業スポンサー', unit: '社', empty: '第1号の企業スポンサーを募集しています。' },
                { tier: 'store' as TierType, title: '店舗スポンサー・クーポン加盟店', unit: '店', empty: '加盟店を募集しています。' },
                { tier: 'fan' as TierType, title: 'ファンサポーター', unit: '名', empty: '月300円から、お名前が会場のエンドロールに載ります。' },
              ].map((g) => {
                const list = byTier(g.tier);
                return (
                  <div key={g.tier}>
                    <h3 className="flex items-baseline justify-between border-b-2 border-ink pb-2 font-bold">
                      {g.title}
                      <span className="text-sm text-ink-2">
                        <span className="num text-xl font-semibold text-ink">{list.length}</span> {g.unit}
                      </span>
                    </h3>
                    {list.length === 0 ? (
                      <p className="mt-4 text-[15px] text-ink-2">{g.empty}</p>
                    ) : (
                      <ul className="divide-y divide-line">
                        {list.map((s) => (
                          <li key={s.id} className="py-3 text-[15px] font-bold">
                            {s.display_name}
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

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Wordmark />
            <p className="mt-1 text-sm text-ink-2">北海道登別市</p>
          </div>
          <nav aria-label="フッター" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/mypage" className="py-2 text-ink-2 underline underline-offset-4 hover:text-ink">
              マイページ・解約
            </Link>
            <Link href="/privacy" className="py-2 text-ink-2 underline underline-offset-4 hover:text-ink">
              プライバシーポリシー
            </Link>
            <Link href="/tokushoho" className="py-2 text-ink-2 underline underline-offset-4 hover:text-ink">
              特定商取引法に基づく表記
            </Link>
          </nav>
        </div>
      </footer>

      {/* 申込フォーム（PCは中央のダイアログ、スマホは全画面） */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-[rgba(28,34,48,0.55)] sm:items-center sm:p-6">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="apply-title"
            className="flex h-[100dvh] w-full flex-col bg-paper sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-panel"
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
              <div>
                <p className="text-sm text-ink-2">スポンサーのお申し込み</p>
                <h2 id="apply-title" className="text-xl font-bold">
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
                className="-mr-2 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-ctl text-ink-2 hover:bg-surface"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6">
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
                      <legend className="text-[15px] font-bold">お支払い方法</legend>
                      <div className="mt-2 grid gap-3">
                        {[
                          { v: 'card' as const, t: 'クレジットカード', d: '毎月自動でお支払い。すぐに特典が使えます。' },
                          { v: 'invoice' as const, t: '請求書払い', d: '請求書をメールでお送りします。お支払いの確認後に特典が使えます。' },
                        ].map((o) => (
                          <label
                            key={o.v}
                            className={`flex cursor-pointer items-start gap-3 rounded-ctl border px-4 py-3 ${
                              paymentMethod === o.v ? 'border-brand bg-brand-soft' : 'border-line-strong bg-paper hover:bg-surface'
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
                              <span className="block font-bold">{o.t}</span>
                              <span className="block text-sm text-ink-2">{o.d}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </>
                )}
              </div>

              <div className="border-t border-line px-5 py-4 sm:px-6">
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
