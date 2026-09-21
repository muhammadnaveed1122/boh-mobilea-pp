import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { registerCallDeviceToken } from '../services/callService.api';

/**
 * Subscribe the Android FCM token: register now + on rotation. Returns a cleanup
 * that detaches the rotation listener. Lazy-requires the native module (RNFB is
 * Android-only, excluded from iOS autolinking).
 */
function setupAndroidFcmToken(onToken: (token: string) => void): () => void {
  let unsubscribe: (() => void) | undefined;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getMessaging, getToken, onTokenRefresh } = require('@react-native-firebase/messaging');
  const messaging = getMessaging();
  void (async () => {
    try {
      const token = await getToken(messaging);
      if (token) onToken(token);
    } catch {
      // FCM unavailable (e.g. no Play Services / emulator) — skip silently
    }
    unsubscribe = onTokenRefresh(messaging, (t: string) => onToken(t));
  })();
  return () => unsubscribe?.();
}

/**
 * Subscribe the iOS PushKit VoIP token: register on the `register` event +
 * kick registration. Returns a cleanup that detaches the listener. Lazy-requires
 * the native module (iOS-only).
 */
function setupIosVoipToken(onToken: (token: string) => void): () => void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const VoipPushNotification = require('react-native-voip-push-notification').default;
  VoipPushNotification.addEventListener('register', (token: string) => onToken(token));
  VoipPushNotification.registerVoipToken();
  return () => VoipPushNotification.removeEventListener('register');
}

/**
 * Registers this device's raw call-wake push token with the calling backend so
 * it can send high-priority incoming-call pushes, and re-registers on rotation.
 *
 * Per-platform channel (calling needs data-only / VoIP delivery, which Expo Push
 * can't do — see `registerCallDeviceToken`):
 *  - android → FCM token (`@react-native-firebase/messaging`)
 *  - ios     → PushKit VoIP token (`react-native-voip-push-notification`)
 *
 * Dedupes on the last-registered token. Failures are swallowed so the rest of
 * calling is unaffected.
 *
 * @param enabled typically isAuthenticated (and SIP credentials present)
 */
export function useRegisterCallToken(enabled: boolean): void {
  const lastToken = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Reset the dedupe on each auth-on transition so EVERY successful login
    // re-POSTs the device-token. The push token rarely rotates, so without this
    // a second login in the same app session (logout→login / shared device)
    // would short-circuit on the persisted ref and never register the new
    // session's token. Backend upsert is idempotent — re-registering is safe.
    lastToken.current = null;

    const register = async (token: string, platform: 'android' | 'ios'): Promise<void> => {
      if (token === lastToken.current) return;
      lastToken.current = token;
      try {
        await registerCallDeviceToken(token, platform);
      } catch {
        lastToken.current = null; // allow retry on next trigger
      }
    };

    if (Platform.OS === 'android') {
      return setupAndroidFcmToken((t) => void register(t, 'android'));
    }
    if (Platform.OS === 'ios') {
      return setupIosVoipToken((t) => void register(t, 'ios'));
    }
    return undefined;
  }, [enabled]);
}
