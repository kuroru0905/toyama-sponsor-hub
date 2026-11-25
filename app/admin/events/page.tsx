'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Mic2 } from 'lucide-react';
import { useAdmin } from '../AdminShell';

type EventStats = { sold: number; entered: number; revenue: number; sent: number; applications: number };

type AdminEvent = {
  id: string;
  title: string;
  venue: string;
  starts_at: string;
  price_jpy: number;
  capacity: number | null;
  description: string;
  is_published: boolean;
  recruit_performers: boolean;
  recruit_deadline: string | null;
  presale_start: string | null;
  general_sale_start: string | null;
  stats: EventStats;
};

type Order = {
  id: string;
  display_name: string | null;
  status: 'paid' | 'used';
  paid_at: string | null;
  used_at: string | null;
};

type EventForm = {
  id: string | null;
  title: string;
  venue: string;
  starts_at: string; // datetime-local（日本時間）
  price_jpy: string;
  capacity: string;
  description: string;
  is_published: boolean;
  recruit_performers: boolean;
  recruit_deadline: string; // datetime-local（日本時間）
  presale_start: string; // datetime-local（日本時間）空欄＝先行販売なし
  general_sale_start: string; // datetime-local（日本時間）空欄＝公開と同時に販売
};

const EMPTY: EventForm = {
  id: null,
  title: '',
  venue: '',
  starts_at: '',
  price_jpy: '2000',
  capacity: '',
  description: '',
  is_published: true,
  recruit_performers: false,
  recruit_deadline: '',
  presale_start: '',
  general_sale_start: '',
};

const JST_MS = 9 * 60 * 60 * 1000;
const isoToLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + JST_MS).toISOString().slice(0, 16) : '');
const localToIso = (local: string) => (local ? `${local}:00+09:00` : null);
const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';
const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;

const inputClass =
  'w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 sm:py-2.5 text-base sm:text-sm text-white focus:border-teal-400 focus:outline-none';
const labelClass = 'block text-xs font-bold text-zinc-300 mb-1.5';

