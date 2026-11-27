'use client';

// マイページ：サイト上部の横スクロールに出すロゴ・名前（企業・店舗の特典）
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Field, Notice, Section } from '@/components/ui';

interface Props {
  sponsorId: string;
  accessToken: string;
}

type State = { bannerName: string; displayName: string; logoUrl: string | null; isPublic: boolean; isActive: boolean };

export default function LogoBanner({ sponsorId, accessToken }: Props) {
  const [state, setState] = useState<State | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<'upload' | 'name' | 'remove' | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const url = `/api/mypage/logo?sponsorId=${encodeURIComponent(sponsorId)}`;
  const auth = { Authorization: `Bearer ${accessToken}` };

  const load = useCallback(async () => {
    const res = await fetch(url, { headers: auth });
    const j = await res.json();
    if (!res.ok) return setMsg({ tone: 'danger', text: j.error || '読み込みに失敗しました' });
    setState(j);
    setName(j.bannerName || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (file: File) => {
    setMsg(null);
    if (file.size > 1024 * 1024) return setMsg({ tone: 'danger', text: '画像は1MB以内にしてください' });
    setBusy('upload');
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(url, { method: 'POST', headers: auth, body: fd });
    const j = await res.json();
    setBusy(null);
    if (fileRef.current) fileRef.current.value = '';
    if (!res.ok) return setMsg({ tone: 'danger', text: j.error || 'ロゴの保存に失敗しました' });
    setState((s) => (s ? { ...s, logoUrl: j.logoUrl } : s));
    setMsg({ tone: 'ok', text: 'ロゴを保存しました。1分ほどでサイト上部に反映されます。' });
  };

  const saveName = async () => {
    setMsg(null);
    setBusy('name');
    const res = await fetch(url, { method: 'PATCH', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ bannerName: name }) });
    const j = await res.json();
    setBusy(null);
    if (!res.ok) return setMsg({ tone: 'danger', text: j.error || '保存に失敗しました' });
    setState((s) => (s ? { ...s, bannerName: j.bannerName } : s));
    setMsg({ tone: 'ok', text: '掲示する名前を保存しました。' });
  };

  const removeLogo = async () => {
    setMsg(null);
    setBusy('remove');
    const res = await fetch(url, { method: 'DELETE', headers: auth });
    setBusy(null);
    if (!res.ok) return setMsg({ tone: 'danger', text: 'ロゴを外せませんでした' });
    setState((s) => (s ? { ...s, logoUrl: null } : s));
    setMsg({ tone: 'ok', text: 'ロゴを外しました。これからは名前で掲示されます。' });
  };

  const shownName = (name.trim() || state?.displayName || '').slice(0, 40);

  return (
    <Section
      id="banner"
      title="ロゴの掲示"
      description="サイトの一番上を流れる「まちきっぷ パートナーズ」の列に、ロゴか名前を掲示します。ロゴがあればロゴ、なければ名前が出ます。"
    >
      {!state ? (
        <p className="text-ink-2">読み込んでいます…</p>
      ) : (
        <div className="space-y-6">
          {(!state.isActive || !state.isPublic) && (
            <Notice tone="warn">
              {!state.isActive ? 'ご契約が有効になると掲示されます。' : '「掲載情報」でサイトへの掲載をオフにしているため、今は掲示されていません。'}
            </Notice>
          )}

          {/* 見え方の見本 */}
          <div>
            <p className="text-[15px] font-semibold text-ink">掲示の見え方</p>
            <div className="mt-2 flex h-14 items-center rounded-panel bg-surface px-5">
              {state.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={state.logoUrl} alt={shownName} className="h-7 w-auto max-w-[140px] object-contain" />
              ) : (
                <span className="text-[15px] font-semibold text-ink-2">{shownName}</span>
              )}
            </div>
          </div>

          {/* ロゴ */}
          <div>
            <p className="text-[15px] font-semibold text-ink">ロゴ画像</p>
            <p className="mt-1 text-sm text-ink-2">PNG・JPEG・WebP、1MBまで。横長で、背景が透明か白の画像がきれいに見えます（高さ28pxで表示）。</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="inline-flex min-h-[48px] cursor-pointer items-center rounded-full border border-brand bg-brand px-6 text-[17px] font-medium text-brand-ink hover:bg-brand-hover focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={busy !== null}
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                />
                {busy === 'upload' ? 'アップロードしています…' : state.logoUrl ? 'ロゴを変える' : 'ロゴを選ぶ'}
              </label>
              {state.logoUrl && (
                <Button variant="secondary" onClick={removeLogo} disabled={busy !== null}>
                  {busy === 'remove' ? '外しています…' : 'ロゴを外して名前で掲示'}
                </Button>
              )}
            </div>
          </div>

          {/* 名前 */}
          <Field htmlFor="bannerName" label="掲示する名前" hint={`ロゴがないときに表示します。空なら掲載名（${state.displayName}）を使います。40文字まで。`}>
            <input id="bannerName" type="text" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} className="field-input" placeholder={state.displayName} />
          </Field>
          <Button onClick={saveName} disabled={busy !== null}>
            {busy === 'name' ? '保存しています…' : '名前を保存'}
          </Button>

          {msg && <Notice tone={msg.tone === 'ok' ? 'ok' : 'danger'}>{msg.text}</Notice>}
        </div>
      )}
    </Section>
  );
}
