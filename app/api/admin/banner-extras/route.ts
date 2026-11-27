import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminEmail } from '@/lib/adminAuth';
import { HttpError } from '@/lib/sponsorCoupons';
import { LOGO_BUCKET, logoPublicUrl } from '@/lib/partnerBanner';
import { cleanName, readLogoFile } from '@/lib/logoImage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function bannerExtrasError(err: unknown) {
  if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error('/api/admin/banner-extras error:', err);
  return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
}

// 管理者が足した横スクロールの掲示の一覧
export async function GET(req: NextRequest) {
  try {
    await requireAdminEmail(req);
    const { data, error } = await supabaseAdmin
      .from('partner_banner_extras')
      .select('id, name, logo_path, is_active, created_at')
      .order('created_at', { ascending: true });
    if (error) throw new HttpError(500, '一覧の取得に失敗しました');
    return NextResponse.json({
      extras: (data ?? []).map((e) => ({ id: e.id, name: e.name, isActive: e.is_active, logoUrl: logoPublicUrl(e.logo_path), createdAt: e.created_at })),
    });
  } catch (err) {
    return bannerExtrasError(err);
  }
}

// 追加：multipart（name 必須、file 任意＝ロゴ）
export async function POST(req: NextRequest) {
  try {
    await requireAdminEmail(req);
    const form = await req.clone().formData().catch(() => null);
    const name = cleanName(form?.get('name'));
    if (!name) throw new HttpError(400, '掲示する名前を入力してください');
    if (name.length > 40) throw new HttpError(400, '名前は40文字以内で入力してください');

    const { count } = await supabaseAdmin.from('partner_banner_extras').select('id', { count: 'exact', head: true });
    if ((count ?? 0) >= 30) throw new HttpError(400, '追加できるのは30件までです');

    const id = randomUUID();
    let logoPath: string | null = null;
    const file = form?.get('file');
    if (file && typeof file !== 'string' && file.size > 0) {
      const img = await readLogoFile(req);
      logoPath = `extras/${id}/${randomBytes(8).toString('hex')}.${img.ext}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from(LOGO_BUCKET)
        .upload(logoPath, img.buf, { contentType: img.mime, cacheControl: '31536000', upsert: false });
      if (upErr) throw new HttpError(500, 'ロゴの保存に失敗しました');
    }

    const { error } = await supabaseAdmin.from('partner_banner_extras').insert({ id, name, logo_path: logoPath });
    if (error) {
      if (logoPath) await supabaseAdmin.storage.from(LOGO_BUCKET).remove([logoPath]);
      throw new HttpError(500, '追加に失敗しました');
    }
    return NextResponse.json({ extra: { id, name, isActive: true, logoUrl: logoPublicUrl(logoPath) } });
  } catch (err) {
    return bannerExtrasError(err);
  }
}
