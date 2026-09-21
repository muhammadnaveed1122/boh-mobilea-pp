/**
 * iOS PushKit VoIP wake — the iOS analogue of `fcm-call-messaging.ts`.
 *
 * iOS cannot use FCM (Firebase is stripped from the iOS build — RN 0.81 +
 * `use_frameworks: static` conflict), so incoming-call wakes arrive as raw APNs
 * PushKit pushes via `react-native-voip-push-notification`.
 *
 * Division of labour:
 *  - The NATIVE PushKit handler (injected by `plugins/withIosVoip.js`) reports
 *    the call to CallKit synchronously in `didReceiveIncomingPushWith` — Apple
 *    REQUIRES this before the push completion handler returns, or the OS
 *    terminates and eventually blacklists the app from VoIP push. That native
 *    report is what rings the CallKit UI on cold start.
 *  - This JS module handles the SAME push once the JS bundle is running, to
 *    drive the SIP/coordinator side: it (idempotently) re-displays the CallKeep
 *    call (callkeep dedupes by UUID) so `isCallKeepDriven()` is true and the
 *    brain (`useCallService`) suppresses its JS modal + reports the connection.
 *
 * The VoIP TOKEN registration (the `register` event) is owned by the auth-gated
 * hook `use-register-call-token.ts`, NOT this module — this module only owns the
 * wake listeners. Must be registered at module-evaluation time (see
 * `app/_layout.tsx`) so the listeners exist before any push is delivered.
 *
 * Payload shape (mirrors Android FCM), sent by the backend over APNs VoIP:
 *   { type: 'voip_incoming', uuid, caller_name, call_handle }
 */

import { Platform } from 'react-native';

import { cancelCallKeepIncoming, displayCallKeepIncoming } from './callkeep';
import { newCallUuid } from './callkeep-coordinator';

import { dlog } from '@/lib/debug-log';

/** Minimal shape of the VoIP push payload we read (extra keys ignored). */
interface VoipPushPayload {
  type?: string;
  uuid?: string;
  caller_name?: string;
  call_handle?: string;
}

/** A `didLoadWithEvents` entry as delivered by react-native-voip-push-notification. */
interface VoipLoadedEvent {
  name: string;
  data: VoipPushPayload;
}

// MUST match react-native-voip-push-notification's exact native constant
// (`RNVoipPushRemoteNotificationReceivedEvent`). A previous typo dropped the
// "Push", so `didLoadWithEvents` cold-start pushes never matched and the CallKit
// coordinator was never driven (callKeepDriven=false → incoming call re-rang).
const NOTIFICATION_RECEIVED_EVENT = 'RNVoipPushRemoteNotificationReceivedEvent';

async function handleVoipPush(payload: VoipPushPayload): Promise<void> {
  // [ioscall] Prove the JS push handler ran and what the payload actually was.
  // callKeepDriven=false at onInvite means this either never ran or bailed here.
  dlog(
    `[ioscall] handleVoipPush type=${payload.type ?? '<none>'} uuid=${payload.uuid ?? '<none>'} handle=${payload.call_handle ?? '<none>'}`,
  );
  // Caller hung up before answer — dismiss the ringing UI by the same uuid.
  if (payload.type === 'voip_cancel') {
    if (typeof payload.uuid === 'string' && payload.uuid) cancelCallKeepIncoming(payload.uuid);
    return;
  }

  if (payload.type !== 'voip_incoming') {
    dlog(`[ioscall] handleVoipPush IGNORED — type is not 'voip_incoming'`);
    return; // not a call wake — ignore
  }

  const uuid = typeof payload.uuid === 'string' && payload.uuid ? payload.uuid : newCallUuid();
  dlog(`[ioscall] handleVoipPush → displayCallKeepIncoming uuid=${uuid}`);
  const handle = typeof payload.call_handle === 'string' ? payload.call_handle : 'unknown';
  const callerName =
    typeof payload.caller_name === 'string' ? payload.caller_name : 'Incoming call';

  // Idempotent with the native synchronous report (callkeep dedupes by UUID);
  // also marks the coordinator driven so the brain suppresses its JS modal.
  await displayCallKeepIncoming(uuid, handle, callerName);
}

let registered = false;

/**
 * Attach the VoIP wake listeners once. Idempotent. iOS-only: the native module
 * does not exist on Android, so a top-level import / call would throw — guarded
 * here and lazily required.
 */
export function registerVoipPush(): void {
  if (Platform.OS !== 'ios') return;
  if (registered) return;
  registered = true;

  // Lazy require: the native module only links on iOS.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const VoipPushNotification = require('react-native-voip-push-notification').default;

  dlog('[ioscall] registerVoipPush: listeners attached');

  // A push delivered while the JS bundle was still booting (cold start).
  VoipPushNotification.addEventListener('notification', (payload: VoipPushPayload) => {
    dlog('[ioscall] VoipPush "notification" event fired');
    void (async () => {
      try {
        await handleVoipPush(payload);
      } finally {
        if (typeof payload.uuid === 'string' && payload.uuid) {
          VoipPushNotification.onVoipNotificationCompleted(payload.uuid);
        }
      }
    })();
  });

  // Drain any events that fired before listeners were attached.
  VoipPushNotification.addEventListener('didLoadWithEvents', (events: VoipLoadedEvent[]) => {
    dlog(
      `[ioscall] VoipPush "didLoadWithEvents" fired count=${Array.isArray(events) ? events.length : 'not-array'}`,
    );
    if (!Array.isArray(events)) return;
    for (const event of events) {
      // [ioscall] Dump the real event name + data so we can see why the name
      // filter (NOTIFICATION_RECEIVED_EVENT) may not be matching.
      dlog(
        `[ioscall] didLoadWithEvents entry name="${event?.name}" data=${JSON.stringify(event?.data)}`,
      );
      if (event?.name === NOTIFICATION_RECEIVED_EVENT) {
        void handleVoipPush(event.data);
      }
    }
  });
}
