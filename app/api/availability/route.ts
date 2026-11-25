import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { TIER_CAPS } from '@/lib/tierCaps';

export const dynamic = 'force-dynamic';

// 上限のある枠の残り（LPの「残り○社／満枠」表示用）
export async function GET() {
  const tiers = Object.keys(TIER_CAPS);
  const results = await Promise.all(
    tiers.map((tier) =>
      supabaseAdmin
        .from('sponsors')
        .select('id', { count: 'exact', head: true })
        .eq('tier', tier)
        .eq('status', 'active')
    )
  );
  const availability: Record<string, { cap: number; remaining: number }> = {};
  for (let i = 0; i < tiers.length; i++) {
    const cap = TIER_CAPS[tiers[i]] as number;
    if (results[i].error) continue;
    availability[tiers[i]] = { cap, remaining: Math.max(0, cap - (results[i].count ?? 0)) };
  }
  return NextResponse.json({ availability });
}
