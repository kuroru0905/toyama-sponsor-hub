'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// カーソル（スマホは指でなぞる）に合わせて、カードが立体的に傾き、青い光が追いかける。
// 離すと、ばねのように元の位置へ滑って戻る。
export function Tilt({
  children,
  className = '',
  max = 7,
  as: Tag = 'div',
  touch = true,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
  as?: 'div' | 'article';
  touch?: boolean; // スワイプする場所では false（横スクロールと競合させない）
} & React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement | null>(null);
  const frame = useRef<number | null>(null);

  const apply = useCallback(
    (clientX: number, clientY: number) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      const py = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        el.style.transform = `perspective(900px) rotateX(${((0.5 - py) * max).toFixed(2)}deg) rotateY(${((px - 0.5) * max).toFixed(2)}deg) translateZ(0)`;
        el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
        el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
      });
    },
    [max]
  );

  const reset = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (frame.current) cancelAnimationFrame(frame.current);
    el.dataset.active = 'false';
    el.style.transform = '';
  }, []);

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (reducedMotion()) return;
    if (e.pointerType !== 'mouse' && !touch) return;
    // 指の場合は押している間だけ（縦スクロールは邪魔しない）
    if (e.pointerType !== 'mouse' && e.buttons === 0) return;
    const el = ref.current;
    if (el) el.dataset.active = 'true';
    apply(e.clientX, e.clientY);
  };

  return React.createElement(
    Tag,
    {
      ...rest,
      ref: (node: HTMLElement | null) => {
        ref.current = node;
      },
      className: `tilt relative ${className}`,
      'data-active': 'false',
      onPointerMove,
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (e.pointerType !== 'mouse' && touch && !reducedMotion()) {
          if (ref.current) ref.current.dataset.active = 'true';
          apply(e.clientX, e.clientY);
        }
      },
      onPointerLeave: reset,
      onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
        if (e.pointerType !== 'mouse') reset();
      },
      onPointerCancel: reset,
    },
    <>
      {children}
      <span aria-hidden className="tilt-glare" />
    </>
  );
}

// 横スワイプで滑るカルーセル（スマホ）。PCでは普通の3列に戻る。
// いま見ているカードを大きく、ほかを少し小さくして「滑っている」感じを出す。
export function GlideCarousel({
  items,
  labels,
  ariaLabel,
}: {
  items: React.ReactNode[];
  labels: string[];
  ariaLabel: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const children = Array.from(el.children) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting && en.intersectionRatio > 0.6) {
            setCurrent(children.indexOf(en.target as HTMLElement));
          }
        });
      },
      { root: el, threshold: [0.6] }
    );
    children.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [items.length]);

  const go = (i: number) => {
    const el = track.current;
    const child = el?.children[i] as HTMLElement | undefined;
    if (!el || !child) return;
    el.scrollTo({ left: child.offsetLeft - 16, behavior: reducedMotion() ? 'auto' : 'smooth' });
  };

  return (
    <div>
      {/* スマホ：どれを見ているかと、押して移動できるタブ */}
      <div role="tablist" aria-label={ariaLabel} className="mb-4 flex gap-2 lg:hidden">
        {labels.map((l, i) => (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={current === i}
            onClick={() => go(i)}
            className={`min-h-[44px] flex-1 rounded-full border text-sm font-bold transition-colors ${
              current === i ? 'border-brand bg-brand text-brand-ink' : 'border-line-strong bg-paper text-ink-2'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      <div ref={track} className="glide-track" aria-label={ariaLabel}>
        {items.map((it, i) => (
          <div key={i} className="glide-item" data-current={current === i ? 'true' : 'false'}>
            {it}
          </div>
        ))}
      </div>
      <p className="mt-1 text-center text-sm text-ink-2 lg:hidden">左右にスワイプして、ほかのプランも見られます</p>
    </div>
  );
}
