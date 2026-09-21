import { Redirect } from 'expo-router';

import { DialpadScreen } from '@/features/callService/components/DialpadScreen';
import { useHasCallingExtension } from '@/features/callService/hooks/use-sip-config';
import { DIALER_ACCESS, useRequirePermission } from '@/lib/rbac';

export default function DialpadRoute() {
  const permission = useRequirePermission(DIALER_ACCESS);
  const hasExtension = useHasCallingExtension();
  if (permission === 'loading') {
    return null;
  }
  if (permission === 'denied' || !hasExtension) {
    return <Redirect href="/leads" />;
  }
  return <DialpadScreen />;
}
