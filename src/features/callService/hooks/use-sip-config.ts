/**
 * useSipConfig — thin hook wrapping the pure `sip-config` service with the
 * auth store. Mirrors web `useSipConfig` (memoized on the user object).
 */

import { useMemo } from 'react';

import { useAuthStore } from '@/store/auth.store';

import type { SipConfig } from '../models';
import { getSipConfigForUser, hasCallingExtensionForUser } from '../services/sip-config';

export function useSipConfig(): SipConfig | null {
  const user = useAuthStore((s) => s.user);
  return useMemo(() => getSipConfigForUser(user), [user]);
}

/** Whether the current user can place calls (has a usable calling extension). */
export function useHasCallingExtension(): boolean {
  const user = useAuthStore((s) => s.user);
  return useMemo(() => hasCallingExtensionForUser(user), [user]);
}
