import { Redirect, useLocalSearchParams } from 'expo-router';

import { LeadDetailScreen } from '@/features/leads/components/LeadDetailScreen';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';

export default function LeadDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useRequirePermission([PERMISSIONS.LEADS_READ, PERMISSIONS.LEADS_READ_ALL]);

  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/leads" />;

  return <LeadDetailScreen id={id} />;
}
