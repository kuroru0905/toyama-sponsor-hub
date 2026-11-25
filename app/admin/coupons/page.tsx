'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useAdmin } from '../AdminShell';

type ReviewStatus = 'pending' | 'approved' | 'rejected';

type AdminCoupon = {
  id: string;
  shop_name: string;
  benefit_title: string;
  benefit_detail: string;
  is_published: boolean;
  review_status: ReviewStatus;
  review_note: string | null;
  sponsor_name: string | null; // null = 外山企画が直接作成
  use_count: number;
};

type CouponForm = {
  id: string | null;
  shop_name: string;
  benefit_title: string;
  benefit_detail: string;
  is_published: boolean;
};

const EMPTY: CouponForm = { id: null, shop_name: '', benefit_title: '', benefit_detail: '', is_published: true };

const REVIEW: Record<ReviewStatus, { label: string; cls: string }> = {
  pending: { label: '審査待ち', cls: 'border-amber-400/40 bg-amber-400/15 text-amber-300' },
  approved: { label: '承認済み', cls: 'border-teal-500/40 bg-teal-500/15 text-teal-300' },
  rejected: { label: '差し戻し', cls: 'border-red-500/40 bg-red-500/15 text-red-300' },
};
const ORDER: Record<ReviewStatus, number> = { pending: 0, rejected: 1, approved: 2 };

const inputClass =
  'w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 sm:py-2.5 text-base sm:text-sm text-white focus:border-teal-400 focus:outline-none';
const labelClass = 'block text-xs font-bold text-zinc-300 mb-1.5';
const smallBtn = 'rounded-lg border px-4 py-2.5 sm:py-2 text-sm sm:text-xs font-bold';

