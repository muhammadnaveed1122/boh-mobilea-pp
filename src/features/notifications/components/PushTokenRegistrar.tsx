// Non-visual. Drives push-token registration. Mounted from app/_layout.tsx ONLY
// after auth hydration resolves, so registration never runs during the
// indeterminate loading window (which would briefly null a logged-in user's
// token). Owns the in-app-pref + fresh-grant glue and delegates the lifecycle
// to usePushTokenRegistration.

import { useRef } from 'react';

import { useAuthStore } from '@/store/auth.store';

import { usePushTokenRegistration } from '../hooks/use-register-push-token';
import { updateNotificationPrefs } from '../services';

export function PushTokenRegistrar(): null {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);

  const pushPref = user?.pushNotificationsEnabled ?? true;
  const pushEnabledRef = useRef(pushPref);
  pushEnabledRef.current = pushPref;

  // Allowing the OS prompt is itself consent: flip the in-app pref on (unless
  // the user already turned it off deliberately), so push works without a
  // second toggle in Settings.
  const onFreshGrant = (): void => {
    if (pushEnabledRef.current) return;
    updateNotificationPrefs({ pushNotificationsEnabled: true })
      .then(() => refreshProfile())
      .catch(() => {});
  };

  usePushTokenRegistration(isAuthenticated, pushPref, onFreshGrant);
  return null;
}
