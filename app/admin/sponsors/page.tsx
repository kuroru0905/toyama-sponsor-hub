'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  TrendingUp,
  Users,
  Building2,
  Store,
  Heart,
  Search,
  RefreshCw,
} from 'lucide-react';
import { useAdmin } from '../AdminShell';


type TierType = 'corporate' | 'store' | 'fan';

interface SponsorAsset {
  industry?: string | null;
  address?: string | null;
  contact_note?: string | null;
}

interface AdminSponsor {
  id: string;
  tier: TierType;
  applicant_name: string;
  display_name: string;
  is_public: boolean;
  email: string;
  payment_method: string;
  status: 'active' | 'pending' | 'past_due' | 'canceled' | string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  banner_name?: string | null;
  logo_url?: string | null;
  sponsor_assets?: SponsorAsset[];
}

const TIER_PRICE: Record<TierType, number> = {
  corporate: 10000,
  store: 3000,
  fan: 300,
};

const TIER_META: Record<TierType, { label: string; badgeClass: string }> = {
  corporate: {
    label: '企業枠 (¥10,000)',
    badgeClass: 'border-warn-line bg-warn-soft text-warn',
  },
  store: {
    label: '店舗枠 (¥3,000)',
    badgeClass: 'border-brand-line bg-brand-soft text-brand',
  },
  fan: {
    label: 'ファン枠 (¥300)',
    badgeClass: 'border-warn-line bg-warn-soft text-warn',
  },
};


