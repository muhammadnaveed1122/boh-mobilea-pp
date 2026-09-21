import { Redirect, useLocalSearchParams } from 'expo-router';
import { CallDetailScreen } from '@/features/callMonitoring/components/detail/CallDetailScreen';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';

export default function CallDetailRoute() {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const state = useRequirePermission(PERMISSIONS.CALLS_READ);
  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/calls" />;
  return <CallDetailScreen uuid={uuid} />;
}
