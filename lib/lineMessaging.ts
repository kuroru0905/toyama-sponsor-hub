// LINE公式アカウント（Messaging API）から友だち全員に一斉配信する
// 環境変数 LINE_CHANNEL_ACCESS_TOKEN（Messaging APIチャネルの長期アクセストークン）が無ければ送らない
// ※ 無料プラン（コミュニケーションプラン）は月200通まで。友だち1人に1回送ると1通

export async function broadcastLine(text: string, retryKey: string): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.warn('[line] LINE_CHANNEL_ACCESS_TOKEN が未設定のため配信をスキップしました');
    return false;
  }
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        // 同じお知らせを二重に配信しないための再送キー（UUID形式）
        'X-Line-Retry-Key': retryKey,
      },
      body: JSON.stringify({ messages: [{ type: 'text', text: text.slice(0, 5000) }] }),
      cache: 'no-store',
    });
    if (res.ok || res.status === 409) return true; // 409 = 同じ再送キーで配信済み
    console.error('[line] 一斉配信に失敗しました', res.status, await res.text());
    return false;
  } catch (err) {
    console.error('[line] 一斉配信でエラー', err);
    return false;
  }
}

// イベントID＋種類から、決まったUUID形式の再送キーを作る
export function retryKeyFor(eventId: string, kind: 'recruit' | 'sale'): string {
  const hex = eventId.replace(/-/g, '').toLowerCase();
  const tag = kind === 'recruit' ? '1' : '2';
  const h = (tag + hex).slice(0, 32).padEnd(32, '0');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
