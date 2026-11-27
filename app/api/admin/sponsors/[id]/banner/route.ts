import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminEmail } from '@/lib/adminAuth';
import { HttpError } from '@/lib/sponsorCoupons';
import { LOGO_BUCKET } from '@/lib/partnerBanner';

export const dynamic = 'force-dynamic';

// 管理者：上部の横スクロールに出るロゴ・掲示名を外す（不適切な画像や名前への対応）
// ?target=logo → ロゴを消して名前の掲示に戻す / ?target=name → 掲示名を消して掲載名に戻す
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdminEmail(req);
    const id = params.id;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, '見つかりません');
    const target = req.nextUrl.searchParams.get('target');
    if (target !== 'logo' && target !== 'name') throw new HttpError(400, '外す対象が正しくありません');

    const { data: s, error } = await supabaseAdmin.from('sponsors').select('id, logo_path').eq('id', id).maybeSingle();
    if (error) throw new HttpError(500, 'データの取得に失敗しました');
    if (!s) throw new HttpError(404, '見つかりません');

    if (target === 'logo') {
      if (s.logo_path) await supabaseAdmin.storage.from(LOGO_BUCKET).remove([s.logo_path]);
      const { error: upErr } = await supabaseAdmin.from('sponsors').update({ logo_path: null }).eq('id', id);
      if (upErr) throw new HttpError(500, 'ロゴを外せませんでした');
    } else {
      const { error: upErr } = await supabaseAdmin.from('sponsors').update({ banner_name: null }).eq('id', id);
      if (upErr) throw new HttpError(500, '掲示名を戻せませんでした');
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('DELETE /api/admin/sponsors/[id]/banner error:', err);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
