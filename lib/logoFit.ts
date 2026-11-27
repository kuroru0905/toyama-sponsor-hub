// ロゴの大きさを自動でそろえる（ブラウザ内で処理。サーバーには仕上がったPNGだけ送る）
// 1. 周りの余白（透明、または四隅と同じ色）を切り取る
// 2. 「見た目の面積」がそろうように縮める（正方形のロゴは高さいっぱい、横長は少し小さめ）
// 3. 高さ120pxのPNGにする（横幅はロゴの幅ぴったり。左右に余白を残さず、並べたときの間隔をそろえる）
//    → 掲示では高さ28px（横は最大140px）で表示

export const BOX_W = 600;
export const BOX_H = 120;
const TARGET_AREA = BOX_W * BOX_H * 0.4; // 枠の4割くらいの面積を目安にそろえる
const MAX_SOURCE = 1600; // 解析する元画像の長辺の上限

export type Prepared = {
  canvas: HTMLCanvasElement; // 余白を切り取った元画像
  w: number;
  h: number;
  autoPercent: number; // 自動でそろえた大きさ（最大＝100）
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('画像を読み込めませんでした'));
    };
    img.src = url;
  });
}

export async function prepareLogo(file: File): Promise<Prepared> {
  const img = await loadImage(file);
  const ratio = Math.min(1, MAX_SOURCE / Math.max(img.naturalWidth, img.naturalHeight));
  const sw = Math.max(1, Math.round(img.naturalWidth * ratio));
  const sh = Math.max(1, Math.round(img.naturalHeight * ratio));
  const src = document.createElement('canvas');
  src.width = sw;
  src.height = sh;
  const sctx = src.getContext('2d', { willReadFrequently: true });
  if (!sctx) throw new Error('この端末では画像を加工できません');
  sctx.drawImage(img, 0, 0, sw, sh);
  const { data } = sctx.getImageData(0, 0, sw, sh);

  // 背景の判定：透明な部分があれば透明が背景。なければ四隅の色を背景とみなす
  const px = (x: number, y: number) => (y * sw + x) * 4;
  const corners = [px(0, 0), px(sw - 1, 0), px(0, sh - 1), px(sw - 1, sh - 1)];
  const hasAlpha = corners.some((i) => data[i + 3] < 250);
  const bg = [0, 1, 2].map((k) => Math.round(corners.reduce((a, i) => a + data[i + k], 0) / 4));
  const isBg = (i: number) => {
    if (data[i + 3] < 16) return true;
    if (hasAlpha) return false;
    return Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) < 48;
  };

  let minX = sw, minY = sh, maxX = -1, maxY = -1;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (!isBg(px(x, y))) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) {
    // 全部が背景色（ほぼ無地）のときは切り取らない
    minX = 0; minY = 0; maxX = sw - 1; maxY = sh - 1;
  }
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('この端末では画像を加工できません');
  ctx.drawImage(src, minX, minY, w, h, 0, 0, w, h);

  const fit = Math.min(BOX_W / w, BOX_H / h);
  const auto = Math.min(fit, Math.sqrt(TARGET_AREA / (w * h)));
  return { canvas, w, h, autoPercent: Math.round((auto / fit) * 100) };
}

// percent：枠に収まる最大の大きさを100としたときの大きさ
export function renderLogo(p: Prepared, percent: number, out: HTMLCanvasElement) {
  const fit = Math.min(BOX_W / p.w, BOX_H / p.h);
  const s = fit * Math.min(100, Math.max(10, percent)) / 100;
  const dw = p.w * s;
  const dh = p.h * s;
  const outW = Math.max(1, Math.ceil(dw));
  out.width = outW;
  out.height = BOX_H;
  const ctx = out.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, outW, BOX_H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(p.canvas, (outW - dw) / 2, (BOX_H - dh) / 2, dw, dh);
}

export function canvasToPngFile(c: HTMLCanvasElement): Promise<File> {
  return new Promise((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(new File([b], 'logo.png', { type: 'image/png' })) : reject(new Error('画像を作れませんでした'))), 'image/png');
  });
}
