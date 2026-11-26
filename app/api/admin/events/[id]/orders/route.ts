import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { HttpError } from '@/lib/sponsorCoupons';
import { requireAdminEmail } from '@/lib/adminAuth';
import { errorJson } from '@/lib/adminValidation';

export const dynamic = 'force-dynamic';

// イベントの購入者一覧（支払済み・入場済み）
export async function GET(req: NextRequest, context: { params: { id: string } }) {
  try {
    await requireAdminEmail(req);
    const { data, error } = await supabaseAdmin
      .from('ticket_orders')
      .select('id, display_name, status, amount_jpy, paid_at, used_at')
      .eq('event_id', context.params.id)
      .in('status', ['paid', 'used', 'refunded'])
      .order('paid_at', { ascending: true });
    if (error) throw new HttpError(500, '購入者一覧の取得に失敗しました');
    return NextResponse.json({ orders: data ?? [] });
  } catch (err) {
    const { status, body } = errorJson(err);
    return NextResponse.json(body, { status });
  }
}
