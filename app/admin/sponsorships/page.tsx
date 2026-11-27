'use client';

// 管理画面：イベントごとの協賛企業・お店（金額・支払い状態・フォロー期間中かどうか）
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAdmin } from '../AdminShell';

type Row = {
  id: string;
  tier: 'corporate' | 'store';
  amount: number;
  status: 'pending' | 'paid' | 'refunded';
  paymentMethod: 'card' | 'invoice';
  paidAt: string | null;
  followEnd: string;
  inFollow: boolean;
  displayName: string;
  applicantName: string;
  email: string;
};
type Ev = { id: string; title: string; venue: string; starts_at: string; is_published: boolean; cancelled_at: string | null; sponsorships: Row[] };

const jst = (v: string) =>
  new Date(v.length === 10 ? `${v}T00:00:00+09:00` : v).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' });
const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;

export default function AdminSponsorshipsPage() {
  const { token } = useAdmin();
  const [events, setEvents] = useState<Ev[]>([]);
  const [caps, setCaps] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [onlyWith, setOnlyWith] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/sponsorships', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || '読み込めませんでした');
      setEvents(j.events ?? []);
      setCaps(j.caps ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込めませんでした');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const all = events.flatMap((e) => e.sponsorships);
  const paidTotal = all.filter((r) => r.status === 'paid').reduce((a, r) => a + r.amount, 0);
  const inFollow = all.filter((r) => r.inFollow).length;
  const shown = onlyWith ? events.filter((e) => e.sponsorships.length > 0) : events;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink sm:text-2xl">協賛</h1>
          <p className="mt-1 text-sm text-ink-2">企業・お店の、イベントごとの協賛です。フォロー期間は開催日の3か月後まで。</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink hover:bg-surface"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          最新にする
        </button>
      </div>

      {error && <div role="alert" className="rounded-ctl border border-danger-line bg-danger-soft p-3 text-sm text-danger">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-panel bg-paper p-5 shadow-card">
          <p className="text-sm font-semibold text-ink-2">協賛金の合計（支払い済み）</p>
          <p className="num mt-2 text-2xl font-semibold text-ink">{yen(paidTotal)}</p>
        </div>
        <div className="rounded-panel bg-paper p-5 shadow-card">
          <p className="text-sm font-semibold text-ink-2">いまフォロー期間中</p>
          <p className="num mt-2 text-2xl font-semibold text-ink">
            {inFollow}
            <span className="ml-1 text-sm font-normal text-ink-2">件</span>
          </p>
        </div>
        <div className="rounded-panel bg-paper p-5 shadow-card">
          <p className="text-sm font-semibold text-ink-2">お支払い待ち</p>
          <p className="num mt-2 text-2xl font-semibold text-ink">
            {all.filter((r) => r.status === 'pending').length}
            <span className="ml-1 text-sm font-normal text-ink-2">件</span>
          </p>
        </div>
      </div>

      <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm text-ink">
        <input type="checkbox" checked={onlyWith} onChange={(e) => setOnlyWith(e.target.checked)} />
        協賛のあるイベントだけ表示
      </label>

      {loading && events.length === 0 ? (
        <p className="text-sm text-ink-2">読み込み中…</p>
      ) : shown.length === 0 ? (
        <div className="rounded-panel bg-paper p-6 text-sm text-ink-2 shadow-card">まだ協賛はありません。</div>
      ) : (
        shown.map((e) => {
          const paid = e.sponsorships.filter((r) => r.status === 'paid');
          const nC = paid.filter((r) => r.tier === 'corporate').length;
          const nS = paid.filter((r) => r.tier === 'store').length;
          return (
            <section key={e.id} className="rounded-panel bg-paper p-5 shadow-card">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-ink">
                  {e.title}
                  {e.cancelled_at && <span className="ml-2 rounded-full border border-danger-line bg-danger-soft px-2 py-0.5 text-xs text-danger">中止</span>}
                </h2>
                <p className="text-sm text-ink-2">
                  {jst(e.starts_at)} ／ 企業 {nC}/{caps.corporate ?? '-'} ・ お店 {nS}/{caps.store ?? '-'} ／ 合計 {yen(paid.reduce((a, r) => a + r.amount, 0))}
                </p>
              </div>
              {e.sponsorships.length === 0 ? (
                <p className="mt-3 text-sm text-ink-2">協賛はまだありません。</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="text-ink-2">
                      <tr className="border-b border-line">
                        <th className="py-2 pr-3 font-semibold">名前</th>
                        <th className="py-2 pr-3 font-semibold">枠</th>
                        <th className="py-2 pr-3 font-semibold">金額</th>
                        <th className="py-2 pr-3 font-semibold">支払い</th>
                        <th className="py-2 pr-3 font-semibold">フォロー終了日</th>
                        <th className="py-2 font-semibold">フォロー</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {e.sponsorships.map((r) => (
                        <tr key={r.id}>
                          <td className="py-2 pr-3">
                            <span className="font-semibold text-ink">{r.displayName}</span>
                            <span className="block text-xs text-ink-2">
                              {r.applicantName} ／ {r.email}
                            </span>
                          </td>
                          <td className="py-2 pr-3">{r.tier === 'corporate' ? '企業' : 'お店'}</td>
                          <td className="num py-2 pr-3">{yen(r.amount)}</td>
                          <td className="py-2 pr-3">
                            {r.status === 'paid' ? '支払い済み' : r.status === 'pending' ? 'お支払い待ち' : '返金済み'}
                            <span className="block text-xs text-ink-2">{r.paymentMethod === 'invoice' ? '請求書' : 'カード'}</span>
                          </td>
                          <td className="py-2 pr-3">{jst(r.followEnd)}</td>
                          <td className="py-2">
                            {r.inFollow ? (
                              <span className="rounded-full border border-ok-line bg-ok-soft px-2 py-0.5 text-xs font-semibold text-ok">期間中</span>
                            ) : (
                              <span className="text-xs text-ink-2">{r.status === 'paid' ? '終了' : '-'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
