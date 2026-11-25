'use client';

import React, { useEffect, useState } from 'react';
import { Radio, ExternalLink } from 'lucide-react';

type Stream = {
  id: string;
  title: string;
  venue: string;
  starts_at: string;
  stream_url: string | null;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

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
        if (!res.ok) throw new Error(json.error || '配信情報の取得に失敗しました');
        if (!cancelled) setStreams(json.streams ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '通信エラーが発生しました');
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sponsorId, accessToken]);

  if (!loaded) return null;

  return (
    <div className="rounded-2xl border border-red-500/40 bg-red-500/5 p-5 space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold text-white">
        <Radio className="h-4 w-4 text-red-400" />
        当日のライブ配信（スポンサー限定）
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed">
        会場に来られない日も、YouTubeの限定公開ライブで当日の公演を見られます。リンクはスポンサーの方だけのものなので、共有はご遠慮ください。
      </p>

      {error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : streams.length === 0 ? (
        <p className="text-xs text-zinc-500">今後の公演が決まったら、ここに配信リンクが表示されます。</p>
      ) : (
        <ul className="space-y-2">
          {streams.map((s) => (
            <li
              key={s.id}
              className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <p className="text-xs font-bold text-red-300">{fmt(s.starts_at)} 開演</p>
                <p className="text-sm font-bold text-white">{s.title}</p>
                <p className="text-xs text-zinc-500">📍 {s.venue}</p>
              </div>
              {s.stream_url ? (
                <a
                  href={s.stream_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-3 sm:py-2 text-sm sm:text-xs font-bold text-white hover:bg-red-500"
                >
                  配信を見る
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <span className="text-xs text-zinc-500 sm:text-right">配信リンクは当日までに表示されます</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
