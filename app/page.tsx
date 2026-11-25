'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import {
  Building2,
  Store,
  Heart,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Music,
  Smartphone,
  X,
  UserCircle,
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type TierType = 'corporate' | 'store' | 'fan';

interface Sponsor {
  id: string;
  tier: TierType;
  display_name: string;
  created_at: string;
}

const PLANS = [
  {
    id: 'corporate' as TierType,
    name: '企業プレミアム枠',
    price: '10,000',
    target: '6社限定',
    badge: '採用・認知拡大',
    icon: Building2,
    accent: 'border-orange-500/60 bg-gradient-to-b from-orange-950/30 to-zinc-900',
    btnColor: 'bg-orange-500 hover:bg-orange-400 text-zinc-950',
    description: '地元企業の「カッコいい本気」を同世代目線で翻訳し、若者のスマホと会場へ直接届けます。',
    includes: '店舗ローカル枠・ファンサポーター枠の特典もすべて利用できます',
    features: [
      'イベント会場メインビジョンでのCM放映',
      '企業PRショート動画の制作（採用活動へ二次利用可）',
      '会場内企業ブースの優先出展権',
      'Webサイト・会場パンフレットへの企業ロゴ/名称掲載',
    ],
  },
  {
    id: 'store' as TierType,
    name: '店舗ローカル枠',
    price: '3,000',
    target: '20店限定',
    badge: '集客・送客直結',
    icon: Store,
    accent: 'border-teal-500/60 bg-gradient-to-b from-teal-950/30 to-zinc-900',
    btnColor: 'bg-teal-400 hover:bg-teal-300 text-zinc-950',
    description: 'イベント会場の熱気と観光客（外貨）を、ライブ入場者向けのLINEクーポンで実店舗へ送客します。',
    includes: 'ファンサポーター枠の特典もすべて利用できます',
    features: [
      'SNS告知用PR画像・ショップカード素材の制作',
      '会場内スポンサー看板への店舗名掲載',
    ],
  },
  {
    id: 'fan' as TierType,
    name: 'ファンサポーター枠',
    price: '300',
    target: '200人目標',
    badge: '気軽に応援',
    icon: Heart,
    accent: 'border-amber-400/60 bg-gradient-to-b from-amber-950/30 to-zinc-900',
    btnColor: 'bg-amber-400 hover:bg-amber-300 text-zinc-950',
    description: '登別に「若者が主役となって楽しめる場」を創り続けるための、気軽に参加できるコミュニティ枠です。',
    includes: '',
    features: [
      '主催イベントの優先購入券・限定エリア案内',
      'ステージパフォーマンス・DJ/バンド出演応募権',
      '公式サイト＆会場エンドロールへのサポーター名掲示',
      'サポーター限定LINEオープンチャット・先行情報',
    ],
  },
];

