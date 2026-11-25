'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// /admin はスポンサータブへ（ログインリンクの #access_token は引き継ぐ）
export default function AdminIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/admin/sponsors${window.location.hash}`);
  }, [router]);
  return <p className="py-20 text-center text-ink-2">移動しています…</p>;
}