export default function AdminSponsorsPage() {
  const { token } = useAdmin();

  const [sponsors, setSponsors] = useState<AdminSponsor[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [forbiddenError, setForbiddenError] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; target: 'logo' | 'name' } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [tierFilter, setTierFilter] = useState<'all' | TierType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'past_due' | 'canceled'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchAllSponsors = async () => {
    setLoadingList(true);
    setForbiddenError('');
    try {
      const res = await fetch('/api/admin', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.status === 403 || res.status === 401) {
        setForbiddenError(data.error || '管理者権限がありません');
        setSponsors([]);
        return;
      }
      if (res.ok && data.sponsors) {
        setSponsors(data.sponsors);
      }
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchAllSponsors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleStatusChange = async (sponsorId: string, newStatus: string) => {
    if (!token) return;
    setUpdatingId(sponsorId);
    setToastMsg('');

    try {
      const res = await fetch('/api/admin', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sponsorId, status: newStatus }),
      });

      if (res.ok) {
        setSponsors((prev) =>
          prev.map((s) => (s.id === sponsorId ? { ...s, status: newStatus } : s))
        );
        setToastMsg('契約ステータスを更新しました！');
      } else {
        const d = await res.json();
        alert(d.error || '更新に失敗しました');
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const handleTogglePublic = async (sponsor: AdminSponsor) => {
    if (!token) return;
    setUpdatingId(sponsor.id);
    setToastMsg('');

    try {
      const nextPublic = !sponsor.is_public;
      const res = await fetch('/api/admin', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sponsorId: sponsor.id, isPublic: nextPublic }),
      });

      if (res.ok) {
        setSponsors((prev) =>
          prev.map((s) => (s.id === sponsor.id ? { ...s, is_public: nextPublic } : s))
        );
        setToastMsg('公開フラグを更新しました！');
      }
    } finally {
      setUpdatingId(null);
    }
  };

  // 上部の横スクロールに出るロゴ・掲示名を外す
  const handleRemoveBanner = async (sponsorId: string, target: 'logo' | 'name') => {
    if (!token) return;
    setUpdatingId(sponsorId);
    setToastMsg('');
    setErrorMsg('');
    try {
      const res = await fetch(`/api/admin/sponsors/${sponsorId}/banner?target=${target}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSponsors((prev) =>
          prev.map((s) => (s.id === sponsorId ? (target === 'logo' ? { ...s, logo_url: null } : { ...s, banner_name: null }) : s))
        );
        setToastMsg(target === 'logo' ? 'ロゴを外しました。1分ほどで掲示が名前に変わります。' : '掲示名を掲載名に戻しました。');
      } else {
        const d = await res.json().catch(() => ({}));
        setErrorMsg(d.error || '外せませんでした');
      }
    } finally {
      setUpdatingId(null);
      setConfirmRemove(null);
    }
  };

  const stats = useMemo(() => {
    const activeList = sponsors.filter((s) => s.status === 'active');
    const monthlyRevenue = activeList.reduce(
      (sum, s) => sum + (TIER_PRICE[s.tier] || 0),
      0
    );
    const corporateCount = activeList.filter((s) => s.tier === 'corporate').length;
    const storeCount = activeList.filter((s) => s.tier === 'store').length;
    const fanCount = activeList.filter((s) => s.tier === 'fan').length;

    return {
      monthlyRevenue,
      activeTotal: activeList.length,
      corporateCount,
      storeCount,
      fanCount,
    };
  }, [sponsors]);

  const filteredSponsors = useMemo(() => {
    return sponsors.filter((s) => {
      if (tierFilter !== 'all' && s.tier !== tierFilter) return false;
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const asset = s.sponsor_assets?.[0];
        const hit =
          s.applicant_name.toLowerCase().includes(q) ||
          s.display_name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          (asset?.industry || '').toLowerCase().includes(q) ||
          (asset?.address || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [sponsors, tierFilter, statusFilter, searchQuery]);


  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-ink">スポンサー＆収益</h1>
          <p className="text-sm text-ink-2 mt-1">全 {sponsors.length} 件の申込レコード</p>
        </div>
        <button
          onClick={() => fetchAllSponsors()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink hover:bg-surface cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          最新データを再取得
        </button>
      </div>

      {errorMsg && (
        <div role="alert" className="mb-6 rounded-ctl border border-danger-line bg-danger-soft p-3.5 text-sm text-danger">{errorMsg}</div>
      )}
      {forbiddenError && (
        <div className="mb-6 rounded-ctl border border-danger-line bg-danger-soft p-3.5 text-sm text-danger">{forbiddenError}</div>
      )}
      {loadingList && sponsors.length === 0 && <p className="text-sm text-ink-2 mb-6">読み込み中...</p>}

            {toastMsg && (
              <div className="mb-6 rounded-ctl border border-brand-line bg-brand-soft p-3.5 text-sm font-semibold text-brand flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-brand" />
                {toastMsg}
              </div>
            )}

            {/* KPI サマリーカード */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="rounded-panel bg-paper shadow-card p-5">
                <div className="flex items-center justify-between text-sm text-brand font-semibold mb-2">
                  <span>月間見込み収益（有効契約）</span>
                  <TrendingUp className="h-4 w-4" />
                </div>
                <p className="text-2xl sm:text-3xl font-semibold text-ink">
                  ¥{stats.monthlyRevenue.toLocaleString()}
                  <span className="text-sm font-normal text-ink-2 ml-1">/ 月</span>
                </p>
              </div>

              <div className="rounded-panel bg-paper shadow-card p-5">
                <div className="flex items-center justify-between text-sm text-ink-2 font-semibold mb-2">
                  <span>有効サポーター合計</span>
                  <Users className="h-4 w-4 text-brand" />
                </div>
                <p className="text-2xl sm:text-3xl font-semibold text-ink">
                  {stats.activeTotal}
                  <span className="text-sm font-normal text-ink-2 ml-1">組</span>
                </p>
              </div>

              <div className="rounded-panel bg-paper shadow-card p-5">
                <div className="flex items-center justify-between text-sm text-warn font-semibold mb-2">
                  <span>企業 / 店舗（有効）</span>
                  <Building2 className="h-4 w-4 text-warn" />
                </div>
                <p className="text-xl sm:text-2xl font-semibold text-ink">
                  企業 {stats.corporateCount}社{' '}
                  <span className="text-ink-3">/</span>{' '}
                  <span className="text-brand">店舗 {stats.storeCount}店</span>
                </p>
              </div>

              <div className="rounded-panel bg-paper shadow-card p-5">
                <div className="flex items-center justify-between text-sm text-warn font-semibold mb-2">
                  <span>ファン枠（有効）</span>
                  <Heart className="h-4 w-4 text-warn" />
                </div>
                <p className="text-2xl sm:text-3xl font-semibold text-ink">
                  {stats.fanCount}
                  <span className="text-sm font-normal text-ink-2 ml-1">名</span>
                </p>
              </div>
            </div>

            {/* 検索・絞り込みバー */}
            <div className="rounded-panel border border-line bg-surface p-4 mb-6 flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-ink-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="申込者名・掲載名・メール・業種・エリアで検索..."
                  className="w-full rounded-ctl border border-line-strong bg-paper pl-10 pr-4 py-2 text-sm text-ink focus:border-brand focus:outline-none"
                />
              </div>

              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value as any)}
                className="rounded-ctl border border-line-strong bg-paper px-3.5 py-2 text-sm font-semibold text-ink focus:border-brand focus:outline-none"
              >
                <option value="all">すべてのプラン枠</option>
                <option value="corporate">企業プレミアム枠 (¥10,000)</option>
                <option value="store">店舗ローカル枠 (¥3,000)</option>
                <option value="fan">ファンサポーター枠 (¥300)</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="rounded-ctl border border-line-strong bg-paper px-3.5 py-2 text-sm font-semibold text-ink focus:border-brand focus:outline-none"
              >
                <option value="all">すべてのステータス</option>
                <option value="active">active（契約中）</option>
                <option value="pending">pending（決済待ち）</option>
                <option value="past_due">past_due（支払確認中）</option>
                <option value="canceled">canceled（解約済み）</option>
              </select>
            </div>

            {/* 申込者・契約一覧テーブル */}
            {loadingList ? (
              <p className="text-sm text-ink-2">スポンサー一覧を読み込み中...</p>
            ) : filteredSponsors.length === 0 ? (
              <div className="rounded-panel bg-paper shadow-card p-10 text-center text-sm text-ink-2">
                条件に一致するスポンサーデータはありません。
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSponsors.map((s) => {
                  const meta = TIER_META[s.tier] || {
                    label: s.tier,
                    badgeClass: 'border-line-strong bg-surface text-ink',
                  };
                  const asset = s.sponsor_assets?.[0];

                  return (
                    <div
                      key={s.id}
                      className="rounded-panel bg-paper shadow-card p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.badgeClass}`}
                          >
                            {meta.label}
                          </span>
                          <span className="text-base font-semibold text-ink">
                            {s.display_name}
                          </span>
                          <span className="text-sm text-ink-2">
                            （申込者：{s.applicant_name}）
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
                          <span>メール：{s.email}</span>
                          <span>決済：{s.payment_method === 'invoice' ? '請求書払い' : 'カード'}</span>
                          <span>
                            登録日：{new Date(s.created_at).toLocaleDateString('ja-JP')}
                          </span>
                        </div>

                        {/* 上部の横スクロールに出る内容 */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-sm">
                          <span className="text-ink-2">掲示：</span>
                          {s.tier !== 'fan' && s.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.logo_url} alt={`${s.display_name}のロゴ`} className="h-7 w-auto max-w-[140px] rounded border border-line bg-paper object-contain p-0.5" />
                          ) : (
                            <span className="font-semibold text-ink">{s.banner_name || s.display_name}</span>
                          )}
                          {s.tier !== 'fan' && s.logo_url && (
                            <BannerRemove
                              label="ロゴを外す"
                              confirmText="ロゴを消して名前の掲示にします"
                              open={confirmRemove?.id === s.id && confirmRemove.target === 'logo'}
                              busy={updatingId === s.id}
                              onOpen={() => setConfirmRemove({ id: s.id, target: 'logo' })}
                              onCancel={() => setConfirmRemove(null)}
                              onConfirm={() => handleRemoveBanner(s.id, 'logo')}
                            />
                          )}
                          {s.banner_name && (
                            <BannerRemove
                              label="掲示名を戻す"
                              confirmText={`掲載名（${s.display_name}）に戻します`}
                              open={confirmRemove?.id === s.id && confirmRemove.target === 'name'}
                              busy={updatingId === s.id}
                              onOpen={() => setConfirmRemove({ id: s.id, target: 'name' })}
                              onCancel={() => setConfirmRemove(null)}
                              onConfirm={() => handleRemoveBanner(s.id, 'name')}
                            />
                          )}
                        </div>

                        {(asset?.industry || asset?.address) && (
                          <div className="flex flex-wrap gap-3 text-sm text-brand pt-0.5">
                            {asset?.industry && <span>業種：{asset.industry}</span>}
                            {asset?.address && <span>エリア：{asset.address}</span>}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 shrink-0">
                        <button
                          onClick={() => handleTogglePublic(s)}
                          disabled={updatingId === s.id}
                          className={`rounded-ctl border px-3 py-2 text-sm font-semibold transition cursor-pointer ${
                            s.is_public
                              ? 'border-brand-line bg-brand-soft text-brand'
                              : 'border-line-strong bg-paper text-ink-2'
                          }`}
                        >
                          {s.is_public ? '公開中' : '非公開'}
                        </button>

                        <select
                          value={s.status}
                          disabled={updatingId === s.id}
                          onChange={(e) => handleStatusChange(s.id, e.target.value)}
                          className="rounded-ctl border border-line-strong bg-paper px-3 py-2 text-sm font-semibold text-ink focus:border-brand focus:outline-none cursor-pointer"
                        >
                          <option value="active">active（有効）</option>
                          <option value="pending">pending（決済待ち）</option>
                          <option value="past_due">past_due（支払確認中）</option>
                          <option value="canceled">canceled（解約済み）</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
    </div>
  );
}

// 外すボタン（押すと、その場で確認を出す）
function BannerRemove({
  label,
  confirmText,
  open,
  busy,
  onOpen,
  onCancel,
  onConfirm,
}: {
  label: string;
  confirmText: string;
  open: boolean;
  busy: boolean;
  onOpen: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        disabled={busy}
        className="rounded-full border border-danger-line bg-paper px-3 py-1 text-xs font-semibold text-danger hover:bg-danger-soft cursor-pointer"
      >
        {label}
      </button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2 rounded-ctl border border-danger-line bg-danger-soft px-2.5 py-1 text-xs text-ink">
      {confirmText}。よろしいですか？
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy}
        className="rounded-full bg-danger px-3 py-1 font-semibold text-white cursor-pointer"
      >
        {busy ? '処理中…' : label}
      </button>
      <button type="button" onClick={onCancel} className="rounded-full px-2 py-1 font-semibold text-ink-2 hover:underline cursor-pointer">
        やめる
      </button>
    </span>
  );
}
