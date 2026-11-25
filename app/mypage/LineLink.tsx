'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Notice, Section, buttonClass } from '@/components/ui';

type LinkInfo = { display_name: string | null; linked_at: string } | null;

// スポンサー契約とLINEアカウントの連携（スポンサー先行販売の購入に必要）
export default function LineLink({
  sponsorId,
  accessToken,
  isActive,
}: {
  sponsorId: string;
  accessToken: string;
  isActive: boolean;
}) {
  const [link, setLink] = useState<LinkInfo>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const headers = useCallback(
    (): HeadersInit => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }),
    [accessToken]
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/mypage/line-link?sponsorId=${sponsorId}`, { headers: headers(), cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '連携の状態を読み込めませんでした');
      setLink(json.link ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '通信できませんでした');
    } finally {
      setLoading(false);
    }
  }, [sponsorId, headers]);

  useEffect(() => {
    load();
  }, [load]);

  const issue = async () => {
    setBusy(true);
    setError('');
    setCopied(false);
    try {
      const res = await fetch('/api/mypage/line-link', { method: 'POST', headers: headers(), body: JSON.stringify({ sponsorId }) });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error || '連携用のリンクを作れませんでした');
      setUrl(json.url);
      // スマホならそのままLINEで開く
      if (/iPhone|iPad|Android/i.test(navigator.userAgent)) window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : '通信できませんでした');
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/mypage/line-link?sponsorId=${sponsorId}`, { method: 'DELETE', headers: headers() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '連携を解除できませんでした');
      setLink(null);
      setUrl('');
      setConfirmUnlink(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '通信できませんでした');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Section
      id="line"
      title="LINE連携"
      description="公式LINEのチケット画面で、スポンサー先行販売のチケットを買うために必要です。"
    >
      <div className="max-w-prose space-y-4">
        {!isActive && (
          <Notice tone="info">ご契約が有効になる前でも、先に連携しておけます。先行購入はお支払いの確認後からできます。</Notice>
        )}

        {loading ? (
          <p className="text-ink-2">連携の状態を確認しています…</p>
        ) : link ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex flex-wrap items-center gap-2 text-[15px]">
              <Badge tone="ok">連携済み</Badge>
              {link.display_name && <span className="font-semibold">{link.display_name}</span>}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" size="sm" onClick={issue} disabled={busy}>
                別のLINEに切り替える
              </Button>
              <Button variant="danger" size="sm" onClick={() => setConfirmUnlink(true)} disabled={busy}>
                連携を解除
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="line" onClick={issue} disabled={busy} className="w-full sm:w-auto">
            {busy ? 'リンクを作っています…' : 'LINEと連携する'}
          </Button>
        )}

        {confirmUnlink && (
          <Notice tone="warn" title="LINEとの連携を解除しますか？">
            解除すると、スポンサー先行販売のチケットが買えなくなります。
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button variant="danger" size="sm" onClick={unlink} disabled={busy}>
                解除する
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setConfirmUnlink(false)}>
                やめる
              </Button>
            </div>
          </Notice>
        )}

        {url && (
          <div className="rounded-panel bg-surface p-4">
            <p className="text-[15px] leading-relaxed">
              スマホのLINEでこのリンクを開いてください。10分間、1回だけ使えます。パソコンで見ている場合は、リンクをコピーして自分のLINEに送ると開けます。
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input readOnly value={url} aria-label="連携用のリンク" className="field-input min-w-0 flex-1 text-sm" onFocus={(e) => e.currentTarget.select()} />
              <button type="button" onClick={copy} className={buttonClass('secondary', 'md')}>
                {copied ? 'コピーしました' : 'コピー'}
              </button>
            </div>
            <p className="mt-2 text-sm text-ink-2">連携が終わったら、このページを再読み込みしてください。</p>
          </div>
        )}

        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Section>
  );
}
