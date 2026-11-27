import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sponsorableEvents } from '@/lib/eventSponsorship';

export const dynamic = 'force-dynamic';

// 協賛を受け付けているイベントと、イベントごとの枠の残り（LPの申込画面用）
// 上限はイベントごと（イベント作成時に決める。0＝その枠は募集しない）。支払い済みの協賛だけを数える
export async function GET() {
  try {
    const events = await sponsorableEvents();
    const ids = events.map((e) => e.id);
    const paid: Record<string, { corporate: number; store: number }> = {};
    if (ids.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('event_sponsorships')
        .select('event_id, tier')
        .in('event_id', ids)
        .eq('status', 'paid');
      if (error) throw error;
      for (const r of data ?? []) {
        const k = r.event_id as string;
        paid[k] ??= { corporate: 0, store: 0 };
        if (r.tier === 'corporate' || r.tier === 'store') paid[k][r.tier as 'corporate' | 'store'] += 1;
      }
    }
    return NextResponse.json({
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        venue: e.venue,
        starts_at: e.starts_at,
        deadline: e.deadline,
        caps: e.caps,
        remaining: {
          corporate: Math.max(0, e.caps.corporate - (paid[e.id]?.corporate ?? 0)),
          store: Math.max(0, e.caps.store - (paid[e.id]?.store ?? 0)),
        },
      })),
    });
  } catch (err) {
    console.error('/api/availability error:', err);
    return NextResponse.json({ events: [] });
  }
}