export default function AdminEventsPage() {
  const { token } = useAdmin();
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<EventForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [ordersOf, setOrdersOf] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const api = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const res = await fetch(path, {
        ...init,
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `エラーが発生しました（${res.status}）`);
      return json;
    },
    [token]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await api('/api/admin/events');
      setEvents(json.events ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg: string) => {
    setToast(msg);
    setError('');
  };

  const save = async () => {
    if (!form) return;
    if (!form.starts_at) return setError('開演日時を入力してください');
    if (form.recruit_performers && !form.recruit_deadline) return setError('出演者募集の締切を入力してください');
    if (form.recruit_performers && form.recruit_deadline > form.starts_at)
      return setError('出演者募集の締切は、開演日時より前にしてください');
    if (form.presale_start && !form.general_sale_start)
      return setError('スポンサー先行販売を設定する場合は、一般販売の開始日時も入力してください');
    if (form.presale_start && form.presale_start >= form.general_sale_start)
      return setError('スポンサー先行販売の開始は、一般販売の開始より前にしてください');
    if (form.general_sale_start && form.general_sale_start >= form.starts_at)
      return setError('一般販売の開始は、開演日時より前にしてください');
    const payload = {
      title: form.title,
      venue: form.venue,
      starts_at: localToIso(form.starts_at),
      price_jpy: Number(form.price_jpy),
      capacity: form.capacity === '' ? null : Number(form.capacity),
      description: form.description,
      is_published: form.is_published,
      recruit_performers: form.recruit_performers,
      recruit_deadline: form.recruit_performers ? localToIso(form.recruit_deadline) : null,
      presale_start: localToIso(form.presale_start),
      general_sale_start: localToIso(form.general_sale_start),
    };
    setSaving(true);
    try {
      if (form.id) {
        await api(`/api/admin/events/${form.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        flash('イベントを更新しました');
      } else {
        await api('/api/admin/events', { method: 'POST', body: JSON.stringify(payload) });
        flash('イベントを作成しました');
      }
      setForm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const patch = async (ev: AdminEvent, body: Record<string, unknown>, msg: string, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    try {
      await api(`/api/admin/events/${ev.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      flash(msg);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新に失敗しました');
    }
  };

  const showOrders = async (ev: AdminEvent) => {
    if (ordersOf === ev.id) return setOrdersOf(null);
    try {
      const json = await api(`/api/admin/events/${ev.id}/orders`);
      setOrders(json.orders ?? []);
      setOrdersOf(ev.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : '購入者一覧の取得に失敗しました');
    }
  };

  const now = Date.now();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">イベント・チケット</h1>
          <p className="text-xs text-zinc-400 mt-1">公開したイベントはLINEのチケット画面に表示され、購入できます。</p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          再取得
        </button>
      </div>

      {toast && <div className="mb-4 rounded-xl border border-teal-500/40 bg-teal-500/10 p-3 text-sm text-teal-200">{toast}</div>}
      {error && <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      {form ? (
        <section className="mb-6 rounded-2xl border border-teal-500/40 bg-zinc-900 p-4 sm:p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">{form.id ? 'イベントを編集' : '新しいイベント'}</h2>

          <div>
            <label className={labelClass}>公演名 *</label>
            <input className={inputClass} value={form.title} maxLength={80} placeholder="例：MMS vol.5" onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>会場 *</label>
            <input className={inputClass} value={form.venue} maxLength={80} placeholder="例：登別市民会館 大ホール" onChange={(e) => setForm({ ...form, venue: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>開演日時（日本時間） *</label>
              <input type="datetime-local" className={inputClass} value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>価格（円） *</label>
              <input type="number" inputMode="numeric" min={50} className={inputClass} value={form.price_jpy} onChange={(e) => setForm({ ...form, price_jpy: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>定員（空欄＝無制限）</label>
              <input type="number" inputMode="numeric" min={1} className={inputClass} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={labelClass}>説明</label>
            <textarea className={`${inputClass} min-h-[90px]`} value={form.description} maxLength={2000} placeholder="出演者、開場時間、注意事項など" onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 space-y-3">
            <label className="flex items-start gap-2.5 text-sm text-white cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={form.recruit_performers}
                onChange={(e) => setForm({ ...form, recruit_performers: e.target.checked })}
              />
              <span>
                <Mic2 className="inline h-4 w-4 text-amber-400 mr-1" />
                出演者を募集する
                <span className="block text-xs text-zinc-400">
                  チケットを公開する前からでも、締切までスポンサーのマイページにこのイベントの出演応募欄が出ます（締切は開演より前）
                </span>
              </span>
            </label>
            {form.recruit_performers && (
              <div>
                <label className={labelClass}>募集の締切（日本時間） *</label>
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={form.recruit_deadline}
                  onChange={(e) => setForm({ ...form, recruit_deadline: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className="rounded-xl border border-teal-400/30 bg-teal-400/5 p-4 space-y-3">
            <p className="text-sm font-bold text-white">チケット販売スケジュール</p>
            <p className="text-xs text-zinc-400">
              出演者募集 → スポンサー先行販売 → 一般販売 → 開演（販売終了）。先行販売は、マイページでLINE連携した有効なスポンサーだけが購入できます。
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>スポンサー先行販売の開始（任意）</label>
                <input type="datetime-local" className={inputClass} value={form.presale_start} onChange={(e) => setForm({ ...form, presale_start: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>一般販売の開始（任意）</label>
                <input type="datetime-local" className={inputClass} value={form.general_sale_start} onChange={(e) => setForm({ ...form, general_sale_start: e.target.value })} />
              </div>
            </div>
            <p className="text-xs text-zinc-500">入場ボタンは開演3時間前〜開演日の23:59まで使えます。</p>
          </div>

          <label className="flex items-start gap-2.5 text-sm text-white cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
            <span>
              公開する
              <span className="block text-xs text-zinc-400">LINEのチケット画面に表示されます。下の販売開始日時から購入できます（空欄なら公開と同時に一般販売）</span>
            </span>
          </label>

          {form.id && <p className="text-xs text-zinc-500">※ 価格の変更は、これから購入する人にだけ適用されます。</p>}

          {error && (
            <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <button disabled={saving} onClick={() => setForm(null)} className="rounded-xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-bold text-zinc-300 hover:bg-zinc-800">
              キャンセル
            </button>
            <button disabled={saving} onClick={save} className="flex-1 sm:flex-none rounded-xl bg-teal-400 px-6 py-3 text-sm font-bold text-zinc-950 hover:bg-teal-300 disabled:opacity-50">
              {saving ? '保存中...' : '保存する'}
            </button>
          </div>
        </section>
      ) : (
        <button
          onClick={() => {
            setToast('');
            setForm({ ...EMPTY });
          }}
          className="mb-6 w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-400 px-5 py-3 text-sm font-bold text-zinc-950 hover:bg-teal-300"
        >
          <Plus className="h-4 w-4" />
          新しいイベントを作成
        </button>
      )}

      {loading ? (
        <p className="text-sm text-zinc-400">読み込み中...</p>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-400">イベントはまだありません。</div>
      ) : (
        <div className="space-y-4">
          {events.map((ev) => {
            const soldOut = ev.capacity !== null && ev.stats.sold >= ev.capacity;
            const recruitOpen =
              ev.recruit_performers && ev.recruit_deadline !== null && new Date(ev.recruit_deadline).getTime() > now;
            return (
              <section key={ev.id} className={`rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5 ${ev.is_published ? '' : 'opacity-75'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-teal-300">{fmt(ev.starts_at)} 開演</span>
                  <span className="flex flex-wrap gap-1.5">
                    {soldOut && <span className="rounded-full border border-zinc-600 bg-zinc-800 px-2.5 py-0.5 text-[11px] font-bold text-zinc-300">完売</span>}
                    {ev.recruit_performers && (
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                          recruitOpen ? 'border-amber-400/40 bg-amber-400/15 text-amber-300' : 'border-zinc-600 bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {recruitOpen ? '出演者募集中' : '出演者募集 終了'}
                      </span>
                    )}
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                        ev.is_published ? 'border-teal-500/40 bg-teal-500/15 text-teal-300' : 'border-zinc-600 bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {ev.is_published ? '公開中' : '非公開'}
                    </span>
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">{ev.title}</h3>
                <p className="text-xs text-zinc-400 mb-3">
                  📍 {ev.venue} ／ {yen(ev.price_jpy)}
                  {ev.recruit_performers && ` ／ 出演応募の締切 ${fmt(ev.recruit_deadline)}`}
                  {ev.presale_start && ` ／ 先行 ${fmt(ev.presale_start)}〜`}
                  {ev.general_sale_start && ` ／ 一般 ${fmt(ev.general_sale_start)}〜`}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
                  {[
                    ['販売', `${ev.stats.sold}${ev.capacity ? ` / ${ev.capacity}` : ''}枚`],
                    ['入場', `${ev.stats.entered}人`],
                    ['売上', yen(ev.stats.revenue)],
                    ['店舗送客', `${ev.stats.sent}件`],
                    ['出演応募', `${ev.stats.applications}件`],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-zinc-950 px-3 py-2">
                      <div className="text-[11px] font-bold text-zinc-500">{k}</div>
                      <div className="text-base font-bold text-white">{v}</div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setToast('');
                      setForm({
                        id: ev.id,
                        title: ev.title,
                        venue: ev.venue,
                        starts_at: isoToLocal(ev.starts_at),
                        price_jpy: String(ev.price_jpy),
                        capacity: ev.capacity === null ? '' : String(ev.capacity),
                        description: ev.description,
                        is_published: ev.is_published,
                        recruit_performers: ev.recruit_performers,
                        recruit_deadline: isoToLocal(ev.recruit_deadline),
                        presale_start: isoToLocal(ev.presale_start),
                        general_sale_start: isoToLocal(ev.general_sale_start),
                      });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 sm:py-2 text-sm sm:text-xs font-bold text-white hover:bg-zinc-800"
                  >
                    編集
                  </button>
                  <button
                    onClick={() =>
                      patch(
                        ev,
                        { is_published: !ev.is_published },
                        ev.is_published ? '非公開にしました' : '公開しました',
                        ev.is_published
                          ? `「${ev.title}」を非公開にしますか？（購入済みチケットはそのまま使えます）`
                          : `「${ev.title}」を公開して販売を始めますか？`
                      )
                    }
                    className={`rounded-lg border px-4 py-2.5 sm:py-2 text-sm sm:text-xs font-bold ${
                      ev.is_published ? 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20' : 'border-zinc-700 bg-zinc-950 text-white hover:bg-zinc-800'
                    }`}
                  >
                    {ev.is_published ? '非公開にする' : '公開する'}
                  </button>
                  <button
                    onClick={() => showOrders(ev)}
                    className="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 sm:py-2 text-sm sm:text-xs font-bold text-white hover:bg-zinc-800"
                  >
                    {ordersOf === ev.id ? '購入者を閉じる' : '購入者一覧'}
                  </button>
                </div>

                {ordersOf === ev.id && (
                  <div className="mt-4 border-t border-zinc-800 pt-4 overflow-x-auto">
                    {orders.length === 0 ? (
                      <p className="text-xs text-zinc-500">まだ購入者はいません。</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-zinc-500">
                            <th className="py-1 pr-3">名前</th>
                            <th className="py-1 pr-3">購入</th>
                            <th className="py-1">入場</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map((o) => (
                            <tr key={o.id} className="border-t border-zinc-800">
                              <td className="py-2 pr-3 text-white">{o.display_name ?? '（名前なし）'}</td>
                              <td className="py-2 pr-3 text-zinc-300 whitespace-nowrap">{fmt(o.paid_at)}</td>
                              <td className={`py-2 whitespace-nowrap font-bold ${o.status === 'used' ? 'text-teal-300' : 'text-zinc-500'}`}>
                                {o.status === 'used' ? fmt(o.used_at) : '未入場'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
