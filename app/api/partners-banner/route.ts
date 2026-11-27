import { NextResponse } from 'next/server';
import { getBannerPartners } from '@/lib/partnerBanner';

export const dynamic = 'force-dynamic';

// 公開：サイト上部の横スクロール用のパートナー一覧（名前とロゴだけ）
export async function GET() {
  try {
    const partners = await getBannerPartners();
    return NextResponse.json({ partners }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (err) {
    console.error('/api/partners-banner error:', err);
    return NextResponse.json({ partners: [] });
  }
}
