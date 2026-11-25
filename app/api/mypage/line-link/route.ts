import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { HttpError, requireUserEmail } from '@/lib/sponsorCoupons';

export const dynamic = 'force-dynamic';

// LINEのLIFF（チケット＆クーポン）の連携ページ
const LIFF_URL = process.env.LIFF_URL || 'https://liff.line.me/2012539866-QYeWMdED';
const TOKEN_TTL_MS = 10 * 60 * 1000;

// ログイン中のメールアドレスの契約か（状態は問わない：請求書払いの入金待ちでも先に連携できる）
async function requireOwnSponsor(email: string, sponsorId: string | null) {
  if (!sponsorId) throw new HttpError(400, '対象の契約が指定されていません');
  const { data, error } = await supabaseAdmin
    .from('sponsors')
    .select('id')
    .eq('id', sponsorId)
    .eq('email', email)
    .maybeSingle();
  if (error) throw new HttpError(500, 'データの取得に失敗しました');
  if (!data) throw new HttpError(403, '権限がありません');
  return data.id as string;
}

function fail(err: unknown) {
  if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(err);
  return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
}

// 連携状況
export async function GET(req: NextRequest) {
  try {
    const email = await requireUserEmail(req);
    const sponsorId = await requireOwnSponsor(email, req.nextUrl.searchParams.get('sponsorId'));
    const { data, error } = await supabaseAdmin
      .from('sponsor_line_links')
      .select('display_name, linked_at')
      .eq('sponsor_id', sponsorId)
      .maybeSingle();
    if (error) throw new HttpError(500, '連携状況の取得に失敗しました');
    return NextResponse.json({ link: data ?? null });
  } catch (err) {
    return fail(err);
  }
}

// 連携用URLを発行（10分有効・1回限り）
export async function POST(req: NextRequest) {
  try {
    const email = await requireUserEmail(req);
    const body = (await req.json().catch(() => ({}))) as { sponsorId?: string };
    const sponsorId = await requireOwnSponsor(email, body.sponsorId ?? null);

    const token = randomBytes(24).toString('hex');
    const { error } = await supabaseAdmin.from('sponsor_link_tokens').insert({
      token,
      sponsor_id: sponsorId,
      expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    });
    if (error) throw new HttpError(500, '連携URLの発行に失敗しました');
    return NextResponse.json({ url: `${LIFF_URL}/link?token=${token}` });
  } catch (err) {
    return fail(err);
  }
}

// 連携を解除
export async function DELETE(req: NextRequest) {
  try {
    const email = await requireUserEmail(req);
    const sponsorId = await requireOwnSponsor(email, req.nextUrl.searchParams.get('sponsorId'));
    const { error } = await supabaseAdmin.from('sponsor_line_links').delete().eq('sponsor_id', sponsorId);
    if (error) throw new HttpError(500, '連携の解除に失敗しました');
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
