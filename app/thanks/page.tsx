'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, ArrowLeft, MessageCircle } from 'lucide-react';

function ThanksContent() {
  const searchParams = useSearchParams();
  const name = searchParams.get('name') || 'サポーター';
  const method = searchParams.get('method');
  const lineUrl = process.env.NEXT_PUBLIC_LINE_ADD_URL || '#';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full rounded-3xl border border-zinc-800 bg-zinc-900 p-8 sm:p-10 text-center shadow-2xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-teal-400/10 text-teal-400">
          <CheckCircle2 className="h-10 w-10" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold mb-3">
          ご参画ありがとうございます！
        </h1>
        <p className="text-teal-300 font-bold mb-6">{name} 様</p>

        {method === 'invoice' ? (
          <p className="text-sm text-zinc-300 leading-relaxed mb-8">
            ご登録いただいたメールアドレス宛に、Stripeより請求書（PDF）を自動送信いたしました。
            お支払い（発行日より14日以内）の確認後に、サポーター権利とサイト上のサポーター一覧への掲載が有効になります。
          </p>
        ) : (
          <p className="text-sm text-zinc-300 leading-relaxed mb-8">
            サブスクリプション決済が完了し、サイト上のサポーター一覧へのお名前掲載が反映されました！
            登別の地域経済と若者の未来を支える仲間として、心より感謝申し上げます。
          </p>
        )}

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 mb-8 text-left">
          <p className="text-xs font-bold text-amber-400 mb-2">NEXT STEP（リターン受取・連絡窓口）</p>
          <p className="text-xs text-zinc-400 leading-relaxed mb-4">
            LINEクーポンの掲載申請・出演応募・LINE連携（スポンサー先行販売の購入に必要）はマイページから行えます。
            企業枠のCM放映・PR動画制作のご相談もマイページのお問い合わせフォームから受け付け、ご登録のメールアドレス宛にご連絡します。当日のライブ配信リンクもマイページでご案内します。
            ライブチケットの購入と入場特典クーポンは「外山企画 公式LINE」から利用できますので、友だち追加をお願いいたします。
          </p>
          <a
            href={lineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#06C755] py-3 px-4 text-sm font-bold text-white hover:opacity-90 transition"
          >
            <MessageCircle className="h-5 w-5" />
            公式LINEを友だち追加する
          </a>
        </div>

        <Link
          href="/mypage"
          className="mb-4 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 py-3 px-4 text-sm font-bold text-white hover:bg-zinc-800 transition"
        >
          マイページへ
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4" />
          トップページへ戻って掲載を確認する
        </Link>
      </div>
    </div>
  );
}

export default function ThanksPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <ThanksContent />
    </Suspense>
  );
}
