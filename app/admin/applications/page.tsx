'use client';

import ApplicationsPanel from '../ApplicationsPanel';
import { useAdmin } from '../AdminShell';

export default function AdminApplicationsPage() {
  const { token } = useAdmin();
  return <ApplicationsPanel accessToken={token} />;
}
