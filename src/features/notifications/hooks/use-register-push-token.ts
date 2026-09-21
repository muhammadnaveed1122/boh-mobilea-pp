import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { getDeviceId } from '@/features/callService/services/device-id';
import {
  addTokenRotationListener,
  getDevicePlatform,
  getExpoPushToken,
  getPushPermission,
  requestPushPermission,
} from '@/lib/push-notifications';

import { deleteDeviceToken, registerDeviceToken } from '../services';

/**
 * Registers this device's Expo push token with the backend on every app launch
 * and every foreground — including when logged out. A logged-out registration
 * sends NO bearer, so the backend sets the token's owner to null, severing a
 * stale `token → user` binding left by an uninstall-without-logout (iOS keeps
 * the same token across reinstall, so it never triggers DeviceNotRegistered).
 *
 * Ownership is decided server-side by bearer presence (the axios client attaches
 * it only when authenticated) — this hook never sends a userId.
 *
 * Permission policy:
 *   - Logged in: prompt only from an askable state; a fresh grant fires
 *     `onFreshGrant` (flips the in-app pref on).
 *   - Logged out: never prompt. Register only if permission is ALREADY granted
 *     (which is exactly the reinstall case where stale pushes still arrive).
 *
 * In-app pref OFF (logged in only): delete the token so the server stops
 * sending, keeping "what you receive" in sync with the toggle.
 *
 * MUST be mounted from a component that renders only after auth hydration
 * resolves, so it never registers during the indeterminate loading window.
 */
export function usePushTokenRegistration(
  isAuthenticated: boolean,
  pushEnabled: boolean,
  onFreshGrant?: () => void,
): void {
  const onFreshGrantRef = useRef(onFreshGrant);
  onFreshGrantRef.current = onFreshGrant;

  // Last token the rotation listener delivered. Used to ignore the events that
  // getExpoPushTokenAsync itself fires: on iOS every call re-registers with
  // APNs and re-emits the token event even when the token is unchanged, so an
  // unguarded listener → sync() → getExpoPushTokenAsync → event → sync() loop
  // floods the backend with identical registrations. NOTE: the listener carries
  // the NATIVE device token (APNs hex), not the ExponentPushToken — so the
  // dedupe must compare against the listener's own previous payload, never
  // against the Expo token sync() registers.
  const lastRotationTokenRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Collapse concurrent triggers (mount + rotation + foreground can race);
    // one queued re-run picks up anything that arrived mid-flight.
    let inFlight = false;
    let rerunQueued = false;

    const sync = async (): Promise<void> => {
      // Resolve OS permission. Prompt ONLY when logged in and still askable;
      // never nag a logged-out user, never re-show once granted/blocked.
      const before = await getPushPermission();
      let permission = before;
      if (isAuthenticated && before !== 'granted') {
        permission = await requestPushPermission();
        if (permission === 'granted') {
          onFreshGrantRef.current?.();
        }
      }
      if (permission !== 'granted') return;

      const platform = getDevicePlatform();
      if (!platform) return;
      const token = await getExpoPushToken();
      if (!token || cancelled) return;

      // Logged in + in-app pref OFF → unregister this token.
      if (isAuthenticated && !pushEnabled) {
        try {
          await deleteDeviceToken(token);
        } catch {
          // non-fatal
        }
        return;
      }

      // Register. Bearer present (authed) → owner = user; absent (logged out)
      // → owner = null. Always bumps lastSeenAt server-side.
      const deviceId = await getDeviceId();
      if (cancelled) return;
      try {
        await registerDeviceToken(token, platform, deviceId);
      } catch {
        // non-fatal — retried on next foreground / rotation
      }
    };

    const syncAndRelease = async (): Promise<void> => {
      try {
        await sync();
      } finally {
        inFlight = false;
        if (rerunQueued && !cancelled) {
          rerunQueued = false;
          runSync();
        }
      }
    };

    const runSync = (): void => {
      if (inFlight) {
        rerunQueued = true;
        return;
      }
      inFlight = true;
      void syncAndRelease();
    };

    runSync();

    // Re-register on genuine token rotation only — an event repeating the
    // previous payload is the echo of our own getExpoPushTokenAsync call (see
    // lastRotationTokenRef above), not a rotation.
    const rotation = addTokenRotationListener((token) => {
      if (token === lastRotationTokenRef.current) return;
      lastRotationTokenRef.current = token;
      runSync();
    });

    // Re-register on every background→active transition (refreshes lastSeenAt
    // and re-asserts ownership after the app was suspended / reinstalled).
    let prevState = AppState.currentState;
    const appSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = prevState;
      prevState = next;
      if (/inactive|background/.exec(prev) !== null && next === 'active') {
        runSync();
      }
    });

    return () => {
      cancelled = true;
      rotation.remove();
      appSub.remove();
    };
  }, [isAuthenticated, pushEnabled]);
}
