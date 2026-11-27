'use client';

// ロゴの大きさ調整：自動でそろえた結果を見せ、スライダーで拡大・縮小してから保存する
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { Prepared, canvasToPngFile, prepareLogo, renderLogo } from '@/lib/logoFit';

interface Props {
  file: File;
  name: string;
  saving: boolean;
  onSave: (png: File) => void;
  onCancel: () => void;
  onError: (text: string) => void;
}

export default function LogoEditor({ file, name, saving, onSave, onCancel, onError }: Props) {
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [percent, setPercent] = useState(100);
  const [preview, setPreview] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;
    prepareLogo(file)
      .then((p) => {
        if (!alive) return;
        setPrepared(p);
        setPercent(p.autoPercent);
      })
      .catch((e: Error) => onError(e.message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  useEffect(() => {
    if (!prepared || !canvasRef.current) return;
    renderLogo(prepared, percent, canvasRef.current);
    setPreview(canvasRef.current.toDataURL('image/png'));
  }, [prepared, percent]);

  const save = async () => {
    if (!canvasRef.current) return;
    try {
      onSave(await canvasToPngFile(canvasRef.current));
    } catch (e) {
      onError((e as Error).message);
    }
  };

  if (!prepared) return <p className="text-ink-2">ロゴの余白と大きさを整えています…</p>;

  return (
    <div className="space-y-5 rounded-panel border border-line p-5">
      <div>
        <p className="text-[15px] font-semibold text-ink">大きさの調整</p>
        <p className="mt-1 text-sm text-ink-2">周りの余白を切り取り、ほかのロゴと見た目の大きさがそろうように自動で整えました。気になるときはスライダーで調整してください。</p>
      </div>

      {/* 拡大表示：点線が掲示される枠 */}
      <div className="flex justify-center rounded-ctl bg-surface p-4">
        <canvas
          ref={canvasRef}
          aria-label="調整中のロゴ（拡大表示）"
          className="block h-auto w-full max-w-[420px] rounded-sm bg-paper outline-dashed outline-1 outline-line-strong"
        />
      </div>

      {/* 実際の大きさ：ほかのパートナーと並べたとき */}
      <div>
        <p className="text-sm font-semibold text-ink">実際の大きさ（サイト上部での並び）</p>
        <div className="mt-2 flex h-14 items-center gap-8 overflow-hidden rounded-ctl border border-line bg-paper px-5">
          <span className="whitespace-nowrap text-[15px] font-semibold text-ink-2">まちの企業</span>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={name} className="marquee-logo" style={{ filter: 'grayscale(1)', opacity: 0.6 }} />
          )}
          <span className="whitespace-nowrap text-[15px] font-semibold text-ink-2">まちのお店</span>
        </div>
      </div>

      <div>
        <label htmlFor="logoScale" className="flex items-center justify-between text-[15px] font-semibold text-ink">
          大きさ
          <span className="text-sm font-normal text-ink-2">{percent}%</span>
        </label>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            aria-label="小さくする"
            onClick={() => setPercent((p) => Math.max(30, p - 5))}
            className="h-10 w-10 shrink-0 rounded-full border border-line-strong text-lg text-ink hover:bg-surface"
          >
            −
          </button>
          <input
            id="logoScale"
            type="range"
            min={30}
            max={100}
            step={1}
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
            className="w-full accent-[var(--brand)]"
          />
          <button
            type="button"
            aria-label="大きくする"
            onClick={() => setPercent((p) => Math.min(100, p + 5))}
            className="h-10 w-10 shrink-0 rounded-full border border-line-strong text-lg text-ink hover:bg-surface"
          >
            ＋
          </button>
        </div>
        {percent !== prepared.autoPercent && (
          <button type="button" onClick={() => setPercent(prepared.autoPercent)} className="mt-2 text-sm font-semibold text-brand hover:underline">
            自動の大きさ（{prepared.autoPercent}%）に戻す
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? '保存しています…' : 'この大きさで保存'}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          やめる
        </Button>
      </div>
    </div>
  );
}
