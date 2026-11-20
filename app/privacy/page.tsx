import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 py-16 px-4">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-teal-400 hover:underline mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          トップページへ戻る
        </Link>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">
          プライバシーポリシー（個人情報保護方針）
        </h1>
        <p className="text-sm text-zinc-400 mb-10 leading-relaxed">
          外山企画（以下「当企画」といいます）は、本サービスにおけるスポンサーおよびサポーターの皆様の個人情報の取り扱いについて、以下の通りプライバシーポリシーを定め、適切な管理と保護に努めます。
        </p>

        <div className="space-y-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8 text-sm leading-relaxed text-zinc-300">
          <section>
            <h2 className="text-base font-bold text-white mb-2">1. 取得する個人情報</h2>
            <p className="text-zinc-400">
              当企画は、スポンサー・サポーターのお申し込みおよびリターン提供にあたり、以下の情報を取得いたします。
            </p>
            <ul className="list-disc list-inside text-zinc-400 mt-2 space-y-1">
              <li>氏名、法人名・店舗名、およびWebサイト・会場掲載用の表示名</li>
              <li>メールアドレス</li>
              <li>業種、店舗・事業所所在地（法人・店舗枠お申し込み時）</li>
              <li>決済および契約状況に関する識別情報（※クレジットカード番号等の決済情報は決済代行会社 Stripe が直接処理し、当企画のサーバーには一切保持いたしません）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">2. 個人情報の利用目的</h2>
            <p className="text-zinc-400">取得した個人情報は、以下の目的の範囲内でのみ利用いたします。</p>
            <ul className="list-disc list-inside text-zinc-400 mt-2 space-y-1">
              <li>スポンサー契約の締結、継続課金管理、および請求書・領収書の発行</li>
              <li>Webサイト、イベント会場ビジョン・看板等へのクレジット掲載</li>
              <li>PR動画・画像制作、LINEクーポン配信等のリターン特典の履行およびご連絡</li>
              <li>お問い合わせへの対応および重要なお知らせの通知</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">3. 外部サービスの利用および第三者提供</h2>
            <p className="text-zinc-400">
              当企画は、法令に基づく場合を除き、ご本人の同意なく個人情報を第三者へ提供いたしません。ただし、本サービスのシステム運営および決済処理のため、以下の信頼できる外部サービス事業者へ業務を委託しております。
            </p>
            <ul className="list-disc list-inside text-zinc-400 mt-2 space-y-1">
              <li>決済処理・請求書発行：Stripe, Inc.</li>
              <li>データベース・認証基盤：Supabase, Inc.</li>
              <li>Webホスティング：Vercel Inc.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">4. 安全管理措置</h2>
            <p className="text-zinc-400">
              当企画は、個人情報の漏えい、滅失またはき損を防止するため、通信の暗号化（SSL/TLS）およびアクセス権限の厳格な制御（Row Level Security）を実施し、適切な安全管理措置を講じます。
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">5. 開示・訂正・削除およびお問い合わせ窓口</h2>
            <p className="text-zinc-400">
              ご本人から個人情報の開示、訂正、利用停止、削除等のご請求があった場合、ご本人確認の上、速やかに対応いたします。お問い合わせは下記窓口までご連絡ください。
            </p>
            <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-400">
              <p className="font-bold text-zinc-200">外山企画 個人情報お問い合わせ窓口</p>
              <p className="mt-1">代表：外山 愁真（北海道登別市）</p>
              <p>メール：info@toyama-kikaku.example.com</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
