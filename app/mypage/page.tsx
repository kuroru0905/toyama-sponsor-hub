'use client';

import React, { useEffect, useState } from 'react';
import { createClient, Session } from '@supabase/supabase-js';
import Link from 'next/link';
import {
  ArrowLeft,
  Mail,
  CheckCircle2,
  CreditCard,
  Save,
  LogOut,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import CouponManager from './CouponManager';
import PerformerApplication from './PerformerApplication';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SponsorAsset {
  industry: string;
  address: string;
}

interface SponsorRecord {
  id: string;
  tier: 'corporate' | 'store' | 'fan';
  applicant_name: string;
  display_name: string;
  is_public: boolean;
  email: string;
  payment_method: string;
  status: string;
  stripe_customer_id: string | null;
  created_at: string;
  sponsor_assets?: SponsorAsset[];
}

const TIER_LABELS: Record<string, string> = {
  corporate: '企業プレミアム枠（月額 ¥10,000）',
  store: '店舗ローカル枠（月額 ¥3,000）',
  fan: 'ファンサポーター枠（月額 ¥300）',
};

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  active: { label: '契約中（有効）', color: 'bg-teal-500/20 text-teal-300 border-teal-500/40' },
  pending: { label: '決済待ち', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  past_due: { label: 'お支払い確認中', color: 'bg-red-500/20 text-red-300 border-red-500/40' },
  canceled: { label: '解約済み', color: 'bg-zinc-700/40 text-zinc-400 border-zinc-600' },
};

export default function MyPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [loginEmail, setLoginEmail] = useState('');
  const [mailSent, setMailSent] = useState(false);
  const [sendingMail, setSendingMail] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [sponsors, setSponsors] = useState<SponsorRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [portalLoadingId, setPortalLoadingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  const [editForms, setEditForms] = useState<
    Record<string, { displayName: string; isPublic: boolean; industry: string; address: string }>
  >({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.access_token) {
      fetchMySponsors(session.access_token);
    }
  }, [session]);

  const fetchMySponsors = async (token: string) => {
    setDataLoading(true);
    try {
      const res = await fetch('/api/mypage', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.sponsors) {
        setSponsors(data.sponsors);
        const initialForms: typeof editForms = {};
        data.sponsors.forEach((s: SponsorRecord) => {
          const asset = s.sponsor_assets?.[0];
          initialForms[s.id] = {
            displayName: s.display_name,
            isPublic: s.is_public,
            industry: asset?.industry || '',
            address: asset?.address || '',
          };
        });
        setEditForms(initialForms);
      }
    } finally {
      setDataLoading(false);
    }
  };

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingMail(true);
    setLoginError('');

    const redirectUrl =
      typeof window !== 'undefined' ? `${window.location.origin}/mypage` : undefined;

    const { error } = await supabase.auth.signInWithOtp({
      email: loginEmail.trim(),
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    setSendingMail(false);
    if (error) {
      setLoginError('メールの送信に失敗しました。時間をおいて再度お試しください。');
    } else {
      setMailSent(true);
    }
  };

  const handleSaveProfile = async (sponsorId: string) => {
    if (!session?.access_token) return;
    const form = editForms[sponsorId];
    if (!form) return;

    setSavingId(sponsorId);
    setToastMsg('');

    try {
      const res = await fetch('/api/mypage', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          sponsorId,
          displayName: form.displayName,
          isPublic: form.isPublic,
          industry: form.industry,
          address: form.address,
        }),
      });

      if (res.ok) {
        setToastMsg('掲載情報を更新しました！トップページにも即時反映されます。');
        fetchMySponsors(session.access_token);
      } else {
        const d = await res.json();
        alert(d.error || '更新に失敗しました');
      }
    } finally {
      setSavingId(null);
    }
  };

  const handleOpenPortal = async (sponsorId: string) => {
    if (!session?.access_token) return;
    setPortalLoadingId(sponsorId);

    try {
      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ sponsorId }),
      });

      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'ポータル画面を開けませんでした');
        setPortalLoadingId(null);
      }
    } catch {
      alert('通信エラーが発生しました');
      setPortalLoadingId(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSponsors([]);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 py-12 px-4">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-teal-400 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            トップページへ戻る
          </Link>

          {session && (
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 sm:px-3 sm:py-1.5 text-sm sm:text-xs text-zinc-300 hover:bg-zinc-800"
            >
              <LogOut className="h-3.5 w-3.5" />
              ログアウト
            </button>
          )}
        </div>

        {!session ? (
          <div className="mx-auto max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-400/10 text-teal-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-extrabold text-white mb-2">
              スポンサー・マイページ
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed mb-6">
              パスワードは不要です。お申し込み時に登録したメールアドレスを入力すると、ワンクリックでログインできる専用リンク（マジックリンク）をお送りします。
            </p>

            {mailSent ? (
              <div className="rounded-2xl border border-teal-500/40 bg-teal-500/10 p-5 text-sm text-teal-200">
                <div className="flex items-center gap-2 font-bold text-teal-300 mb-2">
                  <CheckCircle2 className="h-5 w-5" />
                  ログイン用メールを送信しました！
                </div>
                <p className="text-xs leading-relaxed text-zinc-300">
                  <strong>{loginEmail}</strong> 宛に届いたメール内の「ログインリンク」をクリックすると、自動的にマイページが開きます。
                </p>
              </div>
            ) : (
              <form onSubmit={handleSendMagicLink} className="space-y-4">
                {loginError && (
                  <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
                    {loginError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                    ご登録メールアドレス
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="info@example.com"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 pl-10 pr-4 py-2.5 text-sm text-white focus:border-teal-400 focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={sendingMail}
                  className="w-full rounded-xl bg-teal-400 py-3 text-sm font-bold text-zinc-950 hover:bg-teal-300 transition disabled:opacity-50"
                >
                  {sendingMail ? '送信中...' : 'ログインリンクをメールで受け取る'}
                </button>
              </form>
            )}
          </div>
        ) : (
          <div>
            <div className="mb-8">
              <span className="text-xs font-bold text-teal-400">LOGGED IN AS</span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                ご契約・掲載情報マイページ
              </h1>
              <p className="text-xs text-zinc-400 mt-1">{session.user.email}</p>
            </div>

            {toastMsg && (
              <div className="mb-6 rounded-xl border border-teal-500/40 bg-teal-500/10 p-4 text-sm text-teal-200 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-teal-400 shrink-0" />
                {toastMsg}
              </div>
            )}

            {dataLoading ? (
              <p className="text-sm text-zinc-400">契約情報を読み込んでいます...</p>
            ) : sponsors.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
                <p className="text-sm text-zinc-300 mb-4">
                  このメールアドレスに紐づくスポンサー契約が見つかりませんでした。
                </p>
                <Link
                  href="/#plans"
                  className="inline-block rounded-xl bg-teal-400 px-6 py-2.5 text-sm font-bold text-zinc-950"
                >
                  スポンサー枠を見る
                </Link>
              </div>
            ) : (
              <div className="space-y-8">
                {sponsors.map((sponsor) => {
                  const badge = STATUS_BADGES[sponsor.status] || {
                    label: sponsor.status,
                    color: 'bg-zinc-800 text-zinc-300 border-zinc-700',
                  };
                  const form = editForms[sponsor.id] || {
                    displayName: sponsor.display_name,
                    isPublic: sponsor.is_public,
                    industry: '',
                    address: '',
                  };

                  return (
                    <div
                      key={sponsor.id}
                      className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4 sm:p-8 shadow-xl"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-5 mb-6">
                        <div>
                          <span className="text-xs text-zinc-400">ご契約プラン</span>
                          <h2 className="text-lg sm:text-xl font-bold text-white">
                            {TIER_LABELS[sponsor.tier] || sponsor.tier}
                          </h2>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <div className="space-y-4 mb-8">
                        <div>
                          <label className="block text-xs font-bold text-zinc-300 mb-1">
                            サイト・会場クレジット掲載名
                          </label>
                          <input
                            type="text"
                            value={form.displayName}
                            onChange={(e) =>
                              setEditForms({
                                ...editForms,
                                [sponsor.id]: { ...form, displayName: e.target.value },
                              })
                            }
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:border-teal-400 focus:outline-none"
                          />
                        </div>

                        {(sponsor.tier === 'corporate' || sponsor.tier === 'store') && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-zinc-300 mb-1">
                                業種
                              </label>
                              <input
                                type="text"
                                value={form.industry}
                                onChange={(e) =>
                                  setEditForms({
                                    ...editForms,
                                    [sponsor.id]: { ...form, industry: e.target.value },
                                  })
                                }
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:border-teal-400 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-zinc-300 mb-1">
                                店舗・事業所エリア
                              </label>
                              <input
                                type="text"
                                value={form.address}
                                onChange={(e) =>
                                  setEditForms({
                                    ...editForms,
                                    [sponsor.id]: { ...form, address: e.target.value },
                                  })
                                }
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:border-teal-400 focus:outline-none"
                              />
                            </div>
                          </div>
                        )}

                        <label className="flex items-center gap-2.5 text-sm sm:text-xs text-zinc-300 cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={form.isPublic}
                            onChange={(e) =>
                              setEditForms({
                                ...editForms,
                                [sponsor.id]: { ...form, isPublic: e.target.checked },
                              })
                            }
                            className="rounded border-zinc-700 bg-zinc-950 text-teal-400"
                          />
                          公式サイトのサポーター一覧に名前を公開する
                        </label>

                        <button
                          onClick={() => handleSaveProfile(sponsor.id)}
                          disabled={savingId === sponsor.id}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-teal-400 px-5 py-3 sm:py-2.5 text-sm sm:text-xs font-bold text-zinc-950 hover:bg-teal-300 transition disabled:opacity-50"
                        >
                          <Save className="h-4 w-4" />
                          {savingId === sponsor.id ? '保存中...' : '掲載情報を保存する'}
                        </button>
                      </div>

                      {(sponsor.tier === 'corporate' || sponsor.tier === 'store') && (
                        <CouponManager
                          sponsorId={sponsor.id}
                          defaultShopName={sponsor.display_name}
                          accessToken={session.access_token}
                          isActive={sponsor.status === 'active'}
                        />
                      )}

                      <PerformerApplication
                        sponsorId={sponsor.id}
                        accessToken={session.access_token}
                        defaultName={sponsor.applicant_name}
                      />

                      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-bold text-white mb-1">
                            <CreditCard className="h-4 w-4 text-amber-400" />
                            お支払い方法・領収書・解約手続き
                          </div>
                          <p className="text-xs text-zinc-400 leading-relaxed">
                            Stripeの専用管理画面から、クレジットカードの変更・請求書/領収書のダウンロード・サブスクリプションの即時解約が可能です。
                          </p>
                        </div>
                        <button
                          onClick={() => handleOpenPortal(sponsor.id)}
                          disabled={portalLoadingId === sponsor.id || !sponsor.stripe_customer_id}
                          className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 sm:py-2.5 text-sm sm:text-xs font-bold text-white hover:bg-zinc-800 transition disabled:opacity-40"
                        >
                          {portalLoadingId === sponsor.id ? '移動中...' : '契約・決済を管理'}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
