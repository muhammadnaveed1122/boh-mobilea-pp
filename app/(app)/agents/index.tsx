import { Redirect } from 'expo-router';

import { AgentsScreen } from '@/features/agents/components/AgentsScreen';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';

/**
 * `USERS_READ` gates access — not a super-admin check. `hasAllAccess`
 * short-circuits every RBAC selector, so super-admins pass automatically
 * (see RBAC.md). Deep-linked to from the dashboard's Online/Offline Agents
 * tiles via `/agents?tab=online|offline`.
 */
export default function AgentsRoute() {
  const state = useRequirePermission([PERMISSIONS.USERS_READ]);

  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/" />;

  return <AgentsScreen />;
}
