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
  pending: { label: '審査待ち', cls: 'border-warn-line bg-warn-soft text-warn' },
  approved: { label: '承認済み', cls: 'border-brand-line bg-brand-soft text-brand' },
  rejected: { label: '差し戻し', cls: 'border-danger-line bg-danger-soft text-danger' },
};
const ORDER: Record<ReviewStatus, number> = { pending: 0, rejected: 1, approved: 2 };

const inputClass = 'field-input';
const labelClass = 'block text-[15px] font-semibold text-ink mb-2';
const smallBtn = 'rounded-lg border px-4 py-2.5 text-sm font-semibold';

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
          <h1 className="text-xl sm:text-2xl font-semibold text-ink">クーポン</h1>
          <p className="text-sm text-ink-2 mt-1">
            承認済み・公開中のクーポンが、ライブ入場者のLINEに入場特典として表示されます（入場1回につき1枚）。
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink hover:bg-surface"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          再取得
        </button>
      </div>

      {toast && <div className="mb-4 rounded-ctl border border-brand-line bg-brand-soft p-3 text-sm text-brand">{toast}</div>}
      {error && <div className="mb-4 rounded-ctl border border-danger-line bg-danger-soft p-3 text-sm text-danger">{error}</div>}
      {pending > 0 && (
        <div className="mb-4 rounded-ctl border border-warn-line bg-warn-soft p-3 text-sm font-semibold text-warn">
          店舗から申請された審査待ちのクーポンが {pending} 件あります。
        </div>
      )}

      {form ? (
        <section className="mb-6 rounded-panel bg-paper shadow-card p-4 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold text-ink">{form.id ? 'クーポンを編集' : '新しいクーポン'}</h2>
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
          <label className="flex items-center gap-2.5 text-sm text-ink cursor-pointer">
            <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
            公開する
          </label>
          {error && (
            <div role="alert" className="rounded-ctl border border-danger-line bg-danger-soft p-3 text-sm text-danger">
              {error}
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <button disabled={saving} onClick={() => setForm(null)} className="rounded-ctl border border-line-strong bg-paper px-5 py-3 text-sm font-semibold text-ink hover:bg-surface">
              キャンセル
            </button>
            <button disabled={saving} onClick={save} className="flex-1 sm:flex-none rounded-ctl bg-brand px-6 py-3 text-sm font-semibold text-brand-ink hover:bg-brand-hover disabled:opacity-50">
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
          className="mb-6 w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-ctl bg-brand px-5 py-3 text-sm font-semibold text-brand-ink hover:bg-brand-hover"
        >
          <Plus className="h-4 w-4" />
          新しいクーポンを作成
        </button>
      )}

      {loading ? (
        <p className="text-sm text-ink-2">読み込み中...</p>
      ) : sorted.length === 0 ? (
        <div className="rounded-panel bg-paper shadow-card p-6 text-sm text-ink-2">クーポンはまだありません。</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sorted.map((c) => (
            <section
              key={c.id}
              className={`rounded-panel border bg-paper p-4 sm:p-5 ${c.review_status === 'pending' ? 'border-warn-line' : 'border-line'} ${
                c.is_published ? '' : 'opacity-75'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <span className="text-sm font-semibold text-brand">{c.shop_name}</span>
                <span className="flex gap-1.5">
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${REVIEW[c.review_status].cls}`}>{REVIEW[c.review_status].label}</span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                      c.is_published ? 'border-brand-line bg-brand-soft text-brand' : 'border-line-strong bg-surface text-ink-2'
                    }`}
                  >
                    {c.is_published ? '公開中' : '非公開'}
                  </span>
                </span>
              </div>
              <h3 className="text-base font-semibold text-ink">{c.benefit_title}</h3>
              <p className="text-sm text-ink-2 mt-1 whitespace-pre-wrap">{c.benefit_detail}</p>
              <p className="text-sm text-ink-3 mt-2">登録：{c.sponsor_name ? `スポンサー（${c.sponsor_name}）` : '外山企画'}</p>
              {c.review_status === 'rejected' && c.review_note && <p className="text-sm text-danger mt-1">差し戻し理由：{c.review_note}</p>}
              <p className="text-sm font-semibold text-ink mt-2 mb-3">利用回数：{c.use_count}回</p>

              {c.review_status !== 'approved' && (
                <div className="flex gap-2 mb-2">
                  <button onClick={() => review(c, 'approved')} className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink hover:bg-brand-hover">
                    承認して掲載
                  </button>
                  {c.review_status === 'pending' && (
                    <button onClick={() => review(c, 'rejected')} className={`${smallBtn} border-danger-line bg-danger-soft text-danger hover:bg-danger-soft`}>
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
                  className={`${smallBtn} border-line-strong bg-paper text-ink hover:bg-surface`}
                >
                  編集
                </button>
                <button
                  onClick={() => togglePublish(c)}
                  className={`${smallBtn} ${c.is_published ? 'border-danger-line bg-danger-soft text-danger hover:bg-danger-soft' : 'border-line-strong bg-paper text-ink hover:bg-surface'}`}
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
