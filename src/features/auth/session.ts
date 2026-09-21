import { logoutUser } from '@/features/auth/services';
import { unregisterCallDeviceToken } from '@/features/callService/services/callService.api';
import { setBadgeCount } from '@/lib/push-notifications';
import { disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth.store';

/**
 * Clear local session state only — disconnect the socket, reset the badge, and
 * clear auth. Makes NO authed network calls, so it's safe to use when the server
 * session is already gone (e.g. right after self-service account deletion, where
 * an authed call would 401 and surface a spurious "Session expired" toast).
 */
export function clearLocalSession(): void {
  disconnectSocket();
  void setBadgeCount(0);
  useAuthStore.getState().clearAuth();
}

/**
 * Tear down the current session: drop this device's call-wake token
 * (while the bearer is still valid), invalidate the server session, then clear
 * local state. Navigation is left to the caller (the (app) auth gate also
 * redirects once isAuthenticated flips false).
 *
 * Use for Sign Out, where the session is still valid. For account deletion the
 * server already killed the session — use clearLocalSession() instead.
 */
export async function performSessionTeardown(): Promise<void> {
  const { tokens } = useAuthStore.getState();

  // NOTE: we intentionally do NOT delete the Expo push token here. After
  // clearLocalSession() flips auth off, PushTokenRegistrar re-registers the
  // token with no bearer, so the backend sets its owner to null — the device
  // keeps a row (severing this user's binding) instead of vanishing.

  // Drop the call-wake token (FCM/PushKit) so inbound calls stop ringing this device.
  try {
    await unregisterCallDeviceToken();
  } catch {
    // non-fatal
  }
  try {
    await logoutUser(tokens?.refreshToken);
  } catch {
    // Best-effort: clear local session even if the server call fails.
  } finally {
    clearLocalSession();
  }
}
