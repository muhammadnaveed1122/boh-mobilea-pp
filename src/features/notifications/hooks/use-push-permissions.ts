import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus, Linking } from 'react-native';

import {
  getPushPermission,
  type PushPermissionStatus,
  requestPushPermission,
} from '@/lib/push-notifications';

/**
 * OS push permission state + actions. `request` prompts (or returns the
 * current decision); `openSettings` deep-links to OS settings for the
 * denied/blocked recovery path (mirrors web's permission-denied handling).
 * Re-reads permission on app foreground so toggles reflect changes made in
 * the OS settings screen.
 */
export function usePushPermissions() {
  const [status, setStatus] = useState<PushPermissionStatus>('undetermined');

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setStatus(await getPushPermission());
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const request = useCallback(async (): Promise<PushPermissionStatus> => {
    const next = await requestPushPermission();
    setStatus(next);
    return next;
  }, []);

  const openSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);

  return { status, request, openSettings, refresh };
}
