import { NextRequest, NextResponse } from 'next/server';
import { HttpError } from '@/lib/sponsorCoupons';
import { requireAdminEmail } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

// ログイン中のメールアドレスが管理者か
export async function GET(req: NextRequest) {
  try {
    const email = await requireAdminEmail(req);
    return NextResponse.json({ email });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