export default function AdminCouponsPage() {
  const { token } = useAdmin();
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<CouponForm | null>(null);
  const [saving, setSaving] = useState(false);
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
      const json = await api('/api/admin/coupons');
      setCoupons(json.coupons ?? []);
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
    setSaving(true);
    try {
      const payload = {
        shop_name: form.shop_name,
        benefit_title: form.benefit_title,
        benefit_detail: form.benefit_detail,
        is_published: form.is_published,
      };
      if (form.id) {
        await api(`/api/admin/coupons/${form.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        flash('クーポンを更新しました');
      } else {
        await api('/api/admin/coupons', { method: 'POST', body: JSON.stringify(payload) });
        flash('クーポンを作成しました（承認済みで掲載されます）');
      }
      setForm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const review = async (c: AdminCoupon, status: 'approved' | 'rejected') => {
    let note: string | null = null;
    if (status === 'approved') {
      if (!window.confirm(`【${c.shop_name}】「${c.benefit_title}」を承認して、LINEに掲載しますか？`)) return;
    } else {
      note = window.prompt('差し戻しの理由を入力してください（店舗のマイページとメールに表示されます）', '');
      if (note === null) return;
      if (!note.trim()) return setError('差し戻し理由を入力してください');
    }
    try {
      const res = await api(`/api/admin/coupons/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ review_status: status, review_note: note }),
      });
      const base = status === 'approved' ? '承認しました。LINEに掲載されます。' : '差し戻しました。';
      const mail = !c.sponsor_name
        ? ''
        : res.mailed
          ? '店舗に結果をメールしました。'
          : '※ 店舗へのメールは送れませんでした（メール設定を確認してください）。';
      flash(base + mail);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新に失敗しました');
    }
  };

  const togglePublish = async (c: AdminCoupon) => {
    const next = !c.is_published;
    if (!window.confirm(next ? `「${c.benefit_title}」を公開しますか？` : `「${c.benefit_title}」を非公開にしますか？`)) return;
    try {
      await api(`/api/admin/coupons/${c.id}`, { method: 'PATCH', body: JSON.stringify({ is_published: next }) });
      flash(next ? '公開しました' : '非公開にしました');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新に失敗しました');
    }
  };

  const sorted = coupons.slice().sort((a, b) => ORDER[a.review_status] - ORDER[b.review_status]);
  const pending = coupons.filter((c) => c.review_status === 'pending').length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">クーポン</h1>
          <p className="text-xs text-zinc-400 mt-1">
            承認済み・公開中のクーポンが、ライブ入場者のLINEに入場特典として表示されます（入場1回につき1枚）。
          </p>
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
      {pending > 0 && (
        <div className="mb-4 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm font-bold text-amber-300">
          店舗から申請された審査待ちのクーポンが {pending} 件あります。
        </div>
      )}

      {form ? (
        <section className="mb-6 rounded-2xl border border-teal-500/40 bg-zinc-900 p-4 sm:p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">{form.id ? 'クーポンを編集' : '新しいクーポン'}</h2>
          <div>
            <label className={labelClass}>店舗名 *</label>
            <input className={inputClass} value={form.shop_name} maxLength={60} onChange={(e) => setForm({ ...form, shop_name: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>特典タイトル *</label>
            <input className={inputClass} value={form.benefit_title} maxLength={60} placeholder="例：ドリンク1杯サービス" onChange={(e) => setForm({ ...form, benefit_title: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>特典の詳細・利用条件 *</label>
            <textarea className={`${inputClass} min-h-[90px]`} value={form.benefit_detail} maxLength={400} onChange={(e) => setForm({ ...form, benefit_detail: e.target.value })} />
          </div>
          <label className="flex items-center gap-2.5 text-sm text-white cursor-pointer">
            <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
            公開する
          </label>
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
          新しいクーポンを作成
        </button>
      )}

      {loading ? (
        <p className="text-sm text-zinc-400">読み込み中...</p>
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-400">クーポンはまだありません。</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sorted.map((c) => (
            <section
              key={c.id}
              className={`rounded-2xl border bg-zinc-900 p-4 sm:p-5 ${c.review_status === 'pending' ? 'border-amber-400/40' : 'border-zinc-800'} ${
                c.is_published ? '' : 'opacity-75'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <span className="text-xs font-bold text-teal-300">{c.shop_name}</span>
                <span className="flex gap-1.5">
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${REVIEW[c.review_status].cls}`}>{REVIEW[c.review_status].label}</span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                      c.is_published ? 'border-teal-500/40 bg-teal-500/15 text-teal-300' : 'border-zinc-600 bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {c.is_published ? '公開中' : '非公開'}
                  </span>
                </span>
              </div>
              <h3 className="text-base font-bold text-white">{c.benefit_title}</h3>
              <p className="text-xs text-zinc-400 mt-1 whitespace-pre-wrap">{c.benefit_detail}</p>
              <p className="text-xs text-zinc-500 mt-2">登録：{c.sponsor_name ? `スポンサー（${c.sponsor_name}）` : '外山企画'}</p>
              {c.review_status === 'rejected' && c.review_note && <p className="text-xs text-red-300 mt-1">差し戻し理由：{c.review_note}</p>}
              <p className="text-sm font-bold text-white mt-2 mb-3">利用回数：{c.use_count}回</p>

              {c.review_status !== 'approved' && (
                <div className="flex gap-2 mb-2">
                  <button onClick={() => review(c, 'approved')} className="flex-1 rounded-lg bg-teal-400 px-4 py-2.5 sm:py-2 text-sm sm:text-xs font-bold text-zinc-950 hover:bg-teal-300">
                    承認して掲載
                  </button>
                  {c.review_status === 'pending' && (
                    <button onClick={() => review(c, 'rejected')} className={`${smallBtn} border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20`}>
                      差し戻す
                    </button>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setToast('');
                    setForm({
                      id: c.id,
                      shop_name: c.shop_name,
                      benefit_title: c.benefit_title,
                      benefit_detail: c.benefit_detail,
                      is_published: c.is_published,
                    });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`${smallBtn} border-zinc-700 bg-zinc-950 text-white hover:bg-zinc-800`}
                >
                  編集
                </button>
                <button
                  onClick={() => togglePublish(c)}
                  className={`${smallBtn} ${c.is_published ? 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20' : 'border-zinc-700 bg-zinc-950 text-white hover:bg-zinc-800'}`}
                >
                  {c.is_published ? '非公開にする' : '公開する'}
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
