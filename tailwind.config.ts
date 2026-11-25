import type { Config } from 'tailwindcss';

// 色は app/globals.css の CSS 変数で一元管理（ブランドカラーが決まったらそこだけ差し替える）
const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)', 3: 'var(--ink-3)' },
        line: { DEFAULT: 'var(--line)', strong: 'var(--line-strong)' },
        paper: 'var(--paper)',
        surface: 'var(--surface)',
        brand: { DEFAULT: 'var(--brand)', hover: 'var(--brand-hover)', soft: 'var(--brand-soft)', ink: 'var(--brand-ink)', line: 'var(--brand-line)', glow: 'var(--brand-glow)' },
        accent: { DEFAULT: 'var(--accent)', soft: 'var(--accent-soft)', ink: 'var(--accent-ink)' },
        ok: { DEFAULT: 'var(--ok)', soft: 'var(--ok-soft)', line: 'var(--ok-line)' },
        warn: { DEFAULT: 'var(--warn)', soft: 'var(--warn-soft)', line: 'var(--warn-line)' },
        danger: { DEFAULT: 'var(--danger)', soft: 'var(--danger-soft)', line: 'var(--danger-line)' },
        line_green: '#06C755',
      },
      fontFamily: {
        sans: ['var(--font-body)', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Meiryo', 'sans-serif'],
        num: ['var(--font-num)', 'var(--font-body)', 'sans-serif'],
      },
      borderRadius: {
        ctl: '8px',
        panel: '12px',
      },
      maxWidth: {
        prose: '40rem',
      },
    },
  },
  plugins: [],
};
export default config;
