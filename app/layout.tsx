import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_JP } from 'next/font/google';
import './globals.css';
import PartnerMarquee from '@/components/PartnerMarquee';

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
  title: 'まちきっぷ｜若者と地元企業をつなぐ、登別のライブ｜外山企画',
  description:
    'まちきっぷは、若者と地元企業をつなぐ登別の仕組みです。スポンサー制度「まちきっぷ パートナーズ」で地元の企業・お店がイベントごとに協賛し、ファンが毎月応援する若者主役のライブに来た人は、入場するとスポンサーのお店や企業のクーポンをLINEで使えます。',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f5f5f7',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${latin.variable} ${jp.variable}`}>
      <body>
        {/* まちきっぷ パートナーズの横スクロール（管理画面では出さない） */}
        <PartnerMarquee />
        {children}
      </body>
    </html>
  );
}
