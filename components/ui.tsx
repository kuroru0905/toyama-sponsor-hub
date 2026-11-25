import React from 'react';

// ===== 共通UI部品 =====
// 方針：ラベルは入力欄の上、補足・記入例は欄の前に文字で、押せる部分は高さ48px以上、
// エラーは欄のすぐ下に出す（デジタル庁デザインシステム／Baymard の知見に合わせる）

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'line';
type ButtonSize = 'md' | 'sm';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-brand-ink hover:bg-brand-hover border border-brand',
  secondary: 'bg-paper text-ink border border-line-strong hover:bg-surface',
  ghost: 'bg-transparent text-brand border border-transparent hover:bg-brand-soft',
  danger: 'bg-paper text-danger border border-danger-line hover:bg-danger-soft',
  line: 'bg-line_green text-white border border-line_green hover:brightness-95',
};
const SIZE: Record<ButtonSize, string> = {
  md: 'min-h-[48px] px-5 text-[15px]',
  sm: 'min-h-[44px] px-4 text-sm',
};

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', block = false) {
  return [
    'inline-flex items-center justify-center gap-2 rounded-ctl font-bold transition-colors',
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
      <label htmlFor={htmlFor} className="flex flex-wrap items-center gap-2 text-[15px] font-bold text-ink">
        {label}
        {required && <span className="rounded px-1.5 py-0.5 text-xs font-bold bg-danger-soft text-danger">必須</span>}
        {optional && <span className="rounded px-1.5 py-0.5 text-xs font-bold bg-surface text-ink-2">任意</span>}
      </label>
      {hint && <p className="mt-1 text-sm leading-relaxed text-ink-2">{hint}</p>}
      <div className="mt-2">{children}</div>
      {error && (
        <p role="alert" className="mt-1.5 text-sm font-bold text-danger">
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
      className={`relative overflow-hidden rounded-ctl border pl-5 pr-4 py-3 text-sm leading-relaxed ${NOTICE[tone]} ${className}`}
    >
      <span aria-hidden className={`absolute left-0 top-0 h-full w-1.5 ${NOTICE_BAR[tone]}`} />
      {title && <p className="font-bold">{title}</p>}
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
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-bold leading-5 ${BADGE[tone]} ${className}`}
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
    <section id={id} className={`scroll-mt-36 lg:scroll-mt-24 border-t border-line pt-8 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink">{title}</h2>
          {description && <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-2">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

// 白い面（一覧の1件・フォームの枠など、中身を囲う必要がある時だけ使う）
export function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-panel border border-line bg-paper ${className}`}>{children}</div>;
}

// 外山企画のロゴ文字
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-2 font-bold text-ink ${className}`}>
      <span aria-hidden className="inline-block h-3 w-3 translate-y-[1px] rounded-sm bg-accent" />
      外山企画
    </span>
  );
}
