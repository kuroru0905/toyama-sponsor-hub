'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { buttonClass, Notice, Wordmark } from '@/components/ui';

function ThanksContent() {
  const searchParams = useSearchParams();
  const name = searchParams.get('name') || 'サポーター';
  const method = searchParams.get('method');
  const lineUrl = process.env.NEXT_PUBLIC_LINE_ADD_URL || '#';
  const isInvoice = method === 'invoice';

  const steps = [
    {
      title: '公式LINEを友だちに追加する',
      body: 'ライブのチケットの購入と、入場特典のクーポンは公式LINEから使います。',
      action: (
        <a href={lineUrl} target="_blank" rel="noopener noreferrer" className={buttonClass('line', 'md')}>
          公式LINEを友だち追加する
        </a>
      ),
    },
    {
      title: 'マイページで「LINEと連携する」',
      body: 'スポンサー先行販売でチケットを買うために必要です。ログインはお申し込みのメールアドレスで行います。',
      action: (
        <Link href="/mypage" className={buttonClass('secondary', 'md')}>
          マイページを開く
        </Link>
      ),
    },
    {
      title: '特典を使う',
      body: 'クーポンの掲載申請、出演応募、当日のライブ配信、企業枠のCM・動画のご相談は、すべてマイページから行えます。',
      action: null,
    },
  ];

  return (
    <div className="min-h-screen bg-surface">
      <header className="glass sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4">
          <Link href="/" className="text-lg">
            <Wordmark />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <p className="text-[15px] font-semibold text-ok">{isInvoice ? 'お申し込みを受け付けました' : 'お支払いが完了しました'}</p>
        <h1 className="mt-2 text-[32px] font-semibold leading-tight tracking-tight sm:text-[40px]">{name} 様、ありがとうございます。</h1>

        {isInvoice ? (
          <Notice tone="warn" title="お支払いの確認後に、特典が使えるようになります" className="mt-6">
            ご登録のメールアドレスに請求書をお送りしました。発行日から14日以内にお支払いください。確認ができたら、改めてメールでお知らせします。
          </Notice>
        ) : (
          <p className="mt-4 max-w-prose leading-[1.9] text-ink-2">
            スポンサー契約が有効になり、サイトのサポーター一覧にお名前が載りました。登別のライブとお店を、一緒に支えてくださることに感謝します。
          </p>
        )}

        <h2 className="mt-12 text-xl font-semibold">このあとやること</h2>
        <ol className="mt-4 divide-y divide-line rounded-panel bg-paper shadow-card">
          {steps.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-4">
                <span className="num w-6 shrink-0 text-3xl font-semibold leading-none text-ink-3">{i + 1}</span>
                <div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{s.body}</p>
                </div>
              </div>
              {s.action && <div className="shrink-0 sm:pl-4 [&>a]:w-full sm:[&>a]:w-auto">{s.action}</div>}
            </li>
          ))}
        </ol>

        <p className="mt-10">
          <Link href="/#supporters" className="inline-flex min-h-[44px] items-center text-[15px] text-brand underline underline-offset-4">
            トップページでサポーター一覧を見る
          </Link>
        </p>
      </main>
    </div>
  );
}

export default function ThanksPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <ThanksContent />
    </Suspense>
  );
}
