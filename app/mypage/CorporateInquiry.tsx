'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { INQUIRY_KINDS } from '@/lib/inquiries';
import { Badge, Button, Field, Notice, Section } from '@/components/ui';

type Inquiry = {
  id: string;
  kind: string;
  message: string;
  status: string;
  created_at: string;
};

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
    if (!message.trim()) return setError('ご相談の内容を書いてください');
    setBusy(true);
    try {
      const res = await fetch('/api/mypage/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ sponsorId, kind, message, contactName, phone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '送れませんでした');
      setInquiries((prev) => [json.inquiry, ...prev]);
      setMessage('');
      setOpen(false);
      setDone('ご相談を受け付けました。確認のメールをお送りしています。担当者からメールでご連絡します。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '通信できませんでした');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      id="inquiry"
      title="CM放映・PR動画の相談"
      description="会場メインビジョンでのCM放映や、企業PRショート動画の制作について相談できます。内容を確かめて、ご登録のメールアドレスにご連絡します。"
      action={
        !open ? (
          <Button
            variant="secondary"
            onClick={() => {
              setOpen(true);
              setDone('');
            }}
            className="w-full sm:w-auto"
          >
            相談する
          </Button>
        ) : null
      }
    >
      <div className="space-y-4">
        {done && <Notice tone="ok">{done}</Notice>}

        {open && (
          <form onSubmit={submit} className="rounded-panel border border-brand-line bg-paper p-5 sm:p-6">
            <div className="max-w-prose space-y-6">
              <Field label="相談したいこと" htmlFor="q-kind" required>
                <select id="q-kind" className="field-input" value={kind} onChange={(e) => setKind(e.target.value)}>
                  {Object.entries(INQUIRY_KINDS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="ご相談の内容"
                htmlFor="q-message"
                required
                hint="記入例：採用向けの30秒動画を作りたい。次のイベントでCMを流したい（素材はこちらで用意済み）。"
                error={error}
              >
                <textarea
                  id="q-message"
                  className="field-input"
                  maxLength={2000}
                  value={message}
                  aria-invalid={error ? true : undefined}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </Field>
              <Field label="ご担当者のお名前" htmlFor="q-name" optional>
                <input id="q-name" className="field-input" maxLength={100} autoComplete="name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </Field>
              <Field label="電話番号" htmlFor="q-phone" optional hint="記入例：0143-00-0000">
                <input
                  id="q-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className="field-input"
                  maxLength={30}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" disabled={busy}>
                  {busy ? '送っています…' : '相談を送る'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setOpen(false);
                    setError('');
                  }}
                >
                  やめる
                </Button>
              </div>
            </div>
          </form>
        )}

        {inquiries.length > 0 && (
          <div>
            <h3 className="text-[15px] font-bold">これまでのご相談</h3>
            <ul className="mt-2 divide-y divide-line rounded-panel border border-line bg-paper">
              {inquiries.map((q) => (
                <li key={q.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold">{INQUIRY_KINDS[q.kind] ?? q.kind}</span>
                    <span className="flex items-center gap-2 text-sm text-ink-2">
                      <span className="num">{fmt(q.created_at)}</span>
                      <Badge tone={q.status === 'done' ? 'ok' : 'neutral'}>{q.status === 'done' ? '対応済み' : '受付済み'}</Badge>
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-ink-2">{q.message}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Section>
  );
}
