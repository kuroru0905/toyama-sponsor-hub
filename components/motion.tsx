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

// Apple Store風の「棚」：横に滑らせて見るカードの列。
// スマホは指でスワイプ、PCはトラックパッドの横スクロールか、右下の矢印ボタンで1枚ずつ滑る。
export function Shelf({ children, ariaLabel }: { children: React.ReactNode; ariaLabel: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    update();
    const el = track.current;
    if (!el) return;
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [update]);

  const move = (dir: 1 | -1) => {
    const el = track.current;
    const first = el?.children[0] as HTMLElement | undefined;
    if (!el || !first) return;
    el.scrollBy({ left: dir * (first.offsetWidth + 20), behavior: reducedMotion() ? 'auto' : 'smooth' });
  };

  const scrollable = !(edge.start && edge.end);

  return (
    <div>
      <div ref={track} className="shelf" role="region" aria-label={ariaLabel} tabIndex={0}>
        {children}
      </div>
      {scrollable && (
        <div className="mx-auto flex max-w-6xl justify-end gap-3 px-4">
          <button type="button" className="paddle" aria-label="前へ" disabled={edge.start} onClick={() => move(-1)}>
            <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden>
              <path d="M8 2 2 8l6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" className="paddle" aria-label="次へ" disabled={edge.end} onClick={() => move(1)}>
            <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden>
              <path d="m2 2 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
