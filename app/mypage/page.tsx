'use client';

import React, { useEffect, useState } from 'react';
import { createClient, Session } from '@supabase/supabase-js';
import Link from 'next/link';
import CouponManager from './CouponManager';
import PerformerApplication from './PerformerApplication';
import LineLink from './LineLink';
import LiveStreams from './LiveStreams';
import CorporateInquiry from './CorporateInquiry';
import { Badge, Button, Field, Notice, Section, Wordmark, buttonClass } from '@/components/ui';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

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

const TIER: Record<string, { name: string; price: string }> = {
  corporate: { name: '企業プレミアム枠', price: '10,000' },
  store: { name: '店舗ローカル枠', price: '3,000' },
  fan: { name: 'ファンサポーター枠', price: '300' },
};

const STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'danger' | 'neutral' }> = {
  active: { label: '契約中', tone: 'ok' },
  pending: { label: 'お支払い待ち', tone: 'warn' },
  past_due: { label: 'お支払いが確認できていません', tone: 'danger' },
  canceled: { label: '解約済み', tone: 'neutral' },
};

type EditForm = { displayName: string; isPublic: boolean; industry: string; address: string };

export default function MyPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [loginEmail, setLoginEmail] = useState('');
  const [mailSent, setMailSent] = useState(false);
  const [sendingMail, setSendingMail] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [sponsors, setSponsors] = useState<SponsorRecord[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState('');
  const [editForms, setEditForms] = useState<Record<string, EditForm>>({});

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
    if (session?.access_token) fetchMySponsors(session.access_token);
  }, [session]);

  const fetchMySponsors = async (token: string) => {
    setDataLoading(true);
    try {
      const res = await fetch('/api/mypage', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok && data.sponsors) {
        const list = data.sponsors as SponsorRecord[];
        setSponsors(list);
        const forms: Record<string, EditForm> = {};
        list.forEach((s) => {
          const asset = s.sponsor_assets?.[0];
          forms[s.id] = {
            displayName: s.display_name,
            isPublic: s.is_public,
            industry: asset?.industry || '',
            address: asset?.address || '',
          };
        });
        setEditForms(forms);
        // 有効な契約を優先して表示
        setCurrentId((prev) => {
          if (prev && list.some((s) => s.id === prev)) return prev;
          const active = list.find((s) => s.status === 'active');
          return (active ?? list[0])?.id ?? null;
        });
      }
    } finally {
      setDataLoading(false);
    }
  };

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingMail(true);
    setLoginError('');
    const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/mypage` : undefined;
    const { error } = await supabase.auth.signInWithOtp({
      email: loginEmail.trim(),
      options: { emailRedirectTo: redirectUrl },
    });
    setSendingMail(false);
    if (error) setLoginError('メールを送れませんでした。メールアドレスを確かめて、少し時間をおいてからもう一度お試しください。');
    else setMailSent(true);
  };

  const handleSaveProfile = async (sponsorId: string) => {
    if (!session?.access_token) return;
    const form = editForms[sponsorId];
    if (!form) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch('/api/mypage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          sponsorId,
          displayName: form.displayName,
          isPublic: form.isPublic,
          industry: form.industry,
          address: form.address,
        }),
      });
      if (res.ok) {
        setSaveMsg({ tone: 'ok', text: '掲載情報を保存しました。トップページにもすぐ反映されます。' });
        fetchMySponsors(session.access_token);
      } else {
        const d = await res.json().catch(() => ({}));
        setSaveMsg({ tone: 'danger', text: d.error || '保存できませんでした。時間をおいてもう一度お試しください。' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPortal = async (sponsorId: string) => {
    if (!session?.access_token) return;
    setPortalLoading(true);
    setPortalError('');
    try {
      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ sponsorId }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setPortalError(data.error || 'お支払いの管理画面を開けませんでした。');
    } catch {
      setPortalError('通信できませんでした。電波の良いところでもう一度お試しください。');
    }
    setPortalLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSponsors([]);
    setCurrentId(null);
  };

  const header = (
    <header className="glass sticky top-0 z-30 border-b border-line">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="text-lg">
          <Wordmark />
        </Link>
        {session && (
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-2 sm:inline">{session.user.email}</span>
            <Button variant="secondary" size="sm" onClick={handleLogout}>
              ログアウト
            </Button>
          </div>
        )}
      </div>
    </header>
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface">
        {header}
        <p className="px-4 py-16 text-center text-ink-2">読み込んでいます…</p>
      </div>
    );
  }

  // ===== ログイン前 =====
  if (!session) {
    return (
      <div className="min-h-screen bg-surface">
        {header}
        <main className="mx-auto max-w-md px-4 py-12 sm:py-16">
          <h1 className="text-[32px] font-semibold leading-tight tracking-tight">スポンサーのマイページ</h1>
          <p className="mt-3 leading-relaxed text-ink-2">
            パスワードはいりません。お申し込みのときのメールアドレスに、ログイン用のリンクをお送りします。
          </p>

          <div className="card mt-8 p-6 sm:p-8">
            {mailSent ? (
              <div>
                <h2 className="text-lg font-semibold">メールを送りました</h2>
                <p className="mt-2 leading-relaxed text-ink-2">
                  <span className="font-semibold text-ink">{loginEmail}</span> に届いたメールの「ログイン」リンクを開くと、このページに戻ってきます。
                </p>
                <p className="mt-3 text-sm text-ink-2">届かないときは、迷惑メールのフォルダも確認してください。</p>
                <Button variant="ghost" className="mt-4 -ml-2" onClick={() => setMailSent(false)}>
                  別のメールアドレスで送り直す
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSendMagicLink} className="space-y-5">
                <Field label="ご登録のメールアドレス" htmlFor="loginEmail" error={loginError}>
                  <input
                    id="loginEmail"
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    aria-invalid={loginError ? true : undefined}
                    className="field-input"
                  />
                </Field>
                <Button type="submit" block disabled={sendingMail}>
                  {sendingMail ? '送っています…' : 'ログイン用のリンクを受け取る'}
                </Button>
              </form>
            )}
          </div>

          <p className="mt-8 text-sm text-ink-2">
            まだスポンサーではない方は
            <Link href="/#plans" className="mx-1 text-brand underline underline-offset-4">
              料金プラン
            </Link>
            をご覧ください。
          </p>
        </main>
      </div>
    );
  }

  const sponsor = sponsors.find((s) => s.id === currentId) ?? null;

  // ===== ログイン後 =====
  return (
    <div className="min-h-screen bg-surface">
      {header}

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:pt-10">
        <h1 className="text-[32px] font-semibold tracking-tight sm:text-[40px]">マイページ</h1>

        {dataLoading && sponsors.length === 0 ? (
          <p className="mt-8 text-ink-2">ご契約の情報を読み込んでいます…</p>
        ) : sponsors.length === 0 ? (
          <div className="mt-8 max-w-prose">
            <Notice tone="info" title="このメールアドレスのご契約が見つかりませんでした">
              お申し込みのときに使ったメールアドレスでログインしているか確かめてください。新しく申し込む場合は料金プランからどうぞ。
            </Notice>
            <Link href="/#plans" className={`${buttonClass('primary', 'md')} mt-6`}>
              料金プランを見る
            </Link>
          </div>
        ) : (
          sponsor && (
            <SponsorView
              key={sponsor.id}
              sponsor={sponsor}
              sponsors={sponsors}
              onSwitch={setCurrentId}
              session={session}
              form={
                editForms[sponsor.id] || {
                  displayName: sponsor.display_name,
                  isPublic: sponsor.is_public,
                  industry: '',
                  address: '',
                }
              }
              setForm={(f) => setEditForms({ ...editForms, [sponsor.id]: f })}
              saving={saving}
              saveMsg={saveMsg}
              onSave={() => handleSaveProfile(sponsor.id)}
              portalLoading={portalLoading}
              portalError={portalError}
              onOpenPortal={() => handleOpenPortal(sponsor.id)}
            />
          )
        )}
      </main>
    </div>
  );
}

function SponsorView({
  sponsor,
  sponsors,
  onSwitch,
  session,
  form,
  setForm,
  saving,
  saveMsg,
  onSave,
  portalLoading,
  portalError,
  onOpenPortal,
}: {
  sponsor: SponsorRecord;
  sponsors: SponsorRecord[];
  onSwitch: (id: string) => void;
  session: Session;
  form: EditForm;
  setForm: (f: EditForm) => void;
  saving: boolean;
  saveMsg: { tone: 'ok' | 'danger'; text: string } | null;
  onSave: () => void;
  portalLoading: boolean;
  portalError: string;
  onOpenPortal: () => void;
}) {
  const tier = TIER[sponsor.tier] ?? { name: sponsor.tier, price: '' };
  const status = STATUS[sponsor.status] ?? { label: sponsor.status, tone: 'neutral' as const };
  const isBusiness = sponsor.tier === 'corporate' || sponsor.tier === 'store';
  const isActive = sponsor.status === 'active';

  // このページの目次（表示される項目だけ）
  const nav = [
    { id: 'profile', label: '掲載情報' },
    sponsor.status !== 'canceled' ? { id: 'line', label: 'LINE連携' } : null,
    isActive ? { id: 'stream', label: 'ライブ配信' } : null,
    isBusiness ? { id: 'coupons', label: 'クーポン' } : null,
    { id: 'perform', label: '出演応募' },
    isActive && sponsor.tier === 'corporate' ? { id: 'inquiry', label: 'CM・動画の相談' } : null,
    { id: 'billing', label: 'お支払い・解約' },
  ].filter((x): x is { id: string; label: string } => x !== null);

  return (
    <div className="mt-6">
      {/* 契約が複数あるときの切り替え */}
      {sponsors.length > 1 && (
        <div role="tablist" aria-label="ご契約の切り替え" className="mb-6 flex flex-wrap gap-2">
          {sponsors.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === sponsor.id}
              onClick={() => onSwitch(s.id)}
              className={`min-h-[40px] rounded-full px-4 text-[15px] ${
                s.id === sponsor.id ? 'bg-ink text-white' : 'bg-paper text-ink shadow-card hover:bg-white'
              }`}
            >
              {s.display_name}（{TIER[s.tier]?.name ?? s.tier}）
            </button>
          ))}
        </div>
      )}

      {/* 契約のあらまし */}
      <div className="card px-6 py-6 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[24px] font-semibold">{sponsor.display_name}</h2>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <p className="mt-1 text-ink-2">
          {tier.name}　月額 <span className="num text-lg font-semibold text-ink">¥{tier.price}</span>（税込）
        </p>
        {sponsor.status === 'pending' && (
          <Notice tone="warn" className="mt-4" title="お支払いの確認後に、特典が使えるようになります">
            {sponsor.payment_method === 'invoice'
              ? 'メールでお送りした請求書のお支払いをお願いします。LINE連携は先に済ませておけます。'
              : 'カード決済が完了していません。もう一度お申し込みの手続きをお願いします。'}
          </Notice>
        )}
        {sponsor.status === 'past_due' && (
          <Notice tone="danger" className="mt-4" title="お支払いが確認できていません">
            「お支払い・解約」から、カード情報の更新をお願いします。
          </Notice>
        )}
      </div>

      {/* スマホ：目次を横スクロールで */}
      <nav aria-label="このページの項目" className="glass sticky top-16 z-20 -mx-4 mt-6 overflow-x-auto px-4 py-2 lg:hidden">
        <ul className="flex gap-2">
          {nav.map((n) => (
            <li key={n.id} className="shrink-0">
              <a href={`#${n.id}`} className="inline-flex min-h-[40px] items-center rounded-full bg-paper px-4 text-[14px] shadow-card">
                {n.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6 lg:mt-10 lg:grid lg:grid-cols-[13rem_1fr] lg:gap-12">
        {/* PC：左に目次 */}
        <nav aria-label="このページの項目" className="hidden lg:block">
          <ul className="sticky top-24 space-y-1">
            {nav.map((n) => (
              <li key={n.id}>
                <a href={`#${n.id}`} className="block rounded-full px-4 py-2 text-[15px] text-ink-2 hover:bg-paper hover:text-ink">
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          <Section id="profile" title="掲載情報" description="サイトのサポーター一覧と、会場のクレジットに載る内容です。">
            <div className="max-w-prose space-y-6">
              <Field label="サイト・会場に載せるお名前" htmlFor="displayName">
                <input
                  id="displayName"
                  type="text"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  className="field-input"
                />
              </Field>
              {isBusiness && (
                <>
                  <Field label="業種" htmlFor="industry" optional hint="記入例：飲食店、建設業">
                    <input id="industry" type="text" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className="field-input" />
                  </Field>
                  <Field label="お店・事業所のエリア" htmlFor="address" optional hint="記入例：登別市中央町、幌別町">
                    <input id="address" type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="field-input" />
                  </Field>
                </>
              )}
              <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-[15px]">
                <input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} />
                公式サイトのサポーター一覧にお名前を載せる
              </label>
              {saveMsg && <Notice tone={saveMsg.tone}>{saveMsg.text}</Notice>}
              <Button onClick={onSave} disabled={saving} className="w-full sm:w-auto">
                {saving ? '保存しています…' : '掲載情報を保存'}
              </Button>
            </div>
          </Section>

          {sponsor.status !== 'canceled' && <LineLink sponsorId={sponsor.id} accessToken={session.access_token} isActive={isActive} />}

          {isActive && <LiveStreams sponsorId={sponsor.id} accessToken={session.access_token} />}

          {isBusiness && (
            <CouponManager
              sponsorId={sponsor.id}
              defaultShopName={sponsor.display_name}
              accessToken={session.access_token}
              isActive={isActive}
            />
          )}

          <PerformerApplication
            sponsorId={sponsor.id}
            accessToken={session.access_token}
            defaultName={sponsor.applicant_name}
            loginEmail={session.user.email ?? ''}
          />

          {isActive && sponsor.tier === 'corporate' && (
            <CorporateInquiry sponsorId={sponsor.id} accessToken={session.access_token} defaultName={sponsor.applicant_name} />
          )}

          <Section
            id="billing"
            title="お支払い・解約"
            description="カードの変更、請求書・領収書のダウンロード、解約は、決済会社Stripeの管理画面で行います。"
          >
            {portalError && <Notice tone="danger" className="mb-4">{portalError}</Notice>}
            <Button variant="secondary" onClick={onOpenPortal} disabled={portalLoading || !sponsor.stripe_customer_id} className="w-full sm:w-auto">
              {portalLoading ? '管理画面を開いています…' : 'お支払いの管理画面を開く'}
            </Button>
          </Section>
        </div>
      </div>
    </div>
  );
}
