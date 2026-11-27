import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logoPublicUrl } from '@/lib/partnerBanner';

function getAllowedAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || '';
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false as const, status: 401, error: '認証が必要です' };
  }

  const token = authHeader.replace('Bearer ', '');
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user || !user.email) {
    return { ok: false as const, status: 401, error: 'セッションが無効です' };
  }

  const allowed = getAllowedAdminEmails();
  if (allowed.length === 0 || !allowed.includes(user.email.toLowerCase())) {
    return {
      ok: false as const,
      status: 403,
      error: '管理者権限がありません（ADMIN_EMAILSを確認してください）',
    };
  }

  return { ok: true as const, user };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { data, error } = await supabaseAdmin
      .from('sponsors')
      .select('*, sponsor_assets(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Admin GET sponsors error:', error);
      return NextResponse.json({ error: '一覧の取得に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({
      adminEmail: auth.user.email,
      sponsors: (data || []).map((s: any) => ({ ...s, logo_url: logoPublicUrl(s.logo_path ?? null) })),
    });
  } catch (err: any) {
    console.error('GET /api/admin error:', err);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await verifyAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const { sponsorId, status, isPublic } = body;

    if (!sponsorId) {
      return NextResponse.json({ error: '対象IDが指定されていません' }, { status: 400 });
    }

    const allowedStatuses = ['active', 'pending', 'past_due', 'canceled', 'ended'];
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (status !== undefined) {
      if (!allowedStatuses.includes(status)) {
        return NextResponse.json({ error: '不正なステータスです' }, { status: 400 });
      }
      updatePayload.status = status;
    }

    if (isPublic !== undefined) {
      updatePayload.is_public = Boolean(isPublic);
    }

    const { error: updateErr } = await supabaseAdmin
      .from('sponsors')
      .update(updatePayload)
      .eq('id', sponsorId);

    if (updateErr) {
      console.error('Admin PATCH sponsor error:', updateErr);
      return NextResponse.json({ error: 'ステータスの更新に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('PATCH /api/admin error:', err);
    return NextResponse.json({ error: '更新処理中にエラーが発生しました' }, { status: 500 });
  }
}
