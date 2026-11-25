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
}

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
  memberNames: string;
  confirmed: boolean;
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
  memberNames: '',
  confirmed: false,
  eventId: '',
  genre: '',
  links: '',
  message: '',
};

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
}

export default function PerformerApplication({ sponsorId, accessToken, defaultName }: Props) {
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
    if (isGroup && !form.confirmed) {
      setError(GROUP_RULE);
      return;
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
          memberNames: isGroup ? form.memberNames : '',
          allMembersSponsorConfirmed: isGroup ? form.confirmed : false,
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
          ) : !open ? (
            <button
              type="button"
              onClick={() => {
                setMessage('');
                setForm({ ...EMPTY, representativeName: defaultName });
                setOpen(true);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-400/10 px-5 py-3 text-sm font-bold text-amber-300 hover:bg-amber-400/20"
            >
              <Mic2 className="h-4 w-4" />
              出演応募フォームを開く
            </button>
          ) : (
            <form onSubmit={submit} className="rounded-xl border border-amber-400/30 bg-zinc-900 p-4 space-y-4">
              <div>
                <label className={labelClass}>出演形態</label>
                <select
                  className={inputClass}
                  value={form.actType}
                  onChange={(e) => setForm({ ...form, actType: e.target.value })}
                >
                  {ACT_TYPES.map((t) => (
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
                    onChange={(e) => setForm({ ...form, memberCount: e.target.value })}
                  />
                </div>
              </div>

              {isGroup && (
                <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 space-y-3">
                  <p className="text-xs text-amber-200 leading-relaxed font-bold">{GROUP_RULE}</p>
                  <div>
                    <label className={labelClass}>メンバー全員の名前（代表者を含む）</label>
                    <textarea
                      className={`${inputClass} min-h-[80px]`}
                      value={form.memberNames}
                      maxLength={500}
                      required
                      placeholder="例：山田太郎（Vo）、佐藤花子（Gt）…"
                      onChange={(e) => setForm({ ...form, memberNames: e.target.value })}
                    />
                  </div>
                  <label className="flex items-start gap-2.5 text-sm text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.confirmed}
                      onChange={(e) => setForm({ ...form, confirmed: e.target.checked })}
                      className="mt-1 h-5 w-5 shrink-0 rounded border-zinc-600 bg-zinc-950 text-teal-400"
                    />
                    メンバー全員（未成年のメンバーはその保護者）がスポンサーとして契約中であることを確認しました
                  </label>
                </div>
              )}

              <div>
                <label className={labelClass}>出演を希望するイベント</label>
                <select
                  className={inputClass}
                  value={form.eventId}
                  onChange={(e) => setForm({ ...form, eventId: e.target.value })}
                >
                  <option value="">指定なし（どのイベントでも）</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {formatDate(ev.starts_at)} {ev.title}
                    </option>
                  ))}
                </select>
              </div>

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
                  disabled={sending || (isGroup && !form.confirmed)}
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
