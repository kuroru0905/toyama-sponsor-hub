'use client';

// 管理画面：横スクロールの掲示（契約中の企業・店舗に加えて、管理者が足す掲示）
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAdmin } from '../AdminShell';
import { Button, Field, Notice } from '@/components/ui';
import LogoEditor from '@/app/mypage/LogoEditor';

type Extra = { id: string; name: string; isActive: boolean; logoUrl: string | null };
type Partner = { id: string; name: string; logoUrl: string | null; tier: 'corporate' | 'store' | 'extra' };

const TIER_LABEL: Record<Partner['tier'], string> = { corporate: '企業枠', store: '店舗枠', extra: '追加の掲示' };

export default function AdminBannerPage() {
  const { token } = useAdmin();
  const auth = { Authorization: `Bearer ${token}` };
  const [extras, setExtras] = useState<Extra[]>([]);
  const [live, setLive] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // 追加フォーム
  const [name, setName] = useState('');
  const [pending, setPending] = useState<File | null>(null); // 大きさ調整中の画像
  const [logo, setLogo] = useState<File | null>(null); // 調整済みのロゴ
  const [logoPreview, setLogoPreview] = useState('');
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        fetch('/api/admin/banner-extras', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch('/api/partners-banner', { cache: 'no-store' }).then((r) => r.json()),
      ]);
      if (a.error) setMsg({ tone: 'danger', text: a.error });
      setExtras(a.extras ?? []);
      setLive(b.partners ?? []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!logo) return setLogoPreview('');
    const u = URL.createObjectURL(logo);
    setLogoPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [logo]);

  const pick = (file: File) => {
    setMsg(null);
    if (fileRef.current) fileRef.current.value = '';
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setMsg({ tone: 'danger', text: '画像は PNG・JPEG・WebP のいずれかにしてください' });
    if (file.size > 10 * 1024 * 1024) return setMsg({ tone: 'danger', text: '画像は10MB以内にしてください' });
    setPending(file);
  };

  const add = async () => {
    setMsg(null);
    const n = name.trim();
    if (!n) return setMsg({ tone: 'danger', text: '掲示する名前を入力してください' });
    setAdding(true);
    try {
      const fd = new FormData();
      fd.append('name', n);
      if (logo) fd.append('file', logo);
      const res = await fetch('/api/admin/banner-extras', { method: 'POST', headers: auth, body: fd });
      const j = await res.json();
      if (!res.ok) return setMsg({ tone: 'danger', text: j.error || '追加に失敗しました' });
      setName('');
      setLogo(null);
      setMsg({ tone: 'ok', text: `「${n}」を横スクロールに追加しました。1分ほどでサイトに反映されます。` });
      load();
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (e: Extra) => {
    setMsg(null);
    setBusyId(e.id);
    try {
      const res = await fetch(`/api/admin/banner-extras/${e.id}`, {
        method: 'PATCH',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !e.isActive }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg({ tone: 'danger', text: j.error || '更新に失敗しました' });
      setExtras((xs) => xs.map((x) => (x.id === e.id ? { ...x, isActive: !e.isActive } : x)));
      load();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (e: Extra) => {
    setMsg(null);
    setBusyId(e.id);
    try {
      const res = await fetch(`/api/admin/banner-extras/${e.id}`, { method: 'DELETE', headers: auth });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg({ tone: 'danger', text: j.error || '削除に失敗しました' });
      setExtras((xs) => xs.filter((x) => x.id !== e.id));
      setMsg({ tone: 'ok', text: `「${e.name}」を削除しました。` });
      load();
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink sm:text-2xl">横スクロール</h1>
          <p className="mt-1 text-sm text-ink-2">サイト上部を流れる掲示です。契約中の企業・店舗枠に加えて、ここで掲示を足せます（ファン枠は出しません）。</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink hover:bg-surface"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          最新にする
        </button>
      </div>

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      {/* 今サイトに流れている順 */}
      <section className="rounded-panel bg-paper p-5 shadow-card">
        <h2 className="text-base font-semibold text-ink">いま流れている順（{live.length}件）</h2>
        {loading && live.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">読み込み中…</p>
        ) : live.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">まだ何も流れていません。</p>
        ) : (
          <ol className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
            {live.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                {p.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.logoUrl} alt={p.name} className="h-6 w-auto max-w-[120px] object-contain" />
                ) : (
                  <span className="text-sm font-semibold text-ink">{p.name}</span>
                )}
                <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-2">{TIER_LABEL[p.tier]}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* 追加 */}
      <section className="space-y-5 rounded-panel bg-paper p-5 shadow-card">
        <h2 className="text-base font-semibold text-ink">掲示を足す</h2>
        <Notice tone="warn">
          実在する会社やお店を載せるときは、先方から掲載の了承をもらってからにしてください。了承のない名前やロゴは、見た人に「スポンサーをしている」と受け取られてしまいます。デモ用の架空の名前なら問題ありません。
        </Notice>
        <Field htmlFor="extraName" label="掲示する名前" required hint="ロゴがないときは、この名前が流れます。ロゴがあるときは画像の代わりの文字（読み上げ用）になります。40文字まで。">
          <input id="extraName" type="text" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} className="field-input" />
        </Field>

        <div>
          <p className="text-[15px] font-semibold text-ink">
            ロゴ画像 <span className="text-xs font-medium text-ink-2">任意</span>
          </p>
          {pending ? (
            <div className="mt-3">
              <LogoEditor
                file={pending}
                name={name || 'ロゴ'}
                saving={false}
                onSave={(png) => {
                  setLogo(png);
                  setPending(null);
                }}
                onCancel={() => setPending(null)}
                onError={(text) => {
                  setPending(null);
                  setMsg({ tone: 'danger', text });
                }}
              />
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {logoPreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="選んだロゴ" className="h-7 w-auto max-w-[140px] rounded border border-line bg-paper object-contain p-0.5" />
              )}
              <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-full border border-brand bg-paper px-5 text-[15px] font-medium text-brand hover:bg-brand-soft focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])}
                />
                {logo ? 'ロゴを選び直す' : 'ロゴを選ぶ'}
              </label>
              {logo && (
                <button type="button" onClick={() => setLogo(null)} className="text-sm font-semibold text-ink-2 hover:underline">
                  ロゴを使わない
                </button>
              )}
            </div>
          )}
        </div>

        <Button onClick={add} disabled={adding || !!pending}>
          {adding ? '追加しています…' : '横スクロールに追加'}
        </Button>
      </section>

      {/* 足した掲示の一覧 */}
      <section className="rounded-panel bg-paper p-5 shadow-card">
        <h2 className="text-base font-semibold text-ink">足した掲示（{extras.length}件）</h2>
        {extras.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">まだありません。</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {extras.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  {e.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.logoUrl} alt="" className="h-7 w-auto max-w-[140px] object-contain" />
                  ) : null}
                  <span className="truncate font-semibold text-ink">{e.name}</span>
                  {!e.isActive && <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-2">非表示</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggle(e)}
                    disabled={busyId === e.id}
                    className="cursor-pointer rounded-full border border-line-strong bg-paper px-3 py-1.5 text-sm font-semibold text-ink hover:bg-surface"
                  >
                    {e.isActive ? '非表示にする' : '表示する'}
                  </button>
                  {confirmId === e.id ? (
                    <span className="inline-flex items-center gap-2 rounded-ctl border border-danger-line bg-danger-soft px-2.5 py-1 text-sm">
                      ロゴごと削除します。よろしいですか？
                      <button
                        type="button"
                        onClick={() => remove(e)}
                        disabled={busyId === e.id}
                        className="cursor-pointer rounded-full bg-danger px-3 py-1 font-semibold text-white"
                      >
                        {busyId === e.id ? '削除中…' : '削除'}
                      </button>
                      <button type="button" onClick={() => setConfirmId(null)} className="cursor-pointer px-1 font-semibold text-ink-2 hover:underline">
                        やめる
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(e.id)}
                      className="cursor-pointer rounded-full border border-danger-line bg-paper px-3 py-1.5 text-sm font-semibold text-danger hover:bg-danger-soft"
                    >
                      削除
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
