'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Field, Notice, Section } from '@/components/ui';

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

interface Props {
  sponsorId: string;
  defaultShopName: string;
  accessToken: string;
  isActive: boolean;
}

// LINEに出るときの状態を、ひと言で
function couponState(c: StoreCoupon): { label: string; tone: 'ok' | 'warn' | 'danger' | 'neutral'; note: string } {
  if (!c.is_published) return { label: '掲載を止めています', tone: 'neutral', note: '再開すると、承認済みならすぐLINEに出ます。' };
  if (c.review_status === 'approved') return { label: 'LINEに掲載中', tone: 'ok', note: '' };
  if (c.review_status === 'pending') return { label: '確認待ち', tone: 'warn', note: '外山企画が内容を確認しています。承認されるとLINEに出ます。' };
  return { label: '差し戻し', tone: 'danger', note: '内容を直して、もう一度申請してください。' };
}

export default function CouponManager({ sponsorId, defaultShopName, accessToken, isActive }: Props) {
  const [coupons, setCoupons] = useState<StoreCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

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
      if (!res.ok) throw new Error(data.error || 'クーポンを読み込めませんでした');
      setCoupons(data.coupons ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'クーポンを読み込めませんでした');
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
      const payload = { sponsorId, shopName: form.shopName, benefitTitle: form.benefitTitle, benefitDetail: form.benefitDetail };
      const res = await fetch(form.id ? `/api/mypage/coupons/${form.id}` : '/api/mypage/coupons', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '申請できませんでした');
      setMessage('申請しました。外山企画が内容を確認したら、LINEのクーポン画面に出ます。結果はメールでもお知らせします。');
      setForm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '申請できませんでした');
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (c: StoreCoupon) => {
    const next = !c.is_published;
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/mypage/coupons/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ isPublished: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '変更できませんでした');
      setMessage(next ? '掲載を再開しました。' : '掲載を止めました。');
      setConfirmId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '変更できませんでした');
    }
  };

  return (
    <Section
      id="coupons"
      title="LINEクーポン"
      description="ライブに入場したお客さんのLINEに、入場特典として出るお店のクーポンです。お客さんは入場1回につき、掲載中のお店から1枚を選んで使えます。"
      action={
        isActive && !form ? (
          <Button
            variant="secondary"
            onClick={() => {
              setMessage('');
              setForm({ id: null, shopName: defaultShopName, benefitTitle: '', benefitDetail: '' });
            }}
            className="w-full sm:w-auto"
          >
            クーポンを追加
          </Button>
        ) : null
      }
    >
      {!isActive ? (
        <p className="text-ink-2">ご契約が有効になると、クーポンを登録できます。</p>
      ) : (
        <div className="space-y-4">
          {message && <Notice tone="ok">{message}</Notice>}
          {error && !form && <Notice tone="danger">{error}</Notice>}

          {form && (
            <div className="rounded-panel bg-surface p-5 sm:p-6">
              <h3 className="text-lg font-semibold">{form.id ? 'クーポンを直す' : '新しいクーポン'}</h3>
              <div className="mt-5 max-w-prose space-y-6">
                <Field label="お店の名前" htmlFor="c-shop" required>
                  <input id="c-shop" className="field-input" value={form.shopName} maxLength={60} onChange={(e) => setForm({ ...form, shopName: e.target.value })} />
                </Field>
                <Field label="特典のタイトル" htmlFor="c-title" required hint="記入例：ドリンク1杯サービス（60文字まで）">
                  <input id="c-title" className="field-input" value={form.benefitTitle} maxLength={60} onChange={(e) => setForm({ ...form, benefitTitle: e.target.value })} />
                </Field>
                <Field
                  label="特典の詳しい内容・使える条件"
                  htmlFor="c-detail"
                  required
                  hint="記入例：ご来店時にスタッフへ画面を見せてください。他の割引とは一緒に使えません。（400文字まで）"
                >
                  <textarea id="c-detail" className="field-input" value={form.benefitDetail} maxLength={400} onChange={(e) => setForm({ ...form, benefitDetail: e.target.value })} />
                </Field>
                {form.id && <Notice tone="warn">内容を変えると、外山企画がもう一度確認します。確認が終わるまでLINEには出ません。</Notice>}
                {error && <Notice tone="danger">{error}</Notice>}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button onClick={save} disabled={saving}>
                    {saving ? '申請しています…' : form.id ? '直して申請する' : '申請する'}
                  </Button>
                  <Button variant="secondary" onClick={() => setForm(null)} disabled={saving}>
                    やめる
                  </Button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-ink-2">読み込んでいます…</p>
          ) : coupons.length === 0 && !form ? (
            <p className="text-ink-2">まだクーポンがありません。「クーポンを追加」から申請できます。</p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {coupons.map((c) => {
                const st = couponState(c);
                return (
                  <li key={c.id} className="flex flex-col rounded-panel bg-surface">
                    <div className="px-5 pt-4 pb-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-ink-2">{c.shop_name}</span>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </div>
                      <p className="mt-1 text-lg font-semibold leading-snug">{c.benefit_title}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{c.benefit_detail}</p>
                      {c.review_status === 'rejected' && c.review_note && (
                        <Notice tone="danger" className="mt-3" title="差し戻しの理由">
                          {c.review_note}
                        </Notice>
                      )}
                      {st.note && c.review_status !== 'rejected' && <p className="mt-2 text-sm text-ink-2">{st.note}</p>}
                    </div>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
                      <p className="text-sm text-ink-2">
                        使われた回数 <span className="num text-xl font-semibold text-ink">{c.use_count}</span>
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setForm({ id: c.id, shopName: c.shop_name, benefitTitle: c.benefit_title, benefitDetail: c.benefit_detail })
                          }
                        >
                          直す
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setConfirmId(c.id)}>
                          {c.is_published ? '掲載を止める' : '掲載を再開'}
                        </Button>
                      </div>
                    </div>
                    {confirmId === c.id && (
                      <div className="border-t border-line px-5 py-3">
                        <p className="text-[15px] font-semibold">
                          {c.is_published ? 'このクーポンの掲載を止めますか？' : 'このクーポンの掲載を再開しますか？'}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" onClick={() => togglePublish(c)}>
                            {c.is_published ? '止める' : '再開する'}
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => setConfirmId(null)}>
                            やめる
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Section>
  );
}
