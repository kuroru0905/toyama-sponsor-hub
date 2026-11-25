import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TokushohoPage() {
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

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-8">
          特定商取引法に基づく表記
        </h1>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-zinc-800">
              <tr>
                <th className="w-1/3 bg-zinc-900/80 px-6 py-4 font-bold text-zinc-300">
                  事業者の名称
                </th>
                <td className="px-6 py-4 text-zinc-400">外山企画（代表：外山 愁真）</td>
              </tr>
              <tr>
                <th className="bg-zinc-900/80 px-6 py-4 font-bold text-zinc-300">所在地</th>
                <td className="px-6 py-4 text-zinc-400">
                  北海道登別市（※請求があった場合、遅滞なく開示いたします）
                </td>
              </tr>
              <tr>
                <th className="bg-zinc-900/80 px-6 py-4 font-bold text-zinc-300">連絡先</th>
                <td className="px-6 py-4 text-zinc-400">
                  メール：shyuucham0905@gmail.com
                  <br />
                  （※お電話での開示をご希望の場合はメールにてご請求ください）
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="text-lg font-bold text-white mt-10 mb-4">スポンサー・サポーター（月額プラン）</h2>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-zinc-800">
              <tr>
                <th className="bg-zinc-900/80 px-6 py-4 font-bold text-zinc-300">販売価格</th>
                <td className="px-6 py-4 text-zinc-400">
                  ・企業プレミアム枠：月額 10,000円（税込）
                  <br />
                  ・店舗ローカル枠：月額 3,000円（税込）
                  <br />
                  ・ファンサポーター枠：月額 300円（税込）
                </td>
              </tr>
              <tr>
                <th className="bg-zinc-900/80 px-6 py-4 font-bold text-zinc-300">
                  商品代金以外の必要料金
                </th>
                <td className="px-6 py-4 text-zinc-400">
                  インターネット接続料金、通信料金等はお客様のご負担となります。銀行振込の場合は振込手数料をご負担ください。
                </td>
              </tr>
              <tr>
                <th className="bg-zinc-900/80 px-6 py-4 font-bold text-zinc-300">
                  お支払い方法・時期
                </th>
                <td className="px-6 py-4 text-zinc-400">
                  クレジットカード決済（初回申込時に決済、以降毎月同日に自動課金）または請求書払い（発行日より14日以内にお支払い）
                </td>
              </tr>
              <tr>
                <th className="bg-zinc-900/80 px-6 py-4 font-bold text-zinc-300">
                  サービスの提供時期
                </th>
                <td className="px-6 py-4 text-zinc-400">
                  クレジットカード決済は決済完了後直ちに、請求書払いはお支払いの確認後に、サポーター権利およびWeb掲載が有効となります。制作物リターンはヒアリング後順次提供いたします。
                </td>
              </tr>
              <tr>
                <th className="bg-zinc-900/80 px-6 py-4 font-bold text-zinc-300">
                  解約・返金について
                </th>
                <td className="px-6 py-4 text-zinc-400">
                  デジタルサービスおよびスポンサー性質上、決済完了後の返金は原則お受けしておりません。サブスクリプションの解約は次回更新日の前日までに所定の手続きを行うことでいつでも可能であり、次回以降の請求は発生いたしません。
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 id="ticket" className="scroll-mt-8 text-lg font-bold text-white mt-10 mb-4">
          ライブチケット（LINE公式アカウントで販売）
        </h2>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-zinc-800">
              <tr>
                <th className="bg-zinc-900/80 px-6 py-4 font-bold text-zinc-300">販売価格</th>
                <td className="px-6 py-4 text-zinc-400">
                  公演ごとにLINE公式アカウントのチケット画面に表示する価格（税込）
                </td>
              </tr>
              <tr>
                <th className="bg-zinc-900/80 px-6 py-4 font-bold text-zinc-300">商品代金以外の必要料金</th>
                <td className="px-6 py-4 text-zinc-400">
                  インターネット接続料金・通信料金等はお客様のご負担となります。
                </td>
              </tr>
              <tr>
                <th className="bg-zinc-900/80 px-6 py-4 font-bold text-zinc-300">お支払い方法・時期</th>
                <td className="px-6 py-4 text-zinc-400">
                  クレジットカード決済（Stripe）。購入手続き時に決済されます。
                </td>
              </tr>
              <tr>
                <th className="bg-zinc-900/80 px-6 py-4 font-bold text-zinc-300">引渡し時期</th>
                <td className="px-6 py-4 text-zinc-400">
                  決済完了後、直ちにLINE公式アカウントのチケット画面に電子チケットが表示されます。
                </td>
              </tr>
              <tr>
                <th className="bg-zinc-900/80 px-6 py-4 font-bold text-zinc-300">販売期間</th>
                <td className="px-6 py-4 text-zinc-400">
                  公演ごとに定める販売期間（スポンサー先行販売・一般販売）から、開演時刻まで。お一人様1公演につき1枚までです。
                </td>
              </tr>
              <tr>
                <th className="bg-zinc-900/80 px-6 py-4 font-bold text-zinc-300">入場について</th>
                <td className="px-6 py-4 text-zinc-400">
                  電子チケットの「入場する」ボタンは、開演3時間前から開演日の23:59まで利用できます。スタッフの前で押してください。一度使用すると元に戻せません。
                </td>
              </tr>
              <tr>
                <th className="bg-zinc-900/80 px-6 py-4 font-bold text-zinc-300">キャンセル・返金について</th>
                <td className="px-6 py-4 text-zinc-400">
                  お客様のご都合によるキャンセル・返金は、原則としてお受けしておりません。主催者の都合により公演が中止となった場合は、購入代金の全額を、購入時のクレジットカードへ返金いたします。
                </td>
              </tr>
              <tr>
                <th className="bg-zinc-900/80 px-6 py-4 font-bold text-zinc-300">入場特典クーポン</th>
                <td className="px-6 py-4 text-zinc-400">
                  入場1回につき、スポンサー店舗のクーポンを1枚、入場日の翌日23:59までご利用いただけます。クーポンは無償の特典であり、内容は各店舗が提供します。
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-8 text-sm text-zinc-500">
          個人情報の取り扱いは
          <Link href="/privacy" className="text-teal-400 underline mx-1">
            プライバシーポリシー
          </Link>
          をご確認ください。
        </p>
      </div>
    </div>
  );
}
