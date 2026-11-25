'use client';

import React, { useEffect, useState } from 'react';
import { Notice, Section, buttonClass } from '@/components/ui';

type Stream = {
  id: string;
  title: string;
  venue: string;
  starts_at: string;
  stream_url: string | null;
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' });
const fmtWeek = (iso: string) => new Date(iso).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', weekday: 'short' });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });

// 当日のライブ配信（YouTube限定公開）。有効なスポンサー（全枠）の特典
export default function LiveStreams({ sponsorId, accessToken }: { sponsorId: string; accessToken: string }) {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/mypage/streams?sponsorId=${sponsorId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '配信の情報を読み込めませんでした');
        if (!cancelled) setStreams(json.streams ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '通信できませんでした');
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sponsorId, accessToken]);

  return (
    <Section
      id="stream"
      title="当日のライブ配信"
      description="会場に来られない日も、YouTubeの限定公開でライブを見られます。リンクはスポンサーの方だけのものなので、共有はご遠慮ください。"
    >
      {!loaded ? (
        <p className="text-ink-2">読み込んでいます…</p>
      ) : error ? (
        <Notice tone="danger">{error}</Notice>
      ) : streams.length === 0 ? (
        <p className="text-ink-2">配信予定のライブはまだありません。決まったら、ここに配信のリンクが出ます。</p>
      ) : (
        <ul className="divide-y divide-line rounded-panel border border-line bg-paper">
          {streams.map((s) => (
            <li key={s.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-4">
                <div className="w-16 shrink-0 text-center">
                  <p className="num text-2xl font-semibold leading-none">{fmtDate(s.starts_at)}</p>
                  <p className="mt-1 text-xs text-ink-2">
                    {fmtWeek(s.starts_at)} <span className="num text-sm">{fmtTime(s.starts_at)}</span>
                  </p>
                </div>
                <div>
                  <p className="font-bold">{s.title}</p>
                  <p className="text-sm text-ink-2">{s.venue}</p>
                </div>
              </div>
              {s.stream_url ? (
                <a href={s.stream_url} target="_blank" rel="noopener noreferrer" className={`${buttonClass('primary', 'md')} w-full sm:w-auto`}>
                  配信を見る（YouTube）
                </a>
              ) : (
                <span className="text-sm text-ink-2">リンクは当日までに出ます</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
