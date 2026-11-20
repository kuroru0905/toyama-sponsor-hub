import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '外山企画 | 登別地域還元型スポンサー＆サポーター募集',
  description: '音楽×ITで若者と地元企業を結ぶ「地域還元型」エコシステム',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
