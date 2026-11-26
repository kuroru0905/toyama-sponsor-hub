import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { HttpError, requireUserEmail, requireActiveSponsor } from '@/lib/sponsorCoupons';

export const dynamic = 'force-dynamic';

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 開演日の23:59:59（日本時間）を過ぎるまで配信リンクを表示する
function endOfStartDayJst(startsAt: string): number {
  const jst = new Date(new Date(startsAt).getTime() + JST_OFFSET_MS);
  return Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate(), 23, 59, 59, 999) - JST_OFFSET_MS;
}

// 当日のライブ配信（YouTube限定公開）：有効なスポンサー（全枠）だけが見られる
export async function GET(req: NextRequest) {
  try {
    const email = await requireUserEmail(req);
    await requireActiveSponsor(email, req.nextUrl.searchParams.get('sponsorId') ?? '');

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from('live_events')
      .select('id, title, venue, starts_at, stream_url')
      .eq('is_published', true)
      .eq('stream_enabled', true)
      .gte('starts_at', since)
      .is('cancelled_at', null)
      .order('starts_at', { ascending: true })
      .limit(5);
    if (error) throw new HttpError(500, '配信情報の取得に失敗しました');

    const now = Date.now();
    const streams = (data ?? [])
      .filter((ev) => endOfStartDayJst(ev.starts_at) >= now)
      .map((ev) => ({
        id: ev.id,
        title: ev.title,
        venue: ev.venue,
        starts_at: ev.starts_at,
        stream_url: ev.stream_url ?? null,
      }));
    return NextResponse.json({ streams });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error(err);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
