import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_JP } from 'next/font/google';
import './globals.css';

// Apple端末では SF Pro / ヒラギノ（システム書体）を優先。
// それ以外（Windows・Android）では、近い印象の Inter（英数字）と Noto Sans JP（日本語）を使う
const latin = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-latin',
});

const jp = Noto_Sans_JP({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jp',
  preload: false,
});

export const metadata: Metadata = {
  title: '外山企画 | 登別地域還元型スポンサー＆サポーター募集',
  description: '音楽×ITで若者と地元企業を結ぶ「地域還元型」エコシステム',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f5f5f7',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${latin.variable} ${jp.variable}`}>
      <body>{children}</body>
    </html>
  );
}
