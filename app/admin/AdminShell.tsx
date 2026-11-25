'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient, Session } from '@supabase/supabase-js';
import { ArrowLeft, LogOut, ShieldAlert, Users, CalendarDays, Ticket, Mic2 } from 'lucide-react';

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
      options: { emailRedirectTo: redirectUrl },
    });
    setSendingMail(false);
    if (error) setLoginError('ログインメールの送信に失敗しました。');
    else setMailSent(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAdminState('checking');
  };

  const frame = (inner: React.ReactNode) => (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 py-8 sm:py-10 px-4">
      <div className="mx-auto max-w-6xl">{inner}</div>
    </div>
  );

  if (authLoading) {
    return frame(<p className="text-center text-zinc-400 py-20">認証状態を確認中...</p>);
  }

  if (!session) {
    return frame(
      <div className="mx-auto max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8 shadow-2xl">
        <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">TOYAMA KIKAKU ADMIN</span>
        <h1 className="text-2xl font-extrabold text-white mt-1 mb-2">外山企画 管理画面</h1>
        <p className="text-sm text-zinc-400 leading-relaxed mb-6">
          スポンサー・イベント／チケット・クーポン・出演応募をまとめて管理します。管理者のメールアドレスにログインリンクを送ります。
        </p>
        {mailSent ? (
          <div className="rounded-2xl border border-teal-500/40 bg-teal-500/10 p-5 text-sm text-teal-200">
            <strong>{loginEmail}</strong> 宛てにログインリンクを送りました。メールのリンクを開いてください。
          </div>
        ) : (
          <form onSubmit={handleSendMagicLink} className="space-y-4">
            {loginError && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">{loginError}</div>
            )}
            <input
              type="email"
              required
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-base sm:text-sm text-white focus:border-teal-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={sendingMail}
              className="w-full rounded-xl bg-teal-400 py-3 text-sm font-bold text-zinc-950 hover:bg-teal-300 transition disabled:opacity-50"
            >
              {sendingMail ? '送信中...' : '管理者ログインリンクを送信'}
            </button>
          </form>
        )}
      </div>
    );
  }

  if (adminState === 'checking') {
    return frame(<p className="text-center text-zinc-400 py-20">管理者権限を確認中...</p>);
  }

  if (adminState === 'forbidden') {
    return frame(
      <div className="mx-auto max-w-lg rounded-3xl border border-red-500/40 bg-red-950/20 p-8 text-center">
        <ShieldAlert className="h-10 w-10 text-red-400 mx-auto mb-3" />
        <h1 className="text-xl font-extrabold text-white mb-2">アクセスが拒否されました</h1>
        <p className="text-sm text-red-200 mb-2">{forbiddenMsg}</p>
        <p className="text-xs text-zinc-400 mb-4">
          現在のログインアカウント：<strong>{session.user.email}</strong>
          <br />
          Vercelの環境変数 <code className="text-teal-300">ADMIN_EMAILS</code> にこのアドレスが設定されているか確認してください。
        </p>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          別のアカウントでログイン
        </button>
      </div>
    );
  }

  return (
    <AdminContext.Provider value={{ token: session.access_token, email: session.user.email ?? '' }}>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <Link href="/" className="text-zinc-400 hover:text-white" title="公開トップページへ">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-teal-400 tracking-widest">TOYAMA KIKAKU ADMIN</div>
                  <div className="text-sm font-bold text-white truncate">外山企画 管理画面</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-xs text-zinc-500">{session.user.email}</span>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">ログアウト</span>
                </button>
              </div>
            </div>
            <nav className="-mb-px flex gap-1 overflow-x-auto">
              {ADMIN_TABS.map((tab) => {
                const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`shrink-0 inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-bold transition ${
                      active ? 'border-teal-400 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
      </div>
    </AdminContext.Provider>
  );
}
