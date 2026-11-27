import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { HttpError, requireUserEmail } from '@/lib/sponsorCoupons';
import { LOGO_BUCKET, logoPublicUrl } from '@/lib/partnerBanner';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BYTES = 1024 * 1024; // 1MB
const BANNER_TIERS = ['corporate', 'store', 'fan'];
const LOGO_TIERS = ['corporate', 'store']; // ファン枠は名前だけ

function handleError(err: unknown) {
  if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error('/api/mypage/logo error:', err);
  return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
}

// 自分の契約（企業・店舗）か確かめる
async function ownSponsor(req: NextRequest) {
  const email = await requireUserEmail(req);
  const sponsorId = req.nextUrl.searchParams.get('sponsorId') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(sponsorId)) throw new HttpError(400, '対象の契約が指定されていません');
  const { data, error } = await supabaseAdmin
    .from('sponsors')
    .select('id, tier, status, display_name, banner_name, logo_path, is_public')
    .eq('id', sponsorId)
    .eq('email', email)
    .maybeSingle();
  if (error) throw new HttpError(500, 'データの取得に失敗しました');
  if (!data) throw new HttpError(403, '権限がありません');
  if (BANNER_TIERS.indexOf(data.tier) === -1) throw new HttpError(403, '権限がありません');
  return data;
}

// ファイルの先頭のバイトで画像の種類を確かめる（拡張子や申告された種類は信用しない）
function detectImage(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { ext: 'png', mime: 'image/png' };
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  return null;
}

// 画像の縦横のピクセル数をファイルの先頭から読む（巨大な画像で閲覧者の端末を重くさせないため）
const MAX_SIDE = 2000;
function imageSize(buf: Buffer, ext: string): { w: number; h: number } | null {
  try {
    if (ext === 'png') return buf.length >= 24 ? { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) } : null;
    if (ext === 'webp') {
      const kind = buf.toString('ascii', 12, 16);
      if (kind === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
      if (kind === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
      if (kind === 'VP8L') {
        const b = buf.readUInt32LE(21);
        return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
      }
      return null;
    }
    // JPEG：SOF（フレームの始まり）の印を探す
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null;
      const m = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
      i += 2 + len;
    }
    return null;
  } catch {
    return null;
  }
}

// 名前に紛れ込ませやすい見えない文字・文字の向きを変える制御文字を取り除く
function cleanName(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g, '')
    .trim();
}

// 今の掲示内容
export async function GET(req: NextRequest) {
  try {
    const s = await ownSponsor(req);
    return NextResponse.json({
      bannerName: s.banner_name ?? '',
      displayName: s.display_name,
      logoAllowed: LOGO_TIERS.indexOf(s.tier) !== -1,
      logoUrl: LOGO_TIERS.indexOf(s.tier) !== -1 ? logoPublicUrl(s.logo_path) : null,
      isPublic: s.is_public,
      isActive: s.status === 'active',
    });
  } catch (err) {
    return handleError(err);
  }
}

// ロゴ画像を登録（PNG・JPEG・WebP、1MBまで）。前のロゴは消す
export async function POST(req: NextRequest) {
  try {
    const s = await ownSponsor(req);
    if (LOGO_TIERS.indexOf(s.tier) === -1) throw new HttpError(403, 'ファンサポーター枠は名前での掲示になります（ロゴは企業・店舗枠の特典です）');
    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    if (!file || typeof file === 'string') throw new HttpError(400, '画像ファイルを選んでください');
    if (file.size > MAX_BYTES) throw new HttpError(400, '画像は1MB以内にしてください');
    const buf = Buffer.from(await file.arrayBuffer());
    const kind = detectImage(buf);
    if (!kind) throw new HttpError(400, '画像は PNG・JPEG・WebP のいずれかにしてください');
    const size = imageSize(buf, kind.ext);
    if (!size || size.w < 1 || size.h < 1) throw new HttpError(400, '画像を読み取れませんでした');
    if (size.w > MAX_SIDE || size.h > MAX_SIDE) throw new HttpError(400, `画像は縦横${MAX_SIDE}px以内にしてください`);

    const path = `${s.id}/${randomBytes(8).toString('hex')}.${kind.ext}`;
    const { error: upError } = await supabaseAdmin.storage
      .from(LOGO_BUCKET)
      .upload(path, buf, { contentType: kind.mime, cacheControl: '31536000', upsert: false });
    if (upError) throw new HttpError(500, 'ロゴの保存に失敗しました');

    const { error } = await supabaseAdmin.from('sponsors').update({ logo_path: path }).eq('id', s.id);
    if (error) {
      await supabaseAdmin.storage.from(LOGO_BUCKET).remove([path]);
      throw new HttpError(500, 'ロゴの保存に失敗しました');
    }
    if (s.logo_path) await supabaseAdmin.storage.from(LOGO_BUCKET).remove([s.logo_path]);
    return NextResponse.json({ logoUrl: logoPublicUrl(path) });
  } catch (err) {
    return handleError(err);
  }
}

// 掲示する名前を保存（空なら掲載名を使う）
export async function PATCH(req: NextRequest) {
  try {
    const s = await ownSponsor(req);
    const body = (await req.json().catch(() => ({}))) as { bannerName?: unknown };
    const raw = cleanName(body.bannerName);
    if (raw.length > 40) throw new HttpError(400, '掲示する名前は40文字以内で入力してください');
    const { error } = await supabaseAdmin.from('sponsors').update({ banner_name: raw || null }).eq('id', s.id);
    if (error) throw new HttpError(500, '保存に失敗しました');
    return NextResponse.json({ bannerName: raw });
  } catch (err) {
    return handleError(err);
  }
}

// ロゴを外す（名前で掲示する）
export async function DELETE(req: NextRequest) {
  try {
    const s = await ownSponsor(req);
    if (s.logo_path) {
      await supabaseAdmin.storage.from(LOGO_BUCKET).remove([s.logo_path]);
      await supabaseAdmin.from('sponsors').update({ logo_path: null }).eq('id', s.id);
    }
    return NextResponse.json({ logoUrl: null });
  } catch (err) {
    return handleError(err);
  }
}
