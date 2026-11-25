import type { Metadata, Viewport } from 'next';
import { BIZ_UDPGothic, Barlow_Condensed } from 'next/font/google';
import './globals.css';

// 本文・見出し：モリサワのユニバーサルデザイン書体（読みやすさ優先）
const body = BIZ_UDPGothic({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
  preload: false,
});

// 価格・日時・枚数などの数字：チケットの印字のような細長い数字
const num = Barlow_Condensed({
  weight: ['500', '600'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-num',
});

export const metadata: Metadata = {
  title: '外山企画 | 登別地域還元型スポンサー＆サポーター募集',
  description: '音楽×ITで若者と地元企業を結ぶ「地域還元型」エコシステム',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${body.variable} ${num.variable}`}>
      <body>{children}</body>
    </html>
  );
}
