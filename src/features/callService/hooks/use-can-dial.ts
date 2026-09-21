import { DIALER_ACCESS, useCan } from '@/lib/rbac';

import { useHasCallingExtension } from './use-sip-config';

/**
 * Whether the dialer should be offered to this user: the RBAC gate (mirror of
 * web `CallServiceManager.canCall`) AND a SIP extension to actually place the
 * call with. Both conditions are needed — a permitted user with no extension
 * can't dial.
 */
export function useCanDial(): boolean {
  const permitted = useCan(DIALER_ACCESS);
  const hasExtension = useHasCallingExtension();
  return permitted && hasExtension;
}
