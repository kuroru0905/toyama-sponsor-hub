'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Mic2, Send } from 'lucide-react';

const ACT_TYPES: { value: string; label: string }[] = [
  { value: 'band', label: 'バンド' },
  { value: 'dj', label: 'DJ' },
  { value: 'performance', label: 'パフォーマンス（ダンス・弾き語りなど）' },
  { value: 'other', label: 'その他' },
];

const STATUS: Record<string, { label: string; color: string }> = {
  submitted: { label: '受付済み', color: 'bg-zinc-700/40 text-zinc-200 border-zinc-600' },
  reviewing: { label: '選考中', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  accepted: { label: '採用', color: 'bg-teal-500/20 text-teal-300 border-teal-500/40' },
  declined: { label: '見送り', color: 'bg-red-500/20 text-red-300 border-red-500/40' },
};

const GROUP_RULE =
  'グループで応募する場合は、出演メンバー全員（未成年のメンバーはその保護者）が外山企画のスポンサー（どの枠でも可）としてご契約中である必要があります。';

// スマホでフォーカス時に拡大されないよう、スマホでは16px（text-base）
const inputClass =
  'w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-base sm:text-sm text-white focus:border-teal-400 focus:outline-none';
const labelClass = 'block text-xs font-bold text-zinc-300 mb-1.5';

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
  others: { name: string; email: string; guardian: boolean }[];
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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
}

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
      if (!res.ok) throw new Error(data.error || '応募情報の取得に失敗しました');
      setIsActive(Boolean(data.isActive));
      setEvents(data.events ?? []);
      setApplications(data.applications ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '応募情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [sponsorId, accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const memberCount = Number(form.memberCount) || 1;
  const isGroup = memberCount > 1;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (isGroup) {
      const blank = form.others.findIndex((m) => !m.name.trim() || !m.email.trim());
      if (blank !== -1) {
        setError(`${blank + 2}人目の名前とスポンサー登録メールアドレスを入力してください`);
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
          // 1人目は代表者（ログイン中の本人）。メールはサーバー側でログイン中のアドレスに置き換える
          members: isGroup
            ? [{ name: form.representativeName, email: loginEmail, guardian: false }, ...form.others]
            : [],
          eventId: form.eventId || null,
          genre: form.genre,
          links: form.links,
          message: form.message,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '応募に失敗しました');
      setMessage('応募を受け付けました！ 受付確認メールをお送りしました。選考結果もメールでお知らせします。');
      setForm(EMPTY);
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '応募に失敗しました');
    } finally {
      setSending(false);
    }
  };

  // 募集中のイベントも、これまでの応募もなければ欄ごと出さない
  const selectedEvent = events.find((ev) => ev.id === form.eventId);

  if (!loading && events.length === 0 && applications.length === 0 && !message && !error) return null;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5 mb-6">
      <div className="flex items-center gap-2 text-sm font-bold text-white mb-1">
        <Mic2 className="h-4 w-4 text-amber-400" />
        ステージ出演に応募する
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed mb-4">
        外山企画のイベントに、バンド・DJ・パフォーマンスとして出演応募できます。応募するとあなたと外山企画にメールが届き、選考結果もメールでお知らせします。
      </p>

      {message && (
        <div className="mb-4 rounded-xl border border-teal-500/40 bg-teal-500/10 p-3 text-sm text-teal-200">{message}</div>
      )}
      {error && <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      {loading ? (
        <p className="text-xs text-zinc-400">読み込み中...</p>
      ) : (
        <>
          {applications.length > 0 && (
            <div className="space-y-2 mb-4">
              <div className="text-xs font-bold text-zinc-400">これまでの応募</div>
              {applications.map((a) => {
                const st = STATUS[a.status] ?? STATUS.submitted;
                return (
                  <div key={a.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-bold text-white">{a.act_name}</span>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${st.color}`}>{st.label}</span>
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">
                      {a.event_title ?? '希望イベント指定なし'} ／ {a.member_count}人 ／ {formatDate(a.created_at)} 応募
                    </div>
                    {a.admin_note && (a.status === 'accepted' || a.status === 'declined') && (
                      <p className="mt-2 text-xs text-zinc-300 whitespace-pre-wrap">外山企画より：{a.admin_note}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!isActive ? (
            <p className="text-xs text-amber-300">ご契約が有効（契約中）になると、出演応募ができます。</p>
          ) : events.length === 0 ? (
            <p className="text-xs text-zinc-400">
              現在、出演者を募集中のイベントはありません。募集が始まるとここに応募欄が表示されます。
            </p>
          ) : !open ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3">
                <div className="text-xs font-bold text-amber-300 mb-1.5">出演者募集中のイベント</div>
                <ul className="space-y-1">
                  {events.map((ev) => (
                    <li key={ev.id} className="text-sm text-white">
                      {formatDate(ev.starts_at)} {ev.title}
                      <span className="block text-xs text-zinc-400">締切：{formatDateTime(ev.recruit_deadline)}</span>
                      <span className="block text-xs text-zinc-400">募集する出演形態：{typeLabels(ev)}</span>
                      {ev.recruit_note && (
                        <span className="block text-xs text-amber-200">ジャンル・条件：{ev.recruit_note}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            <button
              type="button"
              onClick={() => {
                setMessage('');
                const only = events.length === 1 ? events[0] : undefined;
                setForm({
                  ...EMPTY,
                  representativeName: defaultName,
                  eventId: only ? only.id : '',
                  actType: allowedTypes(only)[0],
                });
                setOpen(true);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-400/10 px-5 py-3 text-sm font-bold text-amber-300 hover:bg-amber-400/20"
            >
              <Mic2 className="h-4 w-4" />
              出演応募フォームを開く
            </button>
            </div>
          ) : (
            <form onSubmit={submit} className="rounded-xl border border-amber-400/30 bg-zinc-900 p-4 space-y-4">
              <div>
                <label className={labelClass}>出演するイベント</label>
                <select
                  className={inputClass}
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
                      {formatDate(ev.starts_at)} {ev.title}（締切 {formatDate(ev.recruit_deadline)}）
                    </option>
                  ))}
                </select>
                {selectedEvent?.recruit_note && (
                  <p className="mt-1.5 text-xs text-amber-200">募集するジャンル・条件：{selectedEvent.recruit_note}</p>
                )}
              </div>

              <div>
                <label className={labelClass}>出演形態</label>
                <select
                  className={inputClass}
                  value={form.actType}
                  onChange={(e) => setForm({ ...form, actType: e.target.value })}
                >
                  {ACT_TYPES.filter((t) => allowedTypes(selectedEvent).indexOf(t.value) >= 0).map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>出演名義（バンド名・DJ名など）</label>
                <input
                  className={inputClass}
                  value={form.actName}
                  maxLength={60}
                  required
                  onChange={(e) => setForm({ ...form, actName: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>代表者名</label>
                  <input
                    className={inputClass}
                    value={form.representativeName}
                    maxLength={60}
                    required
                    onChange={(e) => setForm({ ...form, representativeName: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>出演人数</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={30}
                    className={inputClass}
                    value={form.memberCount}
                    required
                    onChange={(e) => {
                      const n = Math.min(30, Math.max(1, Number(e.target.value) || 1));
                      const others = form.others.slice(0, n - 1);
                      while (others.length < n - 1) others.push({ name: '', email: '', guardian: false });
                      setForm({ ...form, memberCount: e.target.value, others });
                    }}
                  />
                </div>
              </div>

              {isGroup && (
                <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 space-y-3">
                  <p className="text-xs text-amber-200 leading-relaxed font-bold">{GROUP_RULE}</p>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    メンバー全員の名前と、スポンサー登録しているメールアドレスを入力してください。応募時に、全員が契約中のスポンサーかをシステムで確認します。
                  </p>
                  <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-3">
                    <div className="text-xs font-bold text-zinc-400">1人目（代表者・あなた）</div>
                    <div className="text-sm text-white">{form.representativeName || '（代表者名を入力してください）'}</div>
                    <div className="text-xs text-zinc-400 break-all">{loginEmail}</div>
                  </div>
                  {form.others.map((m, i) => (
                    <div key={i} className="rounded-lg border border-zinc-700 bg-zinc-950 p-3 space-y-2">
                      <div className="text-xs font-bold text-zinc-400">{i + 2}人目</div>
                      <input
                        className={inputClass}
                        value={m.name}
                        maxLength={40}
                        required
                        placeholder="名前（例：佐藤花子・Gt）"
                        onChange={(e) => {
                          const others = form.others.slice();
                          others[i] = { ...m, name: e.target.value };
                          setForm({ ...form, others });
                        }}
                      />
                      <input
                        type="email"
                        inputMode="email"
                        autoComplete="off"
                        className={inputClass}
                        value={m.email}
                        required
                        placeholder="スポンサー登録メールアドレス"
                        onChange={(e) => {
                          const others = form.others.slice();
                          others[i] = { ...m, email: e.target.value };
                          setForm({ ...form, others });
                        }}
                      />
                      <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={m.guardian}
                          onChange={(e) => {
                            const others = form.others.slice();
                            others[i] = { ...m, guardian: e.target.checked };
                            setForm({ ...form, others });
                          }}
                        />
                        未成年のため、保護者のスポンサー登録アドレスを入力
                      </label>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className={labelClass}>ジャンル（任意）</label>
                <input
                  className={inputClass}
                  value={form.genre}
                  maxLength={60}
                  placeholder="例：ロック、ヒップホップ、ハウス"
                  onChange={(e) => setForm({ ...form, genre: e.target.value })}
                />
              </div>

              <div>
                <label className={labelClass}>音源・動画・SNSのURL（任意）</label>
                <textarea
                  className={`${inputClass} min-h-[70px]`}
                  value={form.links}
                  maxLength={500}
                  placeholder="YouTube・Instagram・SoundCloud など"
                  onChange={(e) => setForm({ ...form, links: e.target.value })}
                />
              </div>

              <div>
                <label className={labelClass}>PR・意気込み（任意）</label>
                <textarea
                  className={`${inputClass} min-h-[100px]`}
                  value={form.message}
                  maxLength={1000}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                />
              </div>

              {error && (
                <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                  {error}
                </div>
              )}
              <div className="flex flex-col-reverse sm:flex-row gap-2">
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => setOpen(false)}
                  className="w-full sm:w-auto rounded-xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-bold text-zinc-300 hover:bg-zinc-800"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={sending || !form.eventId}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-6 py-3 text-sm font-bold text-zinc-950 hover:bg-amber-300 transition disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {sending ? '送信中...' : 'この内容で応募する'}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
