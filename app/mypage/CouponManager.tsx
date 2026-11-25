'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Ticket, Plus } from 'lucide-react';

type ReviewStatus = 'pending' | 'approved' | 'rejected';

interface StoreCoupon {
  id: string;
  shop_name: string;
  benefit_title: string;
  benefit_detail: string;
  is_published: boolean;
  review_status: ReviewStatus;
  review_note: string | null;
  use_count: number;
}

interface FormState {
  id: string | null;
  shopName: string;
  benefitTitle: string;
  benefitDetail: string;
}

const REVIEW_BADGES: Record<ReviewStatus, { label: string; color: string }> = {
  pending: { label: '審査中', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  approved: { label: '承認済み', color: 'bg-teal-500/20 text-teal-300 border-teal-500/40' },
  rejected: { label: '差し戻し', color: 'bg-red-500/20 text-red-300 border-red-500/40' },
};

const inputClass =
  'w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 sm:py-2.5 text-base sm:text-sm text-white focus:border-teal-400 focus:outline-none';

interface Props {
  sponsorId: string;
  defaultShopName: string;
  accessToken: string;
  isActive: boolean;
}

export default function CouponManager({ sponsorId, defaultShopName, accessToken, isActive }: Props) {
  const [coupons, setCoupons] = useState<StoreCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!isActive) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/mypage/coupons?sponsorId=${encodeURIComponent(sponsorId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'クーポンの取得に失敗しました');
      setCoupons(data.coupons ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'クーポンの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [sponsorId, accessToken, isActive]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        sponsorId,
        shopName: form.shopName,
        benefitTitle: form.benefitTitle,
        benefitDetail: form.benefitDetail,
      };
      const res = await fetch(form.id ? `/api/mypage/coupons/${form.id}` : '/api/mypage/coupons', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存に失敗しました');
      setMessage('保存しました。外山企画が内容を確認後、LINEのクーポン画面に掲載されます。');
      setForm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (c: StoreCoupon) => {
    const next = !c.is_published;
    if (!window.confirm(next ? 'このクーポンの掲載を再開しますか？' : 'このクーポンの掲載を停止しますか？')) return;
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/mypage/coupons/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ isPublished: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '更新に失敗しました');
      setMessage(next ? '掲載を再開しました。' : '掲載を停止しました。');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新に失敗しました');
    }
  };

  const statusText = (c: StoreCoupon) => {
    if (!c.is_published) return '掲載停止中';
    if (c.review_status === 'approved') return 'LINEに掲載中';
    if (c.review_status === 'pending') return '承認されるとLINEに掲載されます';
    return '内容を修正して再申請してください';
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5 mb-6">
      <div className="flex items-center gap-2 text-sm font-bold text-white mb-1">
        <Ticket className="h-4 w-4 text-teal-400" />
        LINEクーポンの掲載
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed mb-4">
        イベント参加者のLINEに表示されるお店の特典クーポンです。登録・変更した内容は外山企画が確認したあとに掲載されます。クーポンはLINEユーザー1人につき1回ずつ使えます。
      </p>

      {!isActive ? (
        <p className="text-xs text-amber-300">ご契約が有効（契約中）になると、クーポンを登録できます。</p>
      ) : (
        <>
          {message && (
            <div className="mb-4 rounded-xl border border-teal-500/40 bg-teal-500/10 p-3 text-xs text-teal-200">
              {message}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>
          )}

          {loading ? (
            <p className="text-xs text-zinc-400">読み込み中...</p>
          ) : (
            <div className="space-y-3 mb-4">
              {coupons.length === 0 && !form && (
                <p className="text-xs text-zinc-500">まだクーポンは登録されていません。</p>
              )}
              {coupons.map((c) => {
                const badge = REVIEW_BADGES[c.review_status];
                return (
                  <div key={c.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <span className="text-xs text-zinc-400">{c.shop_name}</span>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white">{c.benefit_title}</div>
                    <p className="text-xs text-zinc-400 mt-1 whitespace-pre-wrap">{c.benefit_detail}</p>
                    {c.review_status === 'rejected' && c.review_note && (
                      <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
                        差し戻し理由：{c.review_note}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-zinc-300">
                        {statusText(c)} ／ 利用 <strong className="text-white">{c.use_count}</strong> 回
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              id: c.id,
                              shopName: c.shop_name,
                              benefitTitle: c.benefit_title,
                              benefitDetail: c.benefit_detail,
                            })
                          }
                          className="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 sm:px-3 sm:py-1.5 text-sm sm:text-xs font-bold text-white hover:bg-zinc-800"
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePublish(c)}
                          className="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 sm:px-3 sm:py-1.5 text-sm sm:text-xs font-bold text-zinc-300 hover:bg-zinc-800"
                        >
                          {c.is_published ? '掲載を停止' : '掲載を再開'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {form ? (
            <div className="rounded-xl border border-teal-500/40 bg-zinc-900 p-4 space-y-3">
              <div className="text-sm font-bold text-white">{form.id ? 'クーポンを編集' : '新しいクーポン'}</div>
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">店舗名</label>
                <input
                  className={inputClass}
                  value={form.shopName}
                  maxLength={60}
                  onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">特典タイトル</label>
                <input
                  className={inputClass}
                  value={form.benefitTitle}
                  maxLength={60}
                  placeholder="例：ドリンク1杯サービス"
                  onChange={(e) => setForm({ ...form, benefitTitle: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">特典の詳細・利用条件</label>
                <textarea
                  className={`${inputClass} min-h-[90px]`}
                  value={form.benefitDetail}
                  maxLength={400}
                  placeholder="例：ご来店時にスタッフへ画面を提示してください。他の割引との併用不可。"
                  onChange={(e) => setForm({ ...form, benefitDetail: e.target.value })}
                />
              </div>
              {form.id && (
                <p className="text-[11px] text-amber-300">※ 内容を変更すると、再度外山企画の確認が入ります（確認中は掲載されません）。</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={save}
                  className="flex-1 sm:flex-none rounded-xl bg-teal-400 px-5 py-3 sm:py-2.5 text-sm sm:text-xs font-bold text-zinc-950 hover:bg-teal-300 transition disabled:opacity-50"
                >
                  {saving ? '送信中...' : form.id ? '変更して再申請する' : '申請する'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setForm(null)}
                  className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 sm:py-2.5 text-sm sm:text-xs font-bold text-zinc-300 hover:bg-zinc-800"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMessage('');
                setForm({ id: null, shopName: defaultShopName, benefitTitle: '', benefitDetail: '' });
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-teal-500/40 bg-teal-500/10 px-4 py-3 sm:py-2.5 text-sm sm:text-xs font-bold text-teal-300 hover:bg-teal-500/20"
            >
              <Plus className="h-4 w-4" />
              クーポンを追加する
            </button>
          )}
        </>
      )}
    </div>
  );
}
