/**
 * FCM background handler for incoming-call wake (Android killed/locked path).
 *
 * `@react-native-firebase/messaging`'s background handler runs in a headless JS
 * task that boots even when the app is fully killed — the only reliable way to
 * ring CallKeep's native UI from cold start (callkeep's native module instance
 * is null until JS runs `setup()`, so a pure-Kotlin FirebaseMessagingService
 * cannot do it). The handler ensures CallKeep setup, then rings.
 *
 * The backend sends a data-only, high-priority push shaped as:
 *   { type: 'voip_incoming', uuid, caller_name, call_handle }
 * (see calling-native-setup-android.md §5b). Non-call messages are ignored here
 * and left to the normal notifications path.
 *
 * MUST be registered at module-evaluation time (not inside a component) so it is
 * present in both the normal and headless runtimes — `app/_layout.tsx` imports
 * this module for that side effect.
 */

import { AppState, Platform } from 'react-native';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';

import {
  cancelIncomingCallNotification,
  showIncomingCallNotification,
} from './android-incoming-notification';
import { getCallController } from './call-controller';
import { newCallUuid } from './callkeep-coordinator';
import { isActiveCall, useCallStore } from '../store/call.store';

import { dlog } from '@/lib/debug-log';

// Caller hung up before answer — dismiss the ringing notification by uuid and
// clear any in-app placeholder so a backgrounded-alive app stops ringing too.
async function handleVoipCancel(data: Record<string, string | object>): Promise<void> {
  dlog('[callend][fcm] voip_cancel — dismissing notification + placeholder');
  if (typeof data.uuid === 'string' && data.uuid) await cancelIncomingCallNotification(data.uuid);
  if (!isActiveCall(useCallStore.getState().activeCall)) {
    useCallStore.getState().setIncomingCall(null);
  }
}

// Remote party hung up an ANSWERED call — the SIP BYE may have been lost over a
// suspended WebSocket. Tear the call down via the controller so a backgrounded-
// alive app doesn't stick on the in-call screen. (iOS never receives this — it
// relies on client-side liveness; Apple forbids PushKit for non-ring events.)
async function handleVoipHangup(data: Record<string, string | object>): Promise<void> {
  dlog('[callend][fcm] voip_hangup — ending active call if any');
  const store = useCallStore.getState();
  if (isActiveCall(store.activeCall)) {
    try {
      getCallController().hangup();
    } catch (e: unknown) {
      dlog('[callend][fcm] voip_hangup hangup() failed:', String(e));
      store.resetActiveCall();
    }
  }
  // voip_hangup carries the FreeSWITCH callUuid, NOT the pushUuid the ring
  // notification was posted under — pass undefined so the cancel targets the
  // last-shown notification instead of missing on a uuid that never matched.
  await cancelIncomingCallNotification();
}

async function handleCallMessage(message: FirebaseMessagingTypes.RemoteMessage): Promise<void> {
  const data = message.data ?? {};
  dlog(
    `[callend][fcm] push received appState=${AppState.currentState} data=${JSON.stringify(data)}`,
  );

  if (data.type === 'voip_cancel') return handleVoipCancel(data);
  if (data.type === 'voip_hangup') return handleVoipHangup(data);

  if (data.type !== 'voip_incoming') return; // not a call — leave to normal notifications

  const uuid = typeof data.uuid === 'string' && data.uuid ? data.uuid : newCallUuid();
  const handle = typeof data.call_handle === 'string' ? data.call_handle : 'unknown';
  const callerName = typeof data.caller_name === 'string' ? data.caller_name : 'Incoming call';

  await showIncomingCallNotification(uuid, handle, callerName);

  // App is backgrounded-but-alive (this handler runs in the live JS runtime, not
  // the killed-app headless task): seed the in-app ringing screen now so it is
  // already showing when the app comes to the foreground (notification tap /
  // full-screen on lock), instead of landing on home. Foreground ('active') is
  // left to the SIP onInvite path; the killed headless runtime discards this
  // store write (harmless). Don't clobber a live call.
  const store = useCallStore.getState();
  if (AppState.currentState !== 'active' && !isActiveCall(store.activeCall)) {
    store.setIncomingCall({ number: handle, displayName: callerName });
  }
}

let registered = false;

/**
 * Register the FCM background handler once. Idempotent. Android-only: iOS uses
 * PushKit/CallKit (separate guide), and touching `messaging()` on iOS when the
 * Firebase native module isn't configured would throw at module-eval time.
 */
export function registerCallBackgroundHandler(): void {
  if (Platform.OS !== 'android') return;
  if (registered) return;
  registered = true;
  // Lazy require: the native RNFB module only exists on Android (excluded from
  // iOS autolinking), so a top-level import would crash iOS at module eval.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getMessaging, setBackgroundMessageHandler } = require('@react-native-firebase/messaging');
  setBackgroundMessageHandler(getMessaging(), handleCallMessage);
}

/**
 * Register the FCM foreground handler. `setBackgroundMessageHandler` ONLY fires
 * when the app is backgrounded/killed — a data push arriving while the app is in
 * the foreground is delivered via `onMessage` instead, with no handler the OS
 * silently drops it. Routes foreground call pushes through the same
 * `handleCallMessage`; CallKeep dedupes by uuid so the native ring UI is shown
 * exactly once regardless of which path delivered the push.
 *
 * Returns an unsubscribe fn (attach in a React effect). Android-only.
 */
export function registerCallForegroundHandler(): () => void {
  if (Platform.OS !== 'android') return () => {};
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getMessaging, onMessage } = require('@react-native-firebase/messaging');
  return onMessage(getMessaging(), handleCallMessage) as () => void;
}
