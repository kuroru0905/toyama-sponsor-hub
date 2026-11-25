'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Link2, Copy, Unlink } from 'lucide-react';

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

  const headers = useCallback(
    (): HeadersInit => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }),
    [accessToken]
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/mypage/line-link?sponsorId=${sponsorId}`, { headers: headers(), cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '連携状況の取得に失敗しました');
      setLink(json.link ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '通信エラーが発生しました');
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
      const res = await fetch('/api/mypage/line-link', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ sponsorId }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error || '連携URLの発行に失敗しました');
      setUrl(json.url);
      // スマホならそのままLINEで開く
      if (/iPhone|iPad|Android/i.test(navigator.userAgent)) {
        window.location.href = json.url;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '通信エラーが発生しました');
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    if (!window.confirm('LINEとの連携を解除しますか？\n解除すると、スポンサー先行販売のチケットを購入できなくなります。')) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/mypage/line-link?sponsorId=${sponsorId}`, { method: 'DELETE', headers: headers() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '連携の解除に失敗しました');
      setLink(null);
      setUrl('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '通信エラーが発生しました');
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
    <div className="rounded-2xl border border-[#06C755]/40 bg-[#06C755]/5 p-5 space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold text-white">
        <Link2 className="h-4 w-4 text-[#06C755]" />
        LINEと連携する
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed">
        LINE公式アカウントの「チケット」でスポンサー先行販売のチケットを買うには、このご契約とLINEアカウントの連携が必要です。
        {!isActive && ' ※ 現在ご契約は有効化前です。連携は先に済ませておけます（お支払い確認後に先行購入できます）。'}
      </p>

      {loading ? (
        <p className="text-xs text-zinc-500">確認中...</p>
      ) : link ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-teal-300 font-bold">
            ✓ 連携済み{link.display_name ? `（${link.display_name}）` : ''}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={issue}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 sm:py-2 text-sm sm:text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              別のLINEに切り替える
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={unlink}
              className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-zinc-950 px-4 py-2.5 sm:py-2 text-sm sm:text-xs font-bold text-red-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              <Unlink className="h-3.5 w-3.5" />
              解除
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={issue}
          className="w-full sm:w-auto rounded-xl bg-[#06C755] px-5 py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? '発行中...' : 'LINEと連携する'}
        </button>
      )}

      {url && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-2">
          <p className="text-xs text-zinc-400">
            スマホのLINEでこのURLを開いてください（10分間・1回だけ有効）。パソコンの場合は、URLをコピーして自分のLINEに送ると開けます。連携後はこのページを再読み込みしてください。
          </p>
          <div className="flex gap-2">
            <input readOnly value={url} className="flex-1 min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200" />
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-bold text-white hover:bg-zinc-800"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? 'コピー済み' : 'コピー'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
