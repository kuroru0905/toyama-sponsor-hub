'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// /admin はスポンサータブへ（ログインリンクの #access_token は引き継ぐ）
export default function AdminIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/admin/sponsors${window.location.hash}`);
  }, [router]);
  return <p className="text-center text-zinc-400 py-20">移動中...</p>;
}
