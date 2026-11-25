'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Clapperboard, Send } from 'lucide-react';
import { INQUIRY_KINDS } from '@/lib/inquiries';

type Inquiry = {
  id: string;
  kind: string;
  message: string;
  status: string;
  created_at: string;
};

// スマホでフォーカス時に拡大されないよう、スマホでは16px（text-base）
const inputClass =
  'w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-base sm:text-sm text-white focus:border-orange-400 focus:outline-none';
const labelClass = 'block text-xs font-bold text-zinc-300 mb-1.5';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// 企業プレミアム枠：CM放映・PR動画制作のお問い合わせ
export default function CorporateInquiry({
  sponsorId,
  accessToken,
  defaultName,
}: {
  sponsorId: string;
  accessToken: string;
  defaultName: string;
}) {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('video');
  const [message, setMessage] = useState('');
  const [contactName, setContactName] = useState(defaultName);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/mypage/inquiries?sponsorId=${sponsorId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      const json = await res.json();
      if (res.ok) setInquiries(json.inquiries ?? []);
    } catch {
      // 履歴が読めなくてもフォームは使える
    }
  }, [sponsorId, accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDone('');
    if (!message.trim()) return setError('お問い合わせ内容を入力してください');
    setBusy(true);
    try {
      const res = await fetch('/api/mypage/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ sponsorId, kind, message, contactName, phone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '送信に失敗しました');
      setInquiries((prev) => [json.inquiry, ...prev]);
      setMessage('');
      setOpen(false);
      setDone('お問い合わせを受け付けました。確認メールをお送りしています。担当者よりメールでご連絡します。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '通信エラーが発生しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-orange-500/40 bg-orange-500/5 p-5 space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold text-white">
        <Clapperboard className="h-4 w-4 text-orange-400" />
        CM放映・PR動画制作のお問い合わせ（企業枠）
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed">
        会場メインビジョンでのCM放映や、企業PRショート動画の制作についてのご相談はこちらから。内容を確認して、ご登録のメールアドレス宛にご連絡します。
      </p>

      {done && <p className="rounded-xl border border-teal-500/40 bg-teal-500/10 p-3 text-sm text-teal-300">{done}</p>}

      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setDone('');
          }}
          className="w-full sm:w-auto rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-zinc-950 hover:bg-orange-400"
        >
          問い合わせる
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelClass}>お問い合わせの種類</label>
            <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value)}>
              {Object.entries(INQUIRY_KINDS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>お問い合わせ内容</label>
            <textarea
              className={`${inputClass} min-h-[120px]`}
              maxLength={2000}
              placeholder="例：採用向けの30秒動画を作りたい／次回イベントでCMを流したい（素材はこちらで用意済み）など"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>ご担当者名（任意）</label>
              <input className={inputClass} maxLength={100} value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>電話番号（任意）</label>
              <input
                type="tel"
                inputMode="tel"
                className={inputClass}
                maxLength={30}
                placeholder="0143-00-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-zinc-950 hover:bg-orange-400 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {busy ? '送信中...' : '送信する'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError('');
              }}
              className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-bold text-zinc-300 hover:bg-zinc-800"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}

      {inquiries.length > 0 && (
        <div className="pt-2 border-t border-zinc-800 space-y-2">
          <p className="text-xs font-bold text-zinc-400">これまでのお問い合わせ</p>
          {inquiries.map((q) => (
            <div key={q.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs">
              <div className="flex justify-between gap-2 mb-1">
                <span className="font-bold text-zinc-200">{INQUIRY_KINDS[q.kind] ?? q.kind}</span>
                <span className="text-zinc-500">
                  {fmt(q.created_at)} ・ {q.status === 'done' ? '対応済み' : '受付済み'}
                </span>
              </div>
              <p className="text-zinc-400 whitespace-pre-wrap line-clamp-3">{q.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
