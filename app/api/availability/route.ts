import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { TIER_CAPS } from '@/lib/tierCaps';
import { sponsorableEvents } from '@/lib/eventSponsorship';

export const dynamic = 'force-dynamic';

// 協賛を受け付けているイベントと、イベントごとの枠の残り（LPの申込画面用）
// 企業6社・お店20店の上限はイベントごと。支払い済みの協賛だけを数える
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
    const capC = TIER_CAPS.corporate as number;
    const capS = TIER_CAPS.store as number;
    return NextResponse.json({
      caps: { corporate: capC, store: capS },
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        venue: e.venue,
        starts_at: e.starts_at,
        deadline: e.deadline,
        remaining: {
          corporate: Math.max(0, capC - (paid[e.id]?.corporate ?? 0)),
          store: Math.max(0, capS - (paid[e.id]?.store ?? 0)),
        },
      })),
    });
  } catch (err) {
    console.error('/api/availability error:', err);
    return NextResponse.json({ caps: {}, events: [] });
  }
}
