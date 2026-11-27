'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Field, Notice, Section } from '@/components/ui';

const ACT_TYPES: { value: string; label: string }[] = [
  { value: 'band', label: 'バンド' },
  { value: 'dj', label: 'DJ' },
  { value: 'performance', label: 'パフォーマンス（ダンス・弾き語りなど）' },
  { value: 'other', label: 'その他' },
];

const STATUS: Record<string, { label: string; tone: 'neutral' | 'warn' | 'ok' | 'danger' }> = {
  submitted: { label: '受付済み', tone: 'neutral' },
  reviewing: { label: '選考中', tone: 'warn' },
  accepted: { label: '出演決定', tone: 'ok' },
  declined: { label: '今回は見送り', tone: 'danger' },
};

interface EventOption {
  id: string;
  title: string;
  starts_at: string;
  recruit_deadline: string;
  recruit_act_types: string[] | null;
  recruit_note: string | null;
}

const ALL_TYPES = ['band', 'dj', 'performance', 'other'];
// そのイベントで募集している出演形態（未選択なら全部）
const allowedTypes = (ev?: EventOption) =>
  ev && ev.recruit_act_types && ev.recruit_act_types.length > 0 ? ev.recruit_act_types : ALL_TYPES;
const typeLabels = (ev: EventOption) =>
  allowedTypes(ev)
    .map((t) => ACT_TYPES.find((x) => x.value === t)?.label ?? t)
    .join('／');

interface Application {
  id: string;
  act_type: string;
  act_name: string;
  member_count: number;
  status: string;
  admin_note: string | null;
  created_at: string;
  event_title: string | null;
}

interface FormState {
  actType: string;
  actName: string;
  representativeName: string;
  memberCount: string;
  // グループの2人目以降（代表者はログイン中の本人）
  others: { name: string }[];
  eventId: string;
  genre: string;
  links: string;
  message: string;
}

const EMPTY: FormState = {
  actType: 'band',
  actName: '',
  representativeName: '',
  memberCount: '1',
  others: [],
  eventId: '',
  genre: '',
  links: '',
  message: '',
};

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short' });

interface Props {
  sponsorId: string;
  accessToken: string;
  defaultName: string;
  loginEmail: string;
}

