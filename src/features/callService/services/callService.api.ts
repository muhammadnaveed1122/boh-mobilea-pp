/**
 * Speed-to-lead call routing — port of web
 * `boh-lead-magnet/src/features/speed-to-lead/lead-call/api/leadCallApi.ts`.
 *
 * Used when FreeSWITCH bridges an inbound lead call (number `0000000000`,
 * leadId carried as the SIP display name) and the agent presses DTMF 1/2.
 * The shared axios `apiClient` base URL has no `/api/v1` prefix, so it is
 * added here (backend routes are `/api/v1/call-service/*`).
 */

import { apiClient } from '@/lib/api';

import { getDeviceId } from './device-id';

export async function connectLead(leadId: string, agentExtension: string): Promise<void> {
  await apiClient.post(`/api/v1/call-service/leads/${leadId}/connect`, { agentExtension });
}

export async function skipLead(leadId: string, agentExtension: string): Promise<void> {
  await apiClient.post(`/api/v1/call-service/leads/${leadId}/skip`, { agentExtension });
}

/**
 * Register this device's raw push token for high-priority VoIP wake pushes.
 *
 * Distinct from the regular notifications device-token endpoint: calling cannot
 * use Expo Push (no data-only high-priority delivery). Each platform uses its own
 * channel, so backend stores the token under a per-platform `kind` and sends
 * incoming-call wakes directly:
 *  - android → `kind: 'fcm'`  (firebase-admin data-only high-priority message)
 *  - ios     → `kind: 'voip'` (APNs HTTP/2 PushKit, topic `<bundle>.voip`)
 * Backend endpoint does not exist yet — see calling-backend-voip-push.md.
 */
let lastRegisteredCallToken: string | null = null;

export async function registerCallDeviceToken(
  token: string,
  platform: 'android' | 'ios',
): Promise<void> {
  const kind = platform === 'ios' ? 'voip' : 'fcm';
  const deviceId = await getDeviceId();
  await apiClient.post('/api/v1/call-service/device-tokens', { platform, kind, token, deviceId });
  lastRegisteredCallToken = token;
}

/**
 * Remove this device's call-wake token(s) on sign-out so an inbound call no longer
 * wakes it (important on shared devices: upsert is per `(userId, deviceId, kind)`,
 * so the previous user's row would otherwise linger and ring this handset).
 *
 * Always sends `deviceId` — the token alone is NOT enough: it is only in memory
 * if this app process completed a registration, which does not happen when the
 * POST failed (offline), when iOS PushKit's `register` event never fired, or when
 * the user signs out before the token arrives. In those cases the server row
 * survived sign-out and kept ringing the handset for the previous user. deviceId
 * is persisted at install, so it is always known and clears every kind
 * (voip + fcm) for this device.
 *
 * MUST be awaited before `clearAuth` nulls the bearer — the endpoint is auth'd.
 * Best-effort: callers swallow.
 */
export async function unregisterCallDeviceToken(): Promise<void> {
  const token = lastRegisteredCallToken;
  lastRegisteredCallToken = null;
  const deviceId = await getDeviceId();
  await apiClient.delete('/api/v1/call-service/device-tokens', {
    data: token ? { deviceId, token } : { deviceId },
  });
}
