import AdminShell from './AdminShell';

export const metadata = {
  title: 'まちきっぷ 管理画面｜外山企画',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
