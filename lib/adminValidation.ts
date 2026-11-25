import { HttpError } from '@/lib/sponsorCoupons';

type Json = Record<string, unknown>;

function str(body: Json, key: string, label: string, required: boolean, max = 400): string | undefined {
  const v = body[key];
  if (v === undefined || v === null || v === '') {
    if (required) throw new HttpError(400, `${label}を入力してください`);
    return undefined;
  }
  if (typeof v !== 'string') throw new HttpError(400, `${label}の形式が不正です`);
  const s = v.trim();
  if (required && !s) throw new HttpError(400, `${label}を入力してください`);
  if (s.length > max) throw new HttpError(400, `${label}は${max}文字以内で入力してください`);
  return s;
}

function bool(body: Json, key: string): boolean | undefined {
  const v = body[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'boolean') throw new HttpError(400, `${key} の形式が不正です`);
  return v;
}

function date(body: Json, key: string, label: string, required: boolean): string | null | undefined {
  const v = body[key];
  if (v === undefined) {
    if (required) throw new HttpError(400, `${label}を入力してください`);
    return undefined;
  }
  if (v === null || v === '') {
    if (required) throw new HttpError(400, `${label}を入力してください`);
    return null;
  }
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new HttpError(400, `${label}の形式が不正です`);
  return d.toISOString();
}

// イベント入力。partial=true は送られた項目だけ（編集用）
export function parseEventInput(body: Json, partial: boolean) {
  const out: Record<string, unknown> = {};

  const title = str(body, 'title', '公演名', !partial, 80);
  if (title !== undefined) out.title = title;

  const venue = str(body, 'venue', '会場', !partial, 80);
  if (venue !== undefined) out.venue = venue;

  if (body.description !== undefined) out.description = str(body, 'description', '説明', false, 2000) ?? '';

  const startsAt = date(body, 'starts_at', '開演日時', !partial);
  if (startsAt !== undefined) out.starts_at = startsAt;

  if (body.price_jpy !== undefined || !partial) {
    const price = Number(body.price_jpy);
    if (!Number.isInteger(price) || price < 50) {
      throw new HttpError(400, '価格は50円以上の整数で入力してください（Stripeの最低金額）');
    }
    out.price_jpy = price;
  }

  if (body.capacity !== undefined) {
    if (body.capacity === null || body.capacity === '') {
      out.capacity = null;
    } else {
      const cap = Number(body.capacity);
      if (!Number.isInteger(cap) || cap <= 0) {
        throw new HttpError(400, '定員は1以上の整数で入力してください（無制限なら空欄）');
      }
      out.capacity = cap;
    }
  }

  const published = bool(body, 'is_published');
  if (published !== undefined) out.is_published = published;

  // 出演者募集：募集するなら締切が必須
  const recruit = bool(body, 'recruit_performers');
  if (recruit !== undefined) out.recruit_performers = recruit;
  const deadline = date(body, 'recruit_deadline', '出演者募集の締切', false);
  if (deadline !== undefined) out.recruit_deadline = deadline;
  if (recruit === true && !deadline) {
    throw new HttpError(400, '出演者を募集する場合は、募集の締切日時を入力してください');
  }
  if (recruit === false && deadline === undefined) out.recruit_deadline = null;

  // 当日のライブ配信をするか（しないイベントは配信URL・未入力アラートの対象外）
  const streamEnabled = bool(body, 'stream_enabled');
  if (streamEnabled !== undefined) out.stream_enabled = streamEnabled;

  // 当日のライブ配信（YouTubeの限定公開リンク）。スポンサーのマイページにだけ表示する
  if (streamEnabled === false) {
    out.stream_url = null;
    out.stream_alert_sent_at = null;
  } else if (body.stream_url !== undefined) {
    const raw = typeof body.stream_url === 'string' ? body.stream_url.trim() : body.stream_url;
    if (raw === null || raw === '') {
      out.stream_url = null;
    } else {
      if (typeof raw !== 'string') throw new HttpError(400, '配信URLの形式が不正です');
      let host = '';
      try {
        const u = new URL(raw);
        if (u.protocol !== 'https:') throw new Error('not https');
        host = u.hostname.toLowerCase();
      } catch {
        throw new HttpError(400, '配信URLは https:// から始まるURLで入力してください');
      }
      const isYoutube = host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com');
      if (!isYoutube) throw new HttpError(400, '配信URLはYouTubeのURL（youtube.com / youtu.be）を入力してください');
      if (raw.length > 500) throw new HttpError(400, '配信URLが長すぎます');
      out.stream_url = raw;
    }
    // URLを入れ直したら、未入力アラートの送信記録もリセット（消した場合は再びアラート対象）
    out.stream_alert_sent_at = null;
  }

  // 先行販売（スポンサー限定）・一般販売の開始日時。空欄なら公開と同時に一般販売
  const presale = date(body, 'presale_start', 'スポンサー先行販売の開始日時', false);
  if (presale !== undefined) out.presale_start = presale;
  const general = date(body, 'general_sale_start', '一般販売の開始日時', false);
  if (general !== undefined) out.general_sale_start = general;

  return out;
}

