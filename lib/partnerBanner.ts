import { supabaseAdmin } from '@/lib/supabaseAdmin';

// サイト上部の横スクロールに出すパートナー（企業・店舗の契約中・掲載OKのみ）
export type BannerPartner = { id: string; name: string; logoUrl: string | null; tier: 'corporate' | 'store' };

export const LOGO_BUCKET = 'sponsor-logos';

export function logoPublicUrl(path: string | null): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${LOGO_BUCKET}/${path}`;
}

export async function getBannerPartners(): Promise<BannerPartner[]> {
  const { data, error } = await supabaseAdmin
    .from('sponsors')
    .select('id, tier, display_name, banner_name, logo_path, created_at')
    .eq('status', 'active')
    .eq('is_public', true)
    .in('tier', ['corporate', 'store'])
    .order('created_at', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []).map((s) => ({
    id: s.id as string,
    tier: s.tier as 'corporate' | 'store',
    name: ((s.banner_name as string | null) || (s.display_name as string)).slice(0, 40),
    logoUrl: logoPublicUrl(s.logo_path as string | null),
  }));
  // 企業を先、店舗を後に
  return [...rows.filter((r) => r.tier === 'corporate'), ...rows.filter((r) => r.tier === 'store')];
}
