import React from 'react';

// ===== 共通UI部品 =====
// 方針：ラベルは入力欄の上、補足・記入例は欄の前に文字で、押せる部分は高さ48px以上、
// エラーは欄のすぐ下に出す（デジタル庁デザインシステム／Baymard の知見に合わせる）

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'line';
type ButtonSize = 'md' | 'sm';

// Apple風：ピル型（丸い楕円）のボタン
const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-brand-ink hover:bg-brand-hover border border-brand',
  secondary: 'bg-paper text-brand border border-brand hover:bg-brand-soft',
  ghost: 'bg-transparent text-brand border border-transparent hover:underline underline-offset-4',
  danger: 'bg-paper text-danger border border-danger-line hover:bg-danger-soft',
  line: 'bg-line_green text-white border border-line_green hover:brightness-95',
};
const SIZE: Record<ButtonSize, string> = {
  md: 'min-h-[48px] px-6 text-[17px]',
  sm: 'min-h-[40px] px-4 text-[15px]',
};

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', block = false) {
  return [
    'inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-normal transition-colors',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    VARIANT[variant],
    SIZE[size],
    block ? 'w-full' : '',
  ].join(' ');
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; block?: boolean }) {
  return <button type="button" {...props} className={`${buttonClass(variant, size, block)} ${className}`} />;
}

// 入力欄のまとまり：ラベル → 補足 → 入力欄 → エラー
export function Field({
  label,
  htmlFor,
  required,
  optional,
  hint,
  error,
  children,
  className = '',
}: {
  label: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink">
        {label}
        {required && <span className="text-xs font-medium text-danger">必須</span>}
        {optional && <span className="text-xs font-medium text-ink-2">任意</span>}
      </label>
      {hint && <p className="mt-1 text-sm leading-relaxed text-ink-2">{hint}</p>}
      <div className="mt-2">{children}</div>
      {error && (
        <p role="alert" className="mt-1.5 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

type Tone = 'info' | 'ok' | 'warn' | 'danger';
const NOTICE: Record<Tone, string> = {
  info: 'bg-brand-soft border-brand-line text-ink',
  ok: 'bg-ok-soft border-ok-line text-ink',
  warn: 'bg-warn-soft border-warn-line text-ink',
  danger: 'bg-danger-soft border-danger-line text-ink',
};
const NOTICE_BAR: Record<Tone, string> = {
  info: 'bg-brand',
  ok: 'bg-ok',
  warn: 'bg-accent',
  danger: 'bg-danger',
};

// お知らせ帯（左に色の線。文字は常に墨色で読みやすく）
export function Notice({
  tone = 'info',
  title,
  children,
  className = '',
}: {
  tone?: Tone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`relative overflow-hidden rounded-ctl border pl-5 pr-4 py-3 text-[15px] leading-relaxed ${NOTICE[tone]} ${className}`}
    >
      <span aria-hidden className={`absolute left-0 top-0 h-full w-1.5 ${NOTICE_BAR[tone]}`} />
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
    </div>
  );
}

const BADGE: Record<Tone | 'neutral' | 'accent', string> = {
  neutral: 'bg-surface text-ink-2 border-line',
  info: 'bg-brand-soft text-brand border-brand-line',
  ok: 'bg-ok-soft text-ok border-ok-line',
  warn: 'bg-warn-soft text-warn border-warn-line',
  danger: 'bg-danger-soft text-danger border-danger-line',
  accent: 'bg-accent text-accent-ink border-accent',
};

export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: Tone | 'neutral' | 'accent';
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-5 ${BADGE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

// ページ内の区切り（見出し＋説明＋中身）。カードを並べず、線と余白で区切る
export function Section({
  id,
  title,
  description,
  action,
  children,
  className = '',
}: {
  id?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`card scroll-mt-36 p-6 sm:p-8 lg:scroll-mt-24 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-ink">{title}</h2>
          {description && <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-ink-2">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

// Apple Store風の二色の見出し：前半を濃く、後半を灰色で
export function Headline({
  lead,
  rest,
  as: Tag = 'h2',
  size = 'section',
  className = '',
  id,
}: {
  lead: React.ReactNode;
  rest?: React.ReactNode;
  as?: 'h1' | 'h2';
  size?: 'hero' | 'section';
  className?: string;
  id?: string;
}) {
  const cls =
    size === 'hero'
      ? 'text-[40px] leading-[1.15] sm:text-[64px] sm:leading-[1.08] lg:text-[80px]'
      : 'text-[24px] leading-[1.25] sm:text-[28px] sm:leading-[1.2]';
  return (
    <Tag id={id} className={`font-semibold ${cls} ${className}`}>
      <span className="text-ink">{lead}</span>
      {rest && <span className="text-ink-2"> {rest}</span>}
    </Tag>
  );
}

// 白い面（一覧の1件・フォームの枠など、中身を囲う必要がある時だけ使う）
export function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

// 外山企画のロゴ文字
export function Wordmark({ className = '' }: { className?: string }) {
  // ローマ字のワードマーク：TOYAMA は太く、KIKAKU は細く。字間を広くとる
  return (
    <span className={`wordmark inline-flex items-center gap-2.5 text-ink ${className}`}>
      <span className="sr-only">外山企画</span>
      <span aria-hidden className="wordmark-dot inline-block" />
      <span aria-hidden>
        <span className="font-semibold">TOYAMA</span>
        <span className="ml-[0.24em] font-light text-ink-2">KIKAKU</span>
      </span>
    </span>
  );
}

// 大事な言葉の強調（色はサイト全体で1つ：globals.css の .em）
export function Em({ children }: { children: React.ReactNode }) {
  return <strong className="em">{children}</strong>;
}

// 文中の **ことば** を強調にする（配列で持っている文言用）
export function rich(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) => (i % 2 === 1 ? <Em key={i}>{p}</Em> : <React.Fragment key={i}>{p}</React.Fragment>));
}

// スポンサー枠ごとの金属の色
export const TIER_METAL: Record<string, string> = {
  corporate: 'metal-gold',
  store: 'metal-silver',
  fan: 'metal-bronze',
};
