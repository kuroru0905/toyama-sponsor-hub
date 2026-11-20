import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

async function getAuthenticatedUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.replace('Bearer ', '');
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user || !user.email) {
    return null;
  }
  return user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user || !user.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { data: sponsors, error } = await supabaseAdmin
      .from('sponsors')
      .select('*, sponsor_assets(*)')
      .eq('email', user.email)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch mypage sponsors error:', error);
      return NextResponse.json({ error: 'データの取得に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({
      email: user.email,
      sponsors: sponsors || [],
    });
  } catch (err: any) {
    console.error('GET /api/mypage error:', err);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user || !user.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const body = await req.json();
    const { sponsorId, displayName, isPublic, industry, address } = body;

    if (!sponsorId) {
      return NextResponse.json({ error: '対象IDが指定されていません' }, { status: 400 });
    }

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('sponsors')
      .select('id, tier, email')
      .eq('id', sponsorId)
      .eq('email', user.email)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    }

    const { error: updateErr } = await supabaseAdmin
      .from('sponsors')
      .update({
        display_name: displayName?.trim() || 'サポーター',
        is_public: Boolean(isPublic),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sponsorId);

    if (updateErr) {
      return NextResponse.json({ error: '掲載情報の更新に失敗しました' }, { status: 500 });
    }

    if (existing.tier === 'corporate' || existing.tier === 'store') {
      await supabaseAdmin
        .from('sponsor_assets')
        .update({
          industry: industry ?? '',
          address: address ?? '',
        })
        .eq('sponsor_id', sponsorId);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('PATCH /api/mypage error:', err);
    return NextResponse.json({ error: '更新処理中にエラーが発生しました' }, { status: 500 });
  }
}
