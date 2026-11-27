import { NextRequest } from 'next/server';
import { HttpError } from '@/lib/sponsorCoupons';

// ロゴ画像の受け取りと検査（マイページ・管理画面で共通）
export const LOGO_MAX_BYTES = 1024 * 1024; // 1MB

// ファイルの先頭のバイトで画像の種類を確かめる（拡張子や申告された種類は信用しない）
export function detectImage(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { ext: 'png', mime: 'image/png' };
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  return null;
}

// 画像の縦横のピクセル数をファイルの先頭から読む（巨大な画像で閲覧者の端末を重くさせないため）
export const MAX_SIDE = 2000;
export function imageSize(buf: Buffer, ext: string): { w: number; h: number } | null {
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
export function cleanName(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g, '')
    .trim();
}

// multipart の file を受け取り、種類・大きさ・縦横を確かめる
export async function readLogoFile(req: NextRequest): Promise<{ buf: Buffer; ext: string; mime: string }> {
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') throw new HttpError(400, '画像ファイルを選んでください');
  if (file.size > LOGO_MAX_BYTES) throw new HttpError(400, '画像は1MB以内にしてください');
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = detectImage(buf);
  if (!kind) throw new HttpError(400, '画像は PNG・JPEG・WebP のいずれかにしてください');
  const size = imageSize(buf, kind.ext);
  if (!size || size.w < 1 || size.h < 1) throw new HttpError(400, '画像を読み取れませんでした');
  if (size.w > MAX_SIDE || size.h > MAX_SIDE) throw new HttpError(400, `画像は縦横${MAX_SIDE}px以内にしてください`);
  return { buf, ...kind };
}