type Timeline = {
  starts_at?: string | null;
  recruit_performers?: boolean | null;
  recruit_deadline?: string | null;
  presale_start?: string | null;
  general_sale_start?: string | null;
};

// 日時の前後関係（作成時は入力そのもの、編集時は既存の値と合わせて確認）
// 出演者募集（任意・いつからでも）→ 先行販売 → 一般販売 → 開演（販売終了）
export function checkEventTimeline(input: Record<string, unknown>) {
  const t = input as Timeline;
  const ms = (v?: string | null) => (v ? new Date(v).getTime() : null);
  const starts = ms(t.starts_at);
  const deadline = ms(t.recruit_deadline);
  const presale = ms(t.presale_start);
  const general = ms(t.general_sale_start);

  if (t.recruit_performers && deadline !== null && starts !== null && deadline > starts) {
    throw new HttpError(400, '出演者募集の締切は、開演日時より前にしてください');
  }
  if (presale !== null && general === null) {
    throw new HttpError(400, 'スポンサー先行販売を設定する場合は、一般販売の開始日時も入力してください');
  }
  if (presale !== null && general !== null && presale >= general) {
    throw new HttpError(400, 'スポンサー先行販売の開始は、一般販売の開始より前にしてください');
  }
  if (general !== null && starts !== null && general >= starts) {
    throw new HttpError(400, '一般販売の開始は、開演日時より前にしてください');
  }
  if (presale !== null && starts !== null && presale >= starts) {
    throw new HttpError(400, 'スポンサー先行販売の開始は、開演日時より前にしてください');
  }
}

export function parseCouponInput(body: Json, partial: boolean) {
  const out: Record<string, unknown> = {};

  const shop = str(body, 'shop_name', '店舗名', !partial, 60);
  if (shop !== undefined) out.shop_name = shop;

  const title = str(body, 'benefit_title', '特典タイトル', !partial, 60);
  if (title !== undefined) out.benefit_title = title;

  const detail = str(body, 'benefit_detail', '特典の詳細', !partial, 400);
  if (detail !== undefined) out.benefit_detail = detail;

  const published = bool(body, 'is_published');
  if (published !== undefined) out.is_published = published;

  if (body.review_status !== undefined) {
    const rs = String(body.review_status);
    if (['pending', 'approved', 'rejected'].indexOf(rs) === -1) throw new HttpError(400, '審査状態の値が不正です');
    out.review_status = rs;
    out.review_note = rs === 'rejected' ? str(body, 'review_note', '差し戻し理由', true, 400) : null;
  }

  if (Object.keys(out).length > 0) out.updated_at = new Date().toISOString();
  return out;
}

export function errorJson(err: unknown) {
  if (err instanceof HttpError) return { status: err.status, body: { error: err.message } };
  console.error('admin api error:', err);
  return { status: 500, body: { error: 'サーバーエラーが発生しました' } };
}
