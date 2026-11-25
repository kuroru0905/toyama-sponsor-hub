import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { HttpError } from '@/lib/sponsorCoupons';
import { requireAdminEmail } from '@/lib/adminAuth';
import { parseEventInput, checkEventTimeline, errorJson } from '@/lib/adminValidation';

export const dynamic = 'force-dynamic';

// イベント編集（送られた項目だけ）。削除はできない：販売をやめるときは非公開にする
export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  try {
    await requireAdminEmail(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const input = parseEventInput(body, true);
    if (Object.keys(input).length === 0) throw new HttpError(400, '変更する項目がありません');

    const { data: current, error: currentError } = await supabaseAdmin
      .from('live_events')
      .select('starts_at, recruit_performers, recruit_deadline, presale_start, general_sale_start')
      .eq('id', context.params.id)
      .maybeSingle();
    if (currentError) throw new HttpError(500, `イベントの取得に失敗しました（${currentError.message}）`);
    if (!current) throw new HttpError(404, 'イベントが見つかりません');
    checkEventTimeline({ ...current, ...input });

    const { data, error } = await supabaseAdmin
      .from('live_events')
      .update(input)
      .eq('id', context.params.id)
      .select('id')
      .maybeSingle();
    if (error) throw new HttpError(500, `イベントの更新に失敗しました（${error.message}）`);
    if (!data) throw new HttpError(404, 'イベントが見つかりません');
    return NextResponse.json({ id: data.id });
  } catch (err) {
    const { status, body } = errorJson(err);
    return NextResponse.json(body, { status });
  }
}
