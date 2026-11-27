'use client';

// 公開の出演応募ページ（スポンサー契約がなくても、誰でも応募できる）
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Field, Notice, Wordmark } from '@/components/ui';

const ACT_TYPES: { value: string; label: string }[] = [
  { value: 'band', label: 'バンド' },
  { value: 'dj', label: 'DJ' },
  { value: 'performance', label: 'パフォーマンス（ダンス・弾き語りなど）' },
  { value: 'other', label: 'その他' },
];
const ALL_TYPES = ACT_TYPES.map((t) => t.value);

type EventOption = {
  id: string;
  title: string;
  venue: string;
  starts_at: string;
  recruit_deadline: string;
  recruit_act_types: string[] | null;
  recruit_note: string | null;
};

const allowedTypes = (ev?: EventOption) => (ev && ev.recruit_act_types && ev.recruit_act_types.length > 0 ? ev.recruit_act_types : ALL_TYPES);
const typeLabels = (ev: EventOption) =>
  allowedTypes(ev)
    .map((t) => ACT_TYPES.find((x) => x.value === t)?.label ?? t)
    .join('／');
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short' });
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });

const EMPTY = {
  eventId: '',
  actType: 'band',
  actName: '',
  representativeName: '',
  email: '',
  memberCount: '1',
  memberNames: '',
  genre: '',
  links: '',
  message: '',
  minorConsent: false,
  website: '', // ボット除け（人には見えない）
};

