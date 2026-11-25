import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// クーポンを出せるプラン（店舗ローカル枠・企業プレミアム枠）
export const COUPON_TIERS = ['store', 'corporate'];

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// マジックリンクでログインしたユーザー（メールアドレス）を確認
export async function requireUserEmail(req: NextRequest): Promise<string> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HttpError(401, '認証が必要です');
  }
  const token = authHeader.replace('Bearer ', '');
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user || !user.email) {
    throw new HttpError(401, '認証が必要です');
  }
  return user.email;
}

export type OwnedSponsor = {
  id: string;
  tier: string;
  status: string;
  display_name: string;
};

// ログイン中のメールアドレスの契約で、クーポンを出せるスポンサーか確認
export async function requireCouponSponsor(email: string, sponsorId: string): Promise<OwnedSponsor> {
  if (!sponsorId) throw new HttpError(400, '対象の契約が指定されていません');

  const { data, error } = await supabaseAdmin
    .from('sponsors')
    .select('id, tier, status, display_name')
    .eq('id', sponsorId)
    .eq('email', email)
    .maybeSingle();

  if (error) throw new HttpError(500, 'データの取得に失敗しました');
  if (!data) throw new HttpError(403, '権限がありません');
  if (COUPON_TIERS.indexOf(data.tier) === -1) {
    throw new HttpError(403, 'クーポンは店舗ローカル枠・企業プレミアム枠のご契約で掲載できます');
  }
  if (data.status !== 'active') {
    throw new HttpError(403, 'ご契約が有効になってからクーポンを掲載できます');
  }
  return data as OwnedSponsor;
}

// ログイン中のメールアドレスの契約で、契約中（active）のスポンサーか確認（枠は問わない）
// 特典は「上位の枠は下位の枠の特典も含む」ので、ファン枠の特典（出演応募など）は全枠で使える
export async function requireActiveSponsor(email: string, sponsorId: string): Promise<OwnedSponsor> {
  if (!sponsorId) throw new HttpError(400, '対象の契約が指定されていません');

  const { data, error } = await supabaseAdmin
    .from('sponsors')
    .select('id, tier, status, display_name')
    .eq('id', sponsorId)
    .eq('email', email)
    .maybeSingle();

  if (error) throw new HttpError(500, 'データの取得に失敗しました');
  if (!data) throw new HttpError(403, '権限がありません');
  if (data.status !== 'active') {
    throw new HttpError(403, 'ご契約が有効（契約中）になってからご利用いただけます');
  }
  return data as OwnedSponsor;
}

export function textField(body: Record<string, unknown>, key: string, label: string, max: number): string {
  const v = body[key];
  if (typeof v !== 'string' || !v.trim()) throw new HttpError(400, `${label}を入力してください`);
  const s = v.trim();
  if (s.length > max) throw new HttpError(400, `${label}は${max}文字以内で入力してください`);
  return s;
}