export default function SponsorHubPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<(typeof PLANS)[0] | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [applicantName, setApplicantName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [email, setEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'invoice'>('card');
  const [industry, setIndustry] = useState('');
  const [address, setAddress] = useState('');
  const [contactNote, setContactNote] = useState('');

  const fetchSponsors = async () => {
    const { data, error } = await supabase
      .from('sponsors')
      .select('id, tier, display_name, created_at')
      .eq('status', 'active')
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSponsors(data as Sponsor[]);
    }
  };

  useEffect(() => {
    fetchSponsors();

    const channel = supabase
      .channel('realtime-sponsors')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sponsors' },
        () => {
          fetchSponsors();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const openModal = (plan: (typeof PLANS)[0]) => {
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
      if (!res.ok) {
        throw new Error(data.error || 'エラーが発生しました');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setErrorMsg(err.message);
      setLoading(false);
    }
  };

  const corporateSponsors = sponsors.filter((s) => s.tier === 'corporate');
  const storeSponsors = sponsors.filter((s) => s.tier === 'store');
  const fanSponsors = sponsors.filter((s) => s.tier === 'fan');

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-teal-400 selection:text-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-teal-400 animate-pulse" />
            <span className="font-bold tracking-wider text-white">外山企画</span>
            <span className="hidden md:inline text-xs text-zinc-400 border-l border-zinc-700 pl-2">
              登別地域還元型エンタメ×ITプロジェクト
            </span>
          </div>
          <nav className="flex items-center gap-4 sm:gap-6 text-sm">
            <a href="#vision" className="hidden sm:inline text-zinc-400 hover:text-white transition">
              ビジョン
            </a>
            <a href="#plans" className="hidden sm:inline text-zinc-400 hover:text-white transition">
              スポンサー枠
            </a>
            <a href="#supporters" className="hidden sm:inline text-zinc-400 hover:text-white transition">
              サポーター一覧
            </a>
            <Link
              href="/mypage"
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-zinc-200 hover:bg-zinc-800 transition"
            >
              <UserCircle className="h-4 w-4 text-teal-400" />
              マイページ
            </Link>
            <a
              href="#plans"
              className="rounded-full bg-teal-400 px-4 py-1.5 text-xs sm:text-sm font-bold text-zinc-950 hover:bg-teal-300 transition"
            >
              参画する
            </a>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-zinc-800/80 py-20 sm:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.12),transparent_50%)]" />
        <div className="mx-auto max-w-5xl px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-1.5 text-xs font-semibold text-teal-300 mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            音楽×ITで若者と地元企業を結ぶ「地域還元型」エコシステム
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6">
            登別に、<span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-emerald-300 to-amber-300">楽しめる場</span>と
            <br />
            <span className="text-white">仕事が循環する仕組み</span>を創る。
          </h1>
          <p className="mx-auto max-w-2xl text-base sm:text-lg text-zinc-400 leading-relaxed mb-10">
            大口1社に依存せず、地元企業・店舗・ファンの皆様が少しずつ支え合う「3層スポンサーモデル」。
            イベントの熱気と観光客の外貨を、独自開発のLINE O2Oシステムで確実に地元の店舗・雇用へと還元します。
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#plans"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-teal-400 px-8 py-4 text-base font-bold text-zinc-950 hover:bg-teal-300 transition shadow-lg shadow-teal-500/20"
            >
              スポンサープランを見る
              <ArrowRight className="h-5 w-5" />
            </a>
            <a
              href="#supporters"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-8 py-4 text-base font-semibold text-zinc-200 hover:bg-zinc-800 transition"
            >
              現在のサポーター ({sponsors.length}組)
            </a>
          </div>
        </div>
      </section>

      <section id="vision" className="border-b border-zinc-800/80 py-16 bg-zinc-900/40">
        <div className="mx-auto max-w-5xl px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400">
                <Music className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold mb-2">1. 音楽イベントで熱狂を創出</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                若者が主役となる音楽×PA演出空間を登別に創出。市外からの集客と地元学生の居場所を同時に生み出します。
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
                <Smartphone className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold mb-2">2. LINE O2Oで店舗・企業へ送客</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                電子チケットと入場特典のLINEクーポンにより、イベント終了後の来場者を下町の飲食店・地元企業へ誘導します。
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold mb-2">3. 固定費ゼロの盤石な循環モデル</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                企画・音響・IT・動画制作をすべて内製化。サブスク収益はイベント運営と次世代育成へ透明性高く再投資されます。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="plans" className="py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-4xl font-extrabold mb-3">
              3層サブスク・スポンサー枠
            </h2>
            <p className="text-zinc-400 text-sm sm:text-base">
              すべてのプランはいつでもマイページ・メールから解約可能。企業・店舗様は請求書払いにも対応しています。
            </p>
            <p className="mt-3 inline-block rounded-full border border-teal-500/40 bg-teal-500/10 px-4 py-1.5 text-xs sm:text-sm font-bold text-teal-300">
              上位の枠は、下位の枠の特典もすべてご利用いただけます
            </p>
          </div>

          <div className="lg:hidden sticky top-[63px] z-30 -mx-4 mb-6 flex gap-2 overflow-x-auto bg-zinc-950/90 px-4 py-2 backdrop-blur-md">
            {PLANS.map((plan) => (
              <a
                key={plan.id}
                href={`#plan-${plan.id}`}
                className="flex-1 shrink-0 text-center rounded-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-bold text-zinc-200"
              >
                {({ corporate: '企業', store: '店舗', fan: 'ファン' } as Record<string, string>)[plan.id]} ¥{plan.price}
              </a>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            {PLANS.map((plan) => {
              const Icon = plan.icon;
              return (
                <div
                  key={plan.id}
                  id={`plan-${plan.id}`}
                  className={`scroll-mt-32 flex flex-col justify-between rounded-3xl border p-5 sm:p-8 transition hover:-translate-y-1 ${plan.accent}`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-200">
                        <Icon className="h-3.5 w-3.5" />
                        {plan.badge}
                      </span>
                      <span className="text-xs font-bold text-zinc-400">{plan.target}</span>
                    </div>

                    <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-4xl font-extrabold tracking-tight text-white">
                        ¥{plan.price}
                      </span>
                      <span className="text-sm text-zinc-400">/ 月（税込）</span>
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed mb-6">
                      {plan.description}
                    </p>

                    <div className="border-t border-zinc-800 pt-6 mb-8">
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4">
                        主なリターン・特典
                      </p>
                      {plan.includes && (
                        <p className="mb-3 rounded-lg bg-zinc-800/70 px-3 py-2 text-xs font-bold text-teal-300">
                          ＋ {plan.includes}
                        </p>
                      )}
                      <ul className="space-y-3">
                        {plan.features.map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 text-sm text-zinc-200">
                            <CheckCircle2 className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <button
                    onClick={() => openModal(plan)}
                    className={`w-full rounded-xl py-3.5 px-6 font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer ${plan.btnColor}`}
                  >
                    この枠で申し込む
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="supporters" className="border-t border-zinc-800/80 py-20 bg-zinc-900/30">
        <div className="mx-auto max-w-5xl px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-teal-400 uppercase tracking-widest mb-2">
              <span className="h-2 w-2 rounded-full bg-teal-400 animate-ping" />
              REALTIME SUPPORTERS
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold">
              登別の未来を共に創るサポーターの皆様
            </h2>
          </div>

          <div className="space-y-10">
            <div>
              <h3 className="text-sm font-bold text-orange-400 border-b border-zinc-800 pb-2 mb-4">
                ■ 企業プレミアムスポンサー（{corporateSponsors.length}社）
              </h3>
              {corporateSponsors.length === 0 ? (
                <p className="text-sm text-zinc-500">現在募集受付中です（第1号スポンサー募集中！）</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {corporateSponsors.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-orange-500/30 bg-zinc-900 px-5 py-4 font-bold text-white shadow-sm"
                    >
                      {s.display_name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-bold text-teal-400 border-b border-zinc-800 pb-2 mb-4">
                ■ 店舗ローカルスポンサー・クーポン加盟店（{storeSponsors.length}店）
              </h3>
              {storeSponsors.length === 0 ? (
                <p className="text-sm text-zinc-500">現在加盟店舗を募集受付中です</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {storeSponsors.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-teal-500/30 bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-100"
                    >
                      {s.display_name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-bold text-amber-400 border-b border-zinc-800 pb-2 mb-4">
                ■ 個人・ファンサポーター（{fanSponsors.length}名）
              </h3>
              {fanSponsors.length === 0 ? (
                <p className="text-sm text-zinc-500">月300円から応援クレジットにお名前が掲載されます！</p>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {fanSponsors.map((s) => (
                    <span
                      key={s.id}
                      className="rounded-full border border-amber-400/30 bg-zinc-900 px-4 py-1.5 text-xs font-medium text-amber-200"
                    >
                      {s.display_name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-800 py-10 text-center text-xs text-zinc-500">
        <div className="mx-auto max-w-5xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} 外山企画 (Toyama Kikaku) - Noboribetsu, Hokkaido.</p>
          <div className="flex flex-wrap justify-center gap-6">
            <Link href="/mypage" className="hover:text-zinc-300 underline">
              マイページ・解約手続き
            </Link>
            <Link href="/privacy" className="hover:text-zinc-300 underline">
              プライバシーポリシー
            </Link>
            <Link href="/tokushoho" className="hover:text-zinc-300 underline">
              特定商取引法に基づく表記
            </Link>
          </div>
        </div>
      </footer>

      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-sm overflow-y-auto overscroll-contain">
          <div className="relative w-full max-w-lg min-h-[100dvh] sm:min-h-0 rounded-none sm:rounded-3xl border-0 sm:border border-zinc-700 bg-zinc-900 px-5 pt-5 pb-10 sm:p-8 shadow-2xl sm:my-8">
            <button
              onClick={() => setSelectedPlan(null)}
              className="absolute right-3 top-3 sm:right-5 sm:top-5 rounded-full p-3 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6">
              <span className="text-xs font-bold text-teal-400">スポンサーお申し込み</span>
              <h3 className="text-xl sm:text-2xl font-extrabold text-white mt-1 pr-10">
                {selectedPlan.name}
                <span className="block text-base sm:text-lg font-bold text-zinc-300">月額 ¥{selectedPlan.price}（税込）</span>
              </h3>
            </div>

            {errorMsg && (
              <div className="mb-4 rounded-xl border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  {selectedPlan.id === 'fan' ? 'お名前（本名）' : '法人名・店舗名'} *
                </label>
                <input
                  type="text"
                  required
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  placeholder={
                    selectedPlan.id === 'fan' ? '例：登別 太郎' : '例：株式会社〇〇 / 居酒屋〇〇'
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:border-teal-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  サイト・会場クレジット掲載名（ニックネーム可）
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="空欄の場合は上記のお名前が掲載されます"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:border-teal-400 focus:outline-none"
                />
                <label className="mt-2 flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-950 text-teal-400"
                  />
                  公式サイト・イベント会場に名前を掲載する
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  メールアドレス（領収書・ご案内送付先） *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="info@example.com"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:border-teal-400 focus:outline-none"
                />
              </div>

              {(selectedPlan.id === 'corporate' || selectedPlan.id === 'store') && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-zinc-300 mb-1">業種</label>
                      <input
                        type="text"
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        placeholder="例：飲食店 / 建設業"
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:border-teal-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-300 mb-1">
                        店舗・事業所エリア
                      </label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="例：登別市中央町 / 幌別町"
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:border-teal-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1">
                      お支払い方法の選択
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('card')}
                        className={`rounded-xl border py-3.5 sm:py-2.5 px-3 text-sm sm:text-xs font-bold transition ${
                          paymentMethod === 'card'
                            ? 'border-teal-400 bg-teal-400/10 text-teal-300'
                            : 'border-zinc-700 bg-zinc-950 text-zinc-400'
                        }`}
                      >
                        クレジットカード自動決済
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('invoice')}
                        className={`rounded-xl border py-3.5 sm:py-2.5 px-3 text-sm sm:text-xs font-bold transition ${
                          paymentMethod === 'invoice'
                            ? 'border-teal-400 bg-teal-400/10 text-teal-300'
                            : 'border-zinc-700 bg-zinc-950 text-zinc-400'
                        }`}
                      >
                        請求書払い（メール自動発行）
                      </button>
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-teal-400 py-3.5 font-bold text-zinc-950 hover:bg-teal-300 transition disabled:opacity-50 mt-4 cursor-pointer"
              >
                {loading
                  ? '決済画面へ移動中...'
                  : paymentMethod === 'invoice'
                  ? '請求書を発行して申し込む'
                  : 'Stripe決済画面へ進む'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
