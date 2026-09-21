import { Redirect } from 'expo-router';
import { CreateLeadScreen } from '@/features/leads/components/CreateLeadScreen';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';

export default function CreateLeadRoute() {
  const state = useRequirePermission(PERMISSIONS.LEADS_CREATE);
  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/" />;
  return <CreateLeadScreen />;
}
