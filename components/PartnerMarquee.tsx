'use client';

// サイト上部の横スクロール：まちきっぷ パートナーズ（企業・店舗）のロゴまたは名前を流す
// DeepL のロゴ列と同じく、ロゴは灰色で静かに流れ、触れると色が戻って止まる。管理画面には出さない
import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

type Partner = { id: string; name: string; logoUrl: string | null; tier: 'corporate' | 'store' };

export default function PartnerMarquee() {
  const pathname = usePathname();
  const [partners, setPartners] = useState<Partner[]>([]);

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

  if (pathname?.startsWith('/admin') || partners.length === 0) return null;

  // 画面幅より長くなるよう、少ないときは繰り返す（つなぎ目なく流すため同じ列を2本並べる）
  const times = Math.max(1, Math.ceil(8 / partners.length));
  const row: Partner[] = Array.from({ length: times }, () => partners).flat();
  const duration = Math.max(24, row.length * 4);

  return (
    <aside className="marquee" aria-label="まちきっぷ パートナーズ">
      <p className="marquee-label">まちきっぷ パートナーズ</p>
      <div className="marquee-viewport">
        <ul className="marquee-track" style={{ ['--marquee-duration' as string]: `${duration}s` } as React.CSSProperties}>
          {[...row, ...row].map((p, i) => (
            <li key={`${p.id}-${i}`} className="marquee-item" aria-hidden={i >= partners.length ? true : undefined}>
              {p.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.logoUrl} alt={p.name} className="marquee-logo" loading="lazy" decoding="async" />
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
