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
    badgeClass: 'border-orange-500/40 bg-orange-500/15 text-orange-300',
  },
  store: {
    label: '店舗枠 (¥3,000)',
    badgeClass: 'border-teal-500/40 bg-teal-500/15 text-teal-300',
  },
  fan: {
    label: 'ファン枠 (¥300)',
    badgeClass: 'border-amber-400/40 bg-amber-400/15 text-amber-200',
  },
};


export default function AdminSponsorsPage() {
  const { token } = useAdmin();

  const [sponsors, setSponsors] = useState<AdminSponsor[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [forbiddenError, setForbiddenError] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">スポンサー＆収益</h1>
          <p className="text-xs text-zinc-400 mt-1">全 {sponsors.length} 件の申込レコード</p>
        </div>
        <button
          onClick={() => fetchAllSponsors()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          最新データを再取得
        </button>
      </div>

      {forbiddenError && (
        <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-sm text-red-300">{forbiddenError}</div>
      )}
      {loadingList && sponsors.length === 0 && <p className="text-sm text-zinc-400 mb-6">読み込み中...</p>}

            {toastMsg && (
              <div className="mb-6 rounded-xl border border-teal-500/40 bg-teal-500/10 p-3.5 text-xs font-bold text-teal-200 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-400" />
                {toastMsg}
              </div>
            )}

            {/* KPI サマリーカード */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="rounded-2xl border border-teal-500/30 bg-zinc-900 p-5">
                <div className="flex items-center justify-between text-xs text-teal-300 font-bold mb-2">
                  <span>月間見込み収益（有効契約）</span>
                  <TrendingUp className="h-4 w-4" />
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-white">
                  ¥{stats.monthlyRevenue.toLocaleString()}
                  <span className="text-xs font-normal text-zinc-400 ml-1">/ 月</span>
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="flex items-center justify-between text-xs text-zinc-400 font-bold mb-2">
                  <span>有効サポーター合計</span>
                  <Users className="h-4 w-4 text-teal-400" />
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-white">
                  {stats.activeTotal}
                  <span className="text-xs font-normal text-zinc-400 ml-1">組</span>
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="flex items-center justify-between text-xs text-orange-300 font-bold mb-2">
                  <span>企業 / 店舗（有効）</span>
                  <Building2 className="h-4 w-4 text-orange-400" />
                </div>
                <p className="text-xl sm:text-2xl font-extrabold text-white">
                  企業 {stats.corporateCount}社{' '}
                  <span className="text-zinc-600">/</span>{' '}
                  <span className="text-teal-300">店舗 {stats.storeCount}店</span>
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="flex items-center justify-between text-xs text-amber-300 font-bold mb-2">
                  <span>ファン枠（有効）</span>
                  <Heart className="h-4 w-4 text-amber-400" />
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-white">
                  {stats.fanCount}
                  <span className="text-xs font-normal text-zinc-400 ml-1">名</span>
                </p>
              </div>
            </div>

            {/* 検索・絞り込みバー */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 mb-6 flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="申込者名・掲載名・メール・業種・エリアで検索..."
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 pl-10 pr-4 py-2 text-sm text-white focus:border-teal-400 focus:outline-none"
                />
              </div>

              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value as any)}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-xs font-bold text-zinc-200 focus:border-teal-400 focus:outline-none"
              >
                <option value="all">すべてのプラン枠</option>
                <option value="corporate">企業プレミアム枠 (¥10,000)</option>
                <option value="store">店舗ローカル枠 (¥3,000)</option>
                <option value="fan">ファンサポーター枠 (¥300)</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-xs font-bold text-zinc-200 focus:border-teal-400 focus:outline-none"
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
              <p className="text-sm text-zinc-400">スポンサー一覧を読み込み中...</p>
            ) : filteredSponsors.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center text-sm text-zinc-400">
                条件に一致するスポンサーデータはありません。
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSponsors.map((s) => {
                  const meta = TIER_META[s.tier] || {
                    label: s.tier,
                    badgeClass: 'border-zinc-700 bg-zinc-800 text-zinc-200',
                  };
                  const asset = s.sponsor_assets?.[0];

                  return (
                    <div
                      key={s.id}
                      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${meta.badgeClass}`}
                          >
                            {meta.label}
                          </span>
                          <span className="text-base font-extrabold text-white">
                            {s.display_name}
                          </span>
                          <span className="text-xs text-zinc-400">
                            （申込者：{s.applicant_name}）
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                          <span>メール：{s.email}</span>
                          <span>決済：{s.payment_method === 'invoice' ? '請求書払い' : 'カード'}</span>
                          <span>
                            登録日：{new Date(s.created_at).toLocaleDateString('ja-JP')}
                          </span>
                        </div>

                        {(asset?.industry || asset?.address) && (
                          <div className="flex flex-wrap gap-3 text-xs text-teal-300/90 pt-0.5">
                            {asset?.industry && <span>業種：{asset.industry}</span>}
                            {asset?.address && <span>エリア：{asset.address}</span>}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 shrink-0">
                        <button
                          onClick={() => handleTogglePublic(s)}
                          disabled={updatingId === s.id}
                          className={`rounded-xl border px-3 py-2 text-xs font-bold transition cursor-pointer ${
                            s.is_public
                              ? 'border-teal-500/40 bg-teal-500/10 text-teal-300'
                              : 'border-zinc-700 bg-zinc-950 text-zinc-400'
                          }`}
                        >
                          {s.is_public ? '公開中' : '非公開'}
                        </button>

                        <select
                          value={s.status}
                          disabled={updatingId === s.id}
                          onChange={(e) => handleStatusChange(s.id, e.target.value)}
                          className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-bold text-white focus:border-teal-400 focus:outline-none cursor-pointer"
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
