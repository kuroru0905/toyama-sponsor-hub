import { supabaseAdmin } from '@/lib/supabaseAdmin';

// サイト上部の横スクロールに出すパートナー
// ・企業・店舗枠：契約中・掲載OKのみ（ファン枠は人数が増えると列が長くなりすぎるので出さない）
// ・管理者が足した掲示（partner_banner_extras）：表示ONのもの
export type BannerPartner = { id: string; name: string; logoUrl: string | null; tier: 'corporate' | 'store' | 'extra' };

export const LOGO_BUCKET = 'sponsor-logos';

export function logoPublicUrl(path: string | null): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${LOGO_BUCKET}/${path}`;
}

export async function getBannerPartners(): Promise<BannerPartner[]> {
  const [sp, ex] = await Promise.all([
    supabaseAdmin
      .from('sponsors')
      .select('id, tier, display_name, banner_name, logo_path, created_at')
      .eq('status', 'active')
      .eq('is_public', true)
      .in('tier', ['corporate', 'store'])
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('partner_banner_extras')
      .select('id, name, logo_path, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
  ]);
  if (sp.error) throw sp.error;
  if (ex.error) throw ex.error;
  const rows: BannerPartner[] = (sp.data ?? []).map((s) => ({
    id: s.id as string,
    tier: s.tier as 'corporate' | 'store',
    name: ((s.banner_name as string | null) || (s.display_name as string)).slice(0, 40),
    logoUrl: logoPublicUrl(s.logo_path as string | null),
  }));
  const extras: BannerPartner[] = (ex.data ?? []).map((e) => ({
    id: e.id as string,
    tier: 'extra',
    name: (e.name as string).slice(0, 40),
    logoUrl: logoPublicUrl(e.logo_path as string | null),
  }));
  // 企業 → 店舗 → 管理者が足した掲示 の順
  return [...rows.filter((r) => r.tier === 'corporate'), ...rows.filter((r) => r.tier === 'store'), ...extras];
}
