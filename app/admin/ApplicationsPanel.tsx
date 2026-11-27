'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Mic2, RefreshCw } from 'lucide-react';

const ACT_TYPES: Record<string, string> = {
  band: 'バンド',
  dj: 'DJ',
  performance: 'パフォーマンス',
  other: 'その他',
};

const STATUS: Record<string, { label: string; color: string }> = {
  submitted: { label: '受付済み', color: 'bg-surface text-ink border-line-strong' },
  reviewing: { label: '選考中', color: 'bg-warn-soft text-warn border-warn-line' },
  accepted: { label: '採用', color: 'bg-brand-soft text-brand border-brand-line' },
  declined: { label: '見送り', color: 'bg-danger-soft text-danger border-danger-line' },
};

const TIER_LABEL: Record<string, string> = { corporate: '企業枠', store: '店舗枠', fan: 'ファン枠' };

interface Application {
  id: string;
  applicant_email: string;
  act_type: string;
  act_name: string;
  representative_name: string;
  member_count: number;
  member_names: string;
  all_members_sponsor_confirmed: boolean;
  members: { name: string; email?: string; guardian?: boolean; verified?: boolean }[] | null;
  source?: 'mypage' | 'public';
  genre: string;
  links: string;
  message: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  sponsor_name: string | null;
  sponsor_tier: string | null;
  sponsor_status: string | null;
  event_title: string | null;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ApplicationsPanel({ accessToken }: { accessToken: string }) {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/applications', {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '応募一覧の取得に失敗しました');
      setApps(data.applications ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '応募一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (a: Application, status: string) => {
    const note = (notes[a.id] ?? a.admin_note ?? '').trim();
    if (status === 'accepted' || status === 'declined') {
      const label = status === 'accepted' ? '採用' : '見送り';
      if (!window.confirm(`「${a.act_name}」を${label}にして、応募者（${a.applicant_email}）に結果メールを送りますか？`)) return;
    }
    setBusyId(a.id);
    setError('');
    setToast('');
    try {
      const res = await fetch('/api/admin/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ id: a.id, status, adminNote: note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '更新に失敗しました');
      const label = STATUS[status]?.label ?? status;
      setToast(
        status === 'accepted' || status === 'declined'
          ? data.mailed
            ? `「${a.act_name}」を${label}にして、結果メールを送りました。`
            : `「${a.act_name}」を${label}にしました。※結果メールは送れませんでした（メール設定を確認してください）。`
          : `「${a.act_name}」を${label}にしました。`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新に失敗しました');
    } finally {
      setBusyId(null);
    }
  };

  const shown = filter === 'open' ? apps.filter((a) => a.status === 'submitted' || a.status === 'reviewing') : apps;
  const openCount = apps.filter((a) => a.status === 'submitted' || a.status === 'reviewing').length;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Mic2 className="h-5 w-5 text-warn" />
          <h2 className="text-lg sm:text-xl font-semibold text-ink">出演応募</h2>
          {openCount > 0 && (
            <span className="rounded-full bg-accent px-2.5 py-0.5 text-sm font-semibold text-accent-ink">未対応 {openCount}</span>
          )}
        </div>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'open' | 'all')}
            className="rounded-ctl border border-line-strong bg-paper px-3 py-2 text-base font-semibold text-ink"
          >
            <option value="open">未対応のみ</option>
            <option value="all">すべて</option>
          </select>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-ctl border border-line-strong bg-paper px-3 py-2 text-sm font-semibold text-ink hover:bg-surface"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            更新
          </button>
        </div>
      </div>

      {toast && <div className="mb-4 rounded-ctl border border-brand-line bg-brand-soft p-3 text-sm text-brand">{toast}</div>}
      {error && <div className="mb-4 rounded-ctl border border-danger-line bg-danger-soft p-3 text-sm text-danger">{error}</div>}

      {loading ? (
        <p className="text-sm text-ink-2">読み込み中...</p>
      ) : shown.length === 0 ? (
        <div className="rounded-panel bg-paper shadow-card p-6 text-sm text-ink-2">
          {filter === 'open' ? '未対応の出演応募はありません。' : '出演応募はまだありません。'}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((a) => {
            const st = STATUS[a.status] ?? STATUS.submitted;
            const expanded = openId === a.id;
            const sponsorInactive = a.sponsor_name !== null && a.sponsor_status !== 'active';
            return (
              <div key={a.id} className="rounded-panel bg-paper shadow-card p-4 sm:p-5">
                <button type="button" onClick={() => setOpenId(expanded ? null : a.id)} className="w-full text-left">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-base font-semibold text-ink">
                      {a.act_name}
                      <span className="ml-2 text-sm font-normal text-ink-2">
                        {ACT_TYPES[a.act_type] ?? a.act_type}・{a.member_count}人
                      </span>
                    </div>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${st.color}`}>{st.label}</span>
                  </div>
                  <div className="mt-1 text-sm text-ink-2">
                    {a.event_title ?? '希望イベント指定なし'} ／ {formatDateTime(a.created_at)} 応募 ／{' '}
                    {a.sponsor_name ? `契約：${a.sponsor_name}（${TIER_LABEL[a.sponsor_tier ?? ''] ?? '-'}）` : '一般応募（スポンサー契約なし）'}
                  </div>
                </button>

                {expanded && (
                  <div className="mt-4 border-t border-line pt-4 space-y-3 text-sm">
                    {sponsorInactive && (
                      <p className="rounded-lg border border-danger-line bg-danger-soft p-2 text-sm text-danger">
                        ⚠️ 応募した契約は現在「契約中」ではありません（{a.sponsor_status}）。
                      </p>
                    )}
                    <dl className="grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-ink">
                      <dt className="text-sm font-semibold text-ink-2">代表者</dt>
                      <dd>{a.representative_name}（{a.applicant_email}）</dd>
                      {a.member_count > 1 && (
                        <>
                          <dt className="text-sm font-semibold text-ink-2">メンバー</dt>
                          <dd>
                            {a.members && a.members.length > 0 ? (
                              <ul className="space-y-1">
                                {a.members.map((m, i) => (
                                  <li key={i} className="text-sm">
                                    {m.name}
                                    {m.email && (
                                      <span className="text-sm text-ink-2">
                                        （{m.email}
                                        {m.guardian ? '・保護者' : ''}）
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="whitespace-pre-wrap">
                                {a.member_names}

                              </span>
                            )}
                          </dd>
                        </>
                      )}
                      <dt className="text-sm font-semibold text-ink-2">ジャンル</dt>
                      <dd>{a.genre || '-'}</dd>
                      <dt className="text-sm font-semibold text-ink-2">音源・SNS</dt>
                      <dd className="whitespace-pre-wrap break-all">{a.links || '-'}</dd>
                      <dt className="text-sm font-semibold text-ink-2">PR</dt>
                      <dd className="whitespace-pre-wrap">{a.message || '-'}</dd>
                    </dl>

                    <div>
                      <label className="block text-sm font-semibold text-ink mb-1.5">応募者へのメッセージ（採用・見送りのメールに載ります）</label>
                      <textarea
                        className="w-full min-h-[80px] rounded-ctl border border-line-strong bg-paper px-4 py-3 text-base sm:text-sm text-ink focus:border-brand focus:outline-none"
                        value={notes[a.id] ?? a.admin_note ?? ''}
                        maxLength={1000}
                        placeholder="例：6月のMMSで20分のステージをお願いしたいです。詳細は公式LINEで連絡します。"
                        onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        disabled={busyId === a.id}
                        onClick={() => update(a, 'reviewing')}
                        className="rounded-ctl border border-warn-line bg-warn-soft px-4 py-3 text-sm font-semibold text-warn hover:bg-warn-soft disabled:opacity-50"
                      >
                        選考中にする
                      </button>
                      <button
                        type="button"
                        disabled={busyId === a.id}
                        onClick={() => update(a, 'accepted')}
                        className="rounded-ctl bg-brand px-4 py-3 text-sm font-semibold text-brand-ink hover:bg-brand-hover disabled:opacity-50"
                      >
                        採用（メール送信）
                      </button>
                      <button
                        type="button"
                        disabled={busyId === a.id}
                        onClick={() => update(a, 'declined')}
                        className="rounded-ctl border border-danger-line bg-danger-soft px-4 py-3 text-sm font-semibold text-danger hover:bg-danger-soft disabled:opacity-50"
                      >
                        見送り（メール送信）
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
