import { Redirect } from 'expo-router';
import { CallMonitoringScreen } from '@/features/callMonitoring/components/CallMonitoringScreen';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';

export default function CallsRoute() {
  const state = useRequirePermission(PERMISSIONS.CALLS_READ);
  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/" />;
  return <CallMonitoringScreen />;
}