export default function PerformerApplication({ sponsorId, accessToken, defaultName, loginEmail }: Props) {
  const [isActive, setIsActive] = useState(false);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/mypage/applications?sponsorId=${encodeURIComponent(sponsorId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '応募の情報を読み込めませんでした');
      setIsActive(Boolean(data.isActive));
      setEvents(data.events ?? []);
      setApplications(data.applications ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '応募の情報を読み込めませんでした');
    } finally {
      setLoading(false);
    }
  }, [sponsorId, accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const memberCount = Number(form.memberCount) || 1;
  const isGroup = memberCount > 1;
  const selectedEvent = events.find((ev) => ev.id === form.eventId);

  const startForm = (ev?: EventOption) => {
    setMessage('');
    setError('');
    const target = ev ?? (events.length === 1 ? events[0] : undefined);
    setForm({ ...EMPTY, representativeName: defaultName, eventId: target ? target.id : '', actType: allowedTypes(target)[0] });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (isGroup) {
      const blank = form.others.findIndex((m) => !m.name.trim());
      if (blank !== -1) {
        setError(`${blank + 2}人目の名前を入れてください`);
        return;
      }
    }
    setSending(true);
    try {
      const res = await fetch('/api/mypage/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          sponsorId,
          actType: form.actType,
          actName: form.actName,
          representativeName: form.representativeName,
          memberCount,
          // 1人目は代表者（ログイン中の本人）
          members: isGroup ? [{ name: form.representativeName }, ...form.others] : [],
          eventId: form.eventId || null,
          genre: form.genre,
          links: form.links,
          message: form.message,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '応募できませんでした');
      setMessage('応募を受け付けました。確認のメールをお送りしています。選考の結果もメールでお知らせします。');
      setForm(EMPTY);
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '応募できませんでした');
    } finally {
      setSending(false);
    }
  };

  const setOther = (i: number, patch: Partial<FormState['others'][number]>) => {
    const others = form.others.slice();
    others[i] = { ...others[i], ...patch };
    setForm({ ...form, others });
  };

  return (
    <Section
      id="perform"
      title="出演応募"
      description="外山企画のライブに、バンド・DJ・パフォーマンスとして出演を応募できます。応募するとあなたと外山企画にメールが届き、選考の結果もメールでお知らせします。"
    >
      <div className="space-y-6">
        {message && <Notice tone="ok">{message}</Notice>}
        {error && !open && <Notice tone="danger">{error}</Notice>}

        {loading ? (
          <p className="text-ink-2">読み込んでいます…</p>
        ) : (
          <>
            {!open && (
              <div>
                <h3 className="text-[15px] font-semibold">出演者を募集しているライブ</h3>
                {!isActive ? (
                  <p className="mt-2 text-ink-2">
                    出演応募は、
                    <a href="/perform" className="font-semibold text-brand hover:underline">
                      公開の応募ページ
                    </a>
                    からどなたでもできます。
                  </p>
                ) : events.length === 0 ? (
                  <p className="mt-2 text-ink-2">いま募集しているライブはありません。募集が始まったら、メールと公式LINEでお知らせします。</p>
                ) : (
                  <ul className="mt-2 divide-y divide-line rounded-panel bg-surface overflow-hidden">
                    {events.map((ev) => (
                      <li key={ev.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold">{ev.title}</p>
                          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-sm text-ink-2">
                            <dt>開演</dt>
                            <dd className="num text-[15px] text-ink">{fmtDate(ev.starts_at)}</dd>
                            <dt>締切</dt>
                            <dd className="num text-[15px] text-ink">{fmtDateTime(ev.recruit_deadline)}</dd>
                            <dt>形態</dt>
                            <dd className="text-ink">{typeLabels(ev)}</dd>
                            {ev.recruit_note && (
                              <>
                                <dt>条件</dt>
                                <dd className="text-ink">{ev.recruit_note}</dd>
                              </>
                            )}
                          </dl>
                        </div>
                        <Button onClick={() => startForm(ev)} className="w-full shrink-0 sm:w-auto">
                          このライブに応募
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {open && (
              <form onSubmit={submit} className="rounded-panel bg-surface p-5 sm:p-6">
                <h3 className="text-lg font-semibold">出演の応募</h3>
                <div className="mt-5 max-w-prose space-y-6">
                  <Field label="出演するライブ" htmlFor="p-event" required>
                    <select
                      id="p-event"
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
                    {selectedEvent?.recruit_note && (
                      <p className="mt-2 text-sm text-ink-2">募集するジャンル・条件：{selectedEvent.recruit_note}</p>
                    )}
                  </Field>

                  <Field label="出演形態" htmlFor="p-type" required hint={selectedEvent ? `このライブで募集しているのは「${typeLabels(selectedEvent)}」です。` : undefined}>
                    <select id="p-type" className="field-input" value={form.actType} onChange={(e) => setForm({ ...form, actType: e.target.value })}>
                      {ACT_TYPES.filter((t) => allowedTypes(selectedEvent).indexOf(t.value) >= 0).map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="出演名義" htmlFor="p-name" required hint="バンド名・DJ名など">
                    <input id="p-name" className="field-input" value={form.actName} maxLength={60} required onChange={(e) => setForm({ ...form, actName: e.target.value })} />
                  </Field>

                  <Field label="代表者のお名前" htmlFor="p-rep" required>
                    <input
                      id="p-rep"
                      className="field-input"
                      autoComplete="name"
                      value={form.representativeName}
                      maxLength={60}
                      required
                      onChange={(e) => setForm({ ...form, representativeName: e.target.value })}
                    />
                  </Field>

                  <Field label="出演する人数" htmlFor="p-count" required hint="1人なら1。">
                    <input
                      id="p-count"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={30}
                      className="field-input max-w-[8rem]"
                      value={form.memberCount}
                      required
                      onChange={(e) => {
                        const n = Math.min(30, Math.max(1, Number(e.target.value) || 1));
                        const others = form.others.slice(0, n - 1);
                        while (others.length < n - 1) others.push({ name: '' });
                        setForm({ ...form, memberCount: e.target.value, others });
                      }}
                    />
                  </Field>

                  {isGroup && (
                    <fieldset className="space-y-4">
                      <legend className="text-[15px] font-semibold">メンバー</legend>
                      <p className="text-sm leading-relaxed text-ink-2">メンバー全員のお名前を入れてください。メンバーにスポンサー契約は必要ありません。</p>
                      <div className="rounded-ctl border border-line bg-surface px-4 py-3">
                        <p className="text-sm font-semibold text-ink-2">1人目（代表者・あなた）</p>
                        <p className="font-semibold">{form.representativeName || '代表者のお名前を入れてください'}</p>
                        <p className="break-all text-sm text-ink-2">{loginEmail}</p>
                      </div>
                      {form.others.map((m, i) => (
                        <div key={i} className="space-y-4 rounded-ctl border border-line px-4 py-4">
                          <p className="text-sm font-semibold text-ink-2">{i + 2}人目</p>
                          <Field label="お名前" htmlFor={`p-m${i}-name`} required hint="記入例：佐藤 花子（ギター）">
                            <input id={`p-m${i}-name`} className="field-input" value={m.name} maxLength={40} required onChange={(e) => setOther(i, { name: e.target.value })} />
                          </Field>
                        </div>
                      ))}
                    </fieldset>
                  )}

                  <Field label="ジャンル" htmlFor="p-genre" optional hint="記入例：ロック、ヒップホップ、ハウス">
                    <input id="p-genre" className="field-input" value={form.genre} maxLength={60} onChange={(e) => setForm({ ...form, genre: e.target.value })} />
                  </Field>

                  <Field label="音源・動画・SNSのURL" htmlFor="p-links" optional hint="YouTube・Instagram・SoundCloud など。複数あれば改行で区切ってください。">
                    <textarea id="p-links" className="field-input" value={form.links} maxLength={500} onChange={(e) => setForm({ ...form, links: e.target.value })} />
                  </Field>

                  <Field label="PR・意気込み" htmlFor="p-msg" optional>
                    <textarea id="p-msg" className="field-input" value={form.message} maxLength={1000} onChange={(e) => setForm({ ...form, message: e.target.value })} />
                  </Field>

                  {error && <Notice tone="danger">{error}</Notice>}

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="submit" disabled={sending || !form.eventId}>
                      {sending ? '送っています…' : 'この内容で応募する'}
                    </Button>
                    <Button variant="secondary" disabled={sending} onClick={() => setOpen(false)}>
                      やめる
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {applications.length > 0 && (
              <div>
                <h3 className="text-[15px] font-semibold">これまでの応募</h3>
                <ul className="mt-2 divide-y divide-line rounded-panel bg-surface overflow-hidden">
                  {applications.map((a) => {
                    const st = STATUS[a.status] ?? STATUS.submitted;
                    return (
                      <li key={a.id} className="px-5 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold">{a.act_name}</span>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-ink-2">
                          {a.event_title ?? 'ライブの指定なし'}・{a.member_count}人・{fmtDate(a.created_at)}に応募
                        </p>
                        {a.admin_note && (a.status === 'accepted' || a.status === 'declined') && (
                          <p className="mt-2 whitespace-pre-wrap rounded-ctl bg-surface px-3 py-2 text-sm">外山企画より：{a.admin_note}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </Section>
  );
}
