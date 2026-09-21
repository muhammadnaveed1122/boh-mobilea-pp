import { Redirect } from 'expo-router';
import { LeadsDashboardScreen } from '@/features/leads/components/dashboard/LeadsDashboardScreen';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';

export default function LeadsRoute() {
  const state = useRequirePermission([PERMISSIONS.LEADS_READ, PERMISSIONS.LEADS_READ_ALL]);
  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/" />;
  return <LeadsDashboardScreen />;
}
