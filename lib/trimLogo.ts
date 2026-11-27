// 横スクロールのロゴの左右・上下にある透明な余白を、表示する側で切り落とす
// （古い方法で保存されたロゴや、余白つきの画像でも、項目どうしの間隔が等しく見えるように）
const cache = new Map<string, Promise<string>>();

export function trimLogo(url: string): Promise<string> {
  const hit = cache.get(url);
  if (hit) return hit;
  const job = new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) return resolve(url);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(url);
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, w, h);
        let minX = w, minY = h, maxX = -1, maxY = -1;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] > 12) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        // 透明な余白がない（または全部透明）ならそのまま
        if (maxX < 0 || (minX === 0 && minY === 0 && maxX === w - 1 && maxY === h - 1)) return resolve(url);
        const tw = maxX - minX + 1;
        const th = maxY - minY + 1;
        const out = document.createElement('canvas');
        out.width = tw;
        out.height = th;
        const octx = out.getContext('2d');
        if (!octx) return resolve(url);
        octx.drawImage(c, minX, minY, tw, th, 0, 0, tw, th);
        resolve(out.toDataURL('image/png'));
      } catch {
        resolve(url); // 読み取りが許可されない画像はそのまま出す
      }
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });
  cache.set(url, job);
  return job;
}
