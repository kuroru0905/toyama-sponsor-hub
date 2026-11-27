import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminEmail } from '@/lib/adminAuth';
import { HttpError } from '@/lib/sponsorCoupons';
import { LOGO_BUCKET } from '@/lib/partnerBanner';

export const dynamic = 'force-dynamic';

function fail(err: unknown) {
  if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error('/api/admin/banner-extras/[id] error:', err);
  return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
}

function checkId(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, '見つかりません');
}

// 表示のON・OFF
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdminEmail(req);
    checkId(params.id);
    const body = (await req.json().catch(() => ({}))) as { isActive?: unknown };
    if (typeof body.isActive !== 'boolean') throw new HttpError(400, '表示のON・OFFを指定してください');
    const { data, error } = await supabaseAdmin
      .from('partner_banner_extras')
      .update({ is_active: body.isActive })
      .eq('id', params.id)
      .select('id')
      .maybeSingle();
    if (error) throw new HttpError(500, '更新に失敗しました');
    if (!data) throw new HttpError(404, '見つかりません');
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}

// 削除（ロゴの画像も消す）
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdminEmail(req);
    checkId(params.id);
    const { data, error } = await supabaseAdmin.from('partner_banner_extras').delete().eq('id', params.id).select('logo_path').maybeSingle();
    if (error) throw new HttpError(500, '削除に失敗しました');
    if (!data) throw new HttpError(404, '見つかりません');
    if (data.logo_path) await supabaseAdmin.storage.from(LOGO_BUCKET).remove([data.logo_path]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
