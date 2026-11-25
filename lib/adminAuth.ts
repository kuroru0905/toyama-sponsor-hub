import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { HttpError } from '@/lib/sponsorCoupons';

// 管理者（ADMIN_EMAILS に含まれるメールアドレス）か確認
export async function requireAdminEmail(req: NextRequest): Promise<string> {
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
    throw new HttpError(401, 'セッションが無効です');
  }

  const allowed = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0 || allowed.indexOf(user.email.toLowerCase()) === -1) {
    throw new HttpError(403, '管理者権限がありません（ADMIN_EMAILSを確認してください）');
  }
  return user.email;
}
