import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-surface text-ink py-16 px-4">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center gap-2 text-[15px] text-brand underline underline-offset-4 mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          トップページへ戻る
        </Link>

        <h1 className="text-2xl sm:text-3xl font-semibold text-ink mb-4">
          プライバシーポリシー（個人情報保護方針）
        </h1>
        <p className="text-sm text-ink-2 mb-10 leading-relaxed">
          外山企画（以下「当企画」といいます）は、本サービス（スポンサー募集サイトおよびLINE公式アカウントのライブチケット＆クーポン）におけるスポンサー・サポーター・チケット購入者の皆様の個人情報の取り扱いについて、以下の通りプライバシーポリシーを定め、適切な管理と保護に努めます。
        </p>

        <div className="space-y-8 rounded-panel bg-paper shadow-card p-6 sm:p-8 text-[15px] leading-[1.9] text-ink">
          <section>
            <h2 className="text-base font-semibold text-ink mb-2">1. 取得する個人情報</h2>
            <p className="text-ink-2">
              当企画は、スポンサー・サポーターのお申し込みおよびリターン提供にあたり、以下の情報を取得いたします。
            </p>
            <ul className="list-disc list-inside text-ink-2 mt-2 space-y-1">
              <li>氏名、法人名・店舗名、およびWebサイト・会場掲載用の表示名</li>
              <li>メールアドレス</li>
              <li>業種、店舗・事業所所在地（法人・店舗枠お申し込み時）</li>
              <li>決済および契約状況に関する識別情報（※クレジットカード番号等の決済情報は決済代行会社 Stripe が直接処理し、当企画のサーバーには一切保持いたしません）</li>
              <li>出演応募の内容（グループ応募の場合はメンバーの氏名・メールアドレス）</li>
              <li>LINEでチケットを購入・利用する場合：LINEのユーザー識別子および表示名、チケットの購入・入場・入場特典クーポンの利用履歴</li>
              <li>スポンサーがLINE連携を行った場合：連携したLINEのユーザー識別子および表示名</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">2. 個人情報の利用目的</h2>
            <p className="text-ink-2">取得した個人情報は、以下の目的の範囲内でのみ利用いたします。</p>
            <ul className="list-disc list-inside text-ink-2 mt-2 space-y-1">
              <li>スポンサー契約の締結、継続課金管理、および請求書・領収書の発行</li>
              <li>Webサイト、イベント会場ビジョン・看板等へのクレジット掲載</li>
              <li>CM放映・企業PR動画の制作、LINEクーポン掲載、ライブ配信の案内等のリターン特典の履行およびご連絡</li>
              <li>ライブチケットの販売・発券・入場確認、および入場特典クーポンの利用管理</li>
              <li>スポンサー先行販売の対象者の確認、出演応募の受付・選考結果のご連絡</li>
              <li>イベント別の販売数・入場数・店舗送客数などの集計（個人を特定しない形での統計利用を含む）</li>
              <li>お問い合わせへの対応および重要なお知らせの通知</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">3. 外部サービスの利用および第三者提供</h2>
            <p className="text-ink-2">
              当企画は、法令に基づく場合を除き、ご本人の同意なく個人情報を第三者へ提供いたしません。ただし、本サービスのシステム運営および決済処理のため、以下の信頼できる外部サービス事業者へ業務を委託しております。
            </p>
            <ul className="list-disc list-inside text-ink-2 mt-2 space-y-1">
              <li>決済処理・請求書発行：Stripe, Inc.</li>
              <li>データベース・認証基盤：Supabase, Inc.</li>
              <li>Webホスティング：Vercel Inc.</li>
              <li>LINEログイン・LINE公式アカウント：LINEヤフー株式会社</li>
              <li>通知メールの送信：Google LLC（Gmail）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">4. 安全管理措置</h2>
            <p className="text-ink-2">
              当企画は、個人情報の漏えい、滅失またはき損を防止するため、通信の暗号化（SSL/TLS）およびアクセス権限の厳格な制御（Row Level Security）を実施し、適切な安全管理措置を講じます。
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">5. 開示・訂正・削除およびお問い合わせ窓口</h2>
            <p className="text-ink-2">
              ご本人から個人情報の開示、訂正、利用停止、削除等のご請求があった場合、ご本人確認の上、速やかに対応いたします。お問い合わせは下記窓口までご連絡ください。
            </p>
            <div className="mt-3 rounded-ctl border border-line bg-surface p-4 text-xs text-ink-2">
              <p className="font-semibold text-ink">外山企画 個人情報お問い合わせ窓口</p>
              <p className="mt-1">代表：外山 愁真（北海道登別市）</p>
              <p>メール：shyuucham0905@gmail.com</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