export default function PerformPage() {
  const [events, setEvents] = useState<EventOption[] | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/perform', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        const list: EventOption[] = j.events ?? [];
        setEvents(list);
        if (list.length === 1) setForm((f) => ({ ...f, eventId: list[0].id, actType: allowedTypes(list[0])[0] }));
      })
      .catch(() => setEvents([]));
  }, []);

  const selected = events?.find((e) => e.id === form.eventId);
  const memberCount = Number(form.memberCount) || 1;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const res = await fetch('/api/perform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, memberCount }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || '応募できませんでした');
      setDone(selected?.title ?? '');
      setForm(EMPTY);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : '応募できませんでした');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      <header className="glass sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4">
          <Link href="/" className="text-lg">
            <Wordmark />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight sm:text-[40px]">出演応募</h1>
        <p className="mt-3 max-w-prose text-[17px] leading-relaxed text-ink-2">
          外山企画のライブに、バンド・DJ・パフォーマンスとして出演しませんか。どなたでも応募できます。選考の結果はメールでお知らせします。
        </p>
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-ink-2">
          募集の開始は、まちきっぷ パートナーズ（サポーター）の方に一般告知より先にお知らせしています。
          <Link href="/#plans" className="ml-1 font-semibold text-brand hover:underline">
            パートナーズについて
          </Link>
        </p>

        {done !== null ? (
          <div className="mt-8 space-y-4">
            <Notice tone="ok" title="応募を受け付けました">
              {done ? `「${done}」への応募ありがとうございます。` : '応募ありがとうございます。'}
              確認のメールをお送りしました。選考の結果も、ご入力のメールアドレスにお知らせします。
            </Notice>
            <Button variant="secondary" onClick={() => setDone(null)}>
              別のライブにも応募する
            </Button>
          </div>
        ) : events === null ? (
          <p className="mt-8 text-ink-2">読み込んでいます…</p>
        ) : events.length === 0 ? (
          <Notice className="mt-8" tone="info">
            いま出演者を募集しているライブはありません。募集が始まったら、公式LINEでお知らせします。
          </Notice>
        ) : (
          <form onSubmit={submit} className="card mt-8 p-6 sm:p-8">
            <div className="max-w-prose space-y-6">
              <Field label="出演するライブ" htmlFor="f-event" required>
                <select
                  id="f-event"
                  className="field-input"
                  value={form.eventId}
                  required
                  onChange={(e) => {
                    const ev = events.find((x) => x.id === e.target.value);
                    const types = allowedTypes(ev);
                    setForm({ ...form, eventId: e.target.value, actType: types.indexOf(form.actType) >= 0 ? form.actType : types[0] });
                  }}
                >
                  <option value="" disabled>
                    選んでください
                  </option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {fmtDate(ev.starts_at)} {ev.title}（締切 {fmtDate(ev.recruit_deadline)}）
                    </option>
                  ))}
                </select>
                {selected && (
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">
                    会場：{selected.venue}／応募締切：{fmtDateTime(selected.recruit_deadline)}
                    {selected.recruit_note ? `／条件：${selected.recruit_note}` : ''}
                  </p>
                )}
              </Field>

              <Field label="出演形態" htmlFor="f-type" required hint={selected ? `このライブで募集しているのは「${typeLabels(selected)}」です。` : undefined}>
                <select id="f-type" className="field-input" value={form.actType} onChange={(e) => setForm({ ...form, actType: e.target.value })}>
                  {ACT_TYPES.filter((t) => allowedTypes(selected).indexOf(t.value) >= 0).map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="出演名義" htmlFor="f-act" required hint="バンド名・DJ名など">
                <input id="f-act" className="field-input" maxLength={60} required value={form.actName} onChange={(e) => setForm({ ...form, actName: e.target.value })} />
              </Field>

              <Field label="代表者のお名前" htmlFor="f-rep" required>
                <input id="f-rep" className="field-input" autoComplete="name" maxLength={60} required value={form.representativeName} onChange={(e) => setForm({ ...form, representativeName: e.target.value })} />
              </Field>

              <Field label="代表者のメールアドレス" htmlFor="f-mail" required hint="選考の結果をお送りします。">
                <input
                  id="f-mail"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  className="field-input"
                  maxLength={254}
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>

              <Field label="出演する人数" htmlFor="f-count" required>
                <input
                  id="f-count"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={30}
                  className="field-input max-w-[8rem]"
                  required
                  value={form.memberCount}
                  onChange={(e) => setForm({ ...form, memberCount: e.target.value })}
                />
              </Field>

              {memberCount > 1 && (
                <Field label="メンバーのお名前" htmlFor="f-members" required hint="代表者を含めて、全員のお名前と担当を書いてください。記入例：山田 太郎（ボーカル）、佐藤 花子（ギター）">
                  <textarea id="f-members" className="field-input" maxLength={600} required value={form.memberNames} onChange={(e) => setForm({ ...form, memberNames: e.target.value })} />
                </Field>
              )}

              <Field label="ジャンル" htmlFor="f-genre" optional hint="記入例：ロック、ヒップホップ、ハウス">
                <input id="f-genre" className="field-input" maxLength={60} value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} />
              </Field>

              <Field label="音源・動画・SNSのURL" htmlFor="f-links" optional hint="YouTube・Instagram・SoundCloud など。複数あれば改行で区切ってください。">
                <textarea id="f-links" className="field-input" maxLength={500} value={form.links} onChange={(e) => setForm({ ...form, links: e.target.value })} />
              </Field>

              <Field label="PR・意気込み" htmlFor="f-msg" optional>
                <textarea id="f-msg" className="field-input" maxLength={1000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              </Field>

              {/* ボット除け：画面にも読み上げにも出さない */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
                <label htmlFor="f-website">ウェブサイト</label>
                <input id="f-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              </div>

              <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-relaxed">
                <input type="checkbox" className="mt-1.5" checked={form.minorConsent} onChange={(e) => setForm({ ...form, minorConsent: e.target.checked })} required />
                <span>メンバーに未成年がいる場合は、その保護者の同意を得ています（いない場合もチェックしてください）</span>
              </label>

              <p className="text-sm leading-relaxed text-ink-2">
                ご入力の内容は、出演の選考とご連絡のためだけに使います。くわしくは
                <Link href="/privacy" className="text-brand hover:underline">
                  プライバシーポリシー
                </Link>
                をご覧ください。
              </p>

              {error && <Notice tone="danger">{error}</Notice>}

              <Button type="submit" disabled={sending || !form.eventId} className="w-full sm:w-auto">
                {sending ? '送っています…' : 'この内容で応募する'}
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
