'use client';

// サイト上部の横スクロール：まちきっぷ パートナーズのロゴまたは名前を流す（ファン枠は名前だけ）
// DeepL のロゴ列と同じく、ロゴは灰色で静かに流れ、触れると色が戻って止まる。管理画面には出さない
import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { trimLogo } from '@/lib/trimLogo';

type Partner = { id: string; name: string; logoUrl: string | null; tier: 'corporate' | 'store' | 'fan' };

export default function PartnerMarquee() {
  const pathname = usePathname();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [trimmed, setTrimmed] = useState<Record<string, string>>({}); // 余白を切り落としたロゴ

  useEffect(() => {
    let alive = true;
    fetch('/api/partners-banner')
      .then((r) => (r.ok ? r.json() : { partners: [] }))
      .then((j: { partners?: Partner[] }) => alive && setPartners(j.partners ?? []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // ロゴの透明な余白を切り落としてから出す（項目どうしの間隔をそろえるため）
  useEffect(() => {
    let alive = true;
    partners.forEach((p) => {
      if (!p.logoUrl) return;
      const src = p.logoUrl;
      trimLogo(src).then((t) => alive && setTrimmed((m) => (m[src] === t ? m : { ...m, [src]: t })));
    });
    return () => {
      alive = false;
    };
  }, [partners]);

  if (pathname?.startsWith('/admin') || partners.length === 0) return null;

  // 画面幅より長くなるよう、少ないときは繰り返す（つなぎ目なく流すため同じ列を2本並べる）
  const times = Math.max(1, Math.ceil(8 / partners.length));
  const row: Partner[] = Array.from({ length: times }, () => partners).flat();
  const duration = Math.max(24, row.length * 4);

  return (
    <aside className="marquee" aria-label="まちきっぷ パートナーズ">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="marquee-label" src="/brand/machikippu-partners-logo.svg" alt="まちきっぷ パートナーズ" width={195} height={16} />
      <div className="marquee-viewport">
        <ul className="marquee-track" style={{ ['--marquee-duration' as string]: `${duration}s` } as React.CSSProperties}>
          {[...row, ...row].map((p, i) => (
            <li key={`${p.id}-${i}`} className="marquee-item" aria-hidden={i >= partners.length ? true : undefined}>
              {p.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={trimmed[p.logoUrl] ?? p.logoUrl} alt={p.name} className="marquee-logo" decoding="async" />
              ) : (
                <span className="marquee-name">{p.name}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
