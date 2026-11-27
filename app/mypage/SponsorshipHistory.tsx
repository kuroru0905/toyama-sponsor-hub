'use client';

// マイページ：企業・お店の、イベントごとの協賛の履歴（金額・支払い状態・フォロー期間）
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Notice, buttonClass } from '@/components/ui';

type Row = {
  id: string;
  amount: number;
  status: 'pending' | 'paid' | 'refunded';
  paymentMethod: 'card' | 'invoice';
  followEnd: string;
  inFollow: boolean;
  eventTitle: string;
  eventStartsAt: string | null;
  eventCancelled: boolean;
};

const jst = (v: string) =>
  new Date(v.length === 10 ? `${v}T00:00:00+09:00` : v).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' });

export default function SponsorshipHistory({ sponsorId, accessToken }: { sponsorId: string; accessToken: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/mypage/sponsorships?sponsorId=${encodeURIComponent(sponsorId)}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || '協賛の履歴を読み込めませんでした');
        setRows(j.sponsorships ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : '協賛の履歴を読み込めませんでした'));
  }, [sponsorId, accessToken]);

  return (
    <div className="space-y-4">
      {error && <Notice tone="danger">{error}</Notice>}
      {rows === null && !error ? (
        <p className="text-ink-2">読み込んでいます…</p>
      ) : rows && rows.length === 0 ? (
        <p className="text-ink-2">イベントへの協賛はまだありません。</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-panel bg-surface">
          {(rows ?? []).map((r) => (
            <li key={r.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{r.eventTitle}</span>
                {r.status === 'refunded' ? (
                  <Badge tone="neutral">{r.eventCancelled ? '中止・返金済み' : '返金済み'}</Badge>
                ) : r.status === 'pending' ? (
                  <Badge tone="warn">{r.paymentMethod === 'invoice' ? '請求書のお支払い待ち' : 'お支払い待ち'}</Badge>
                ) : r.inFollow ? (
                  <Badge tone="ok">フォロー期間中</Badge>
                ) : (
                  <Badge tone="neutral">フォロー終了</Badge>
                )}
              </div>
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-sm text-ink-2">
                {r.eventStartsAt && (
                  <>
                    <dt>開催</dt>
                    <dd className="text-ink">{jst(r.eventStartsAt)}</dd>
                  </>
                )}
                <dt>協賛金</dt>
                <dd className="num text-ink">¥{r.amount.toLocaleString('ja-JP')}（税込・{r.paymentMethod === 'invoice' ? '請求書払い' : 'カード'}）</dd>
                {r.status !== 'refunded' && (
                  <>
                    <dt>フォロー</dt>
                    <dd className="text-ink">{jst(r.followEnd)}まで</dd>
                  </>
                )}
              </dl>
            </li>
          ))}
        </ul>
      )}
      <Link href="/#plans" className={buttonClass('secondary', 'md')}>
        次のイベントにも協賛する
      </Link>
    </div>
  );
}
