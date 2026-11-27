'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient, Session } from '@supabase/supabase-js';
import { Users, CalendarDays, Ticket, Mic2, Megaphone, Handshake } from 'lucide-react';
import { Button, Field, Notice, Wordmark } from '@/components/ui';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

type AdminContextValue = { token: string; email: string };
const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin は AdminShell の中で使ってください');
  return ctx;
}

export const ADMIN_TABS = [
  { href: '/admin/sponsors', label: 'スポンサー', icon: Users },
  { href: '/admin/sponsorships', label: '協賛', icon: Handshake },
  { href: '/admin/banner', label: '横スクロール', icon: Megaphone },
  { href: '/admin/events', label: 'イベント・チケット', icon: CalendarDays },
  { href: '/admin/coupons', label: 'クーポン', icon: Ticket },
  { href: '/admin/applications', label: '出演応募', icon: Mic2 },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [adminState, setAdminState] = useState<'checking' | 'ok' | 'forbidden'>('checking');
  const [forbiddenMsg, setForbiddenMsg] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [mailSent, setMailSent] = useState(false);
  const [sendingMail, setSendingMail] = useState(false);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // 管理者かどうか確認
  useEffect(() => {
    if (!session?.access_token) return;
    setAdminState('checking');
    fetch('/api/admin/me', { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' })
      .then(async (res) => {
        if (res.ok) {
          setAdminState('ok');
        } else {
          const d = await res.json().catch(() => ({}));
          setForbiddenMsg(d.error || '管理者権限がありません');
          setAdminState('forbidden');
        }
      })
      .catch(() => {
        setForbiddenMsg('通信エラーが発生しました');
        setAdminState('forbidden');
      });
  }, [session?.access_token]);

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingMail(true);
    setLoginError('');
    // Supabaseの許可済みリダイレクト先（従来どおり /admin）に戻す。/admin からスポンサータブへ移動する
    const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/admin` : undefined;
    const { error } = await supabase.auth.signInWithOtp({
      email: loginEmail.trim(),
      // 登録済みのメールアドレスにだけ送る（知らないアドレスにログインメールを送りつけられないように）
      options: { emailRedirectTo: redirectUrl, shouldCreateUser: false },
    });
    setSendingMail(false);
    const notRegistered = !!error && /signups not allowed|not found|otp_disabled/i.test(error.message);
    if (error && !notRegistered) setLoginError('ログイン用のメールを送れませんでした。少し時間をおいてもう一度お試しください。');
    else setMailSent(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAdminState('checking');
  };

  const frame = (inner: React.ReactNode) => (
    <div className="min-h-screen bg-surface">
      <header className="glass sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
          <Link href="/" className="text-lg">
            <Wordmark />
          </Link>
          <span className="ml-3 text-sm text-ink-2">管理画面</span>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-12">{inner}</main>
    </div>
  );

  if (authLoading) {
    return frame(<p className="text-center text-ink-2">ログインの状態を確認しています…</p>);
  }

  if (!session) {
    return frame(
      <div>
        <h1 className="text-2xl font-semibold">外山企画 管理画面</h1>
        <p className="mt-3 leading-relaxed text-ink-2">
          スポンサー、イベントとチケット、クーポン、出演応募をまとめて管理します。管理者のメールアドレスにログイン用のリンクを送ります。
        </p>
        <div className="mt-8 rounded-panel bg-paper shadow-card p-5 sm:p-6">
          {mailSent ? (
            <p className="leading-relaxed">
              <span className="font-semibold">{loginEmail}</span> が管理者として登録されていれば、ログイン用のリンクが届きます。メールのリンクを開いてください。
            </p>
          ) : (
            <form onSubmit={handleSendMagicLink} className="space-y-5">
              <Field label="管理者のメールアドレス" htmlFor="adminEmail" error={loginError}>
                <input
                  id="adminEmail"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="field-input"
                />
              </Field>
              <Button type="submit" block disabled={sendingMail}>
                {sendingMail ? '送っています…' : 'ログイン用のリンクを受け取る'}
              </Button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (adminState === 'checking') {
    return frame(<p className="text-center text-ink-2">管理者かどうか確認しています…</p>);
  }

  if (adminState === 'forbidden') {
    return frame(
      <div>
        <h1 className="text-2xl font-semibold">このアカウントでは管理画面を使えません</h1>
        <Notice tone="danger" className="mt-6" title={forbiddenMsg}>
          ログイン中：{session.user.email}
          <br />
          Vercel の環境変数 <code>ADMIN_EMAILS</code> にこのアドレスが入っているか確かめてください。
        </Notice>
        <Button variant="secondary" className="mt-6" onClick={handleLogout}>
          別のアカウントでログイン
        </Button>
      </div>
    );
  }

  return (
    <AdminContext.Provider value={{ token: session.access_token, email: session.user.email ?? '' }}>
      <div className="min-h-screen bg-surface">
        <header className="glass sticky top-0 z-40 border-b border-line">
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex h-14 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Link href="/" className="text-lg" title="公開ページへ">
                  <Wordmark />
                </Link>
                <span className="text-sm text-ink-2">管理画面</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden text-sm text-ink-2 md:inline">{session.user.email}</span>
                <Button variant="secondary" size="sm" onClick={handleLogout}>
                  ログアウト
                </Button>
              </div>
            </div>
            <nav aria-label="管理メニュー" className="-mb-px flex gap-1 overflow-x-auto">
              {ADMIN_TABS.map((tab) => {
                const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 border-b-[3px] px-3 text-[15px] font-semibold ${
                      active ? 'border-brand text-ink' : 'border-transparent text-ink-2 hover:text-ink'
                    }`}
                  >
                    <Icon aria-hidden className="h-4 w-4" />
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>
        <main className="admin-ui mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
      </div>
    </AdminContext.Provider>
  );
}
