/**
 * CallKeep side-effect layer — the only module that talks to RNCallKeep.
 *
 * Wraps `react-native-callkeep` setup and the few imperative calls the app
 * needs (display / end an incoming call), and keeps the coordinator singleton
 * (`callkeep-coordinator.ts`) in sync so the brain can reason about the call
 * without importing RNCallKeep itself.
 *
 * Used from two places:
 *  - the React tree (CallProvider) — foreground setup + event bridging;
 *  - the headless FCM background handler (`fcm-call-messaging.ts`) — which boots
 *    with no React tree and must `setupCallKeep()` before `displayIncomingCall`.
 * Both paths are Android-first; iOS CallKit wiring is a later guide.
 */

import { Platform } from 'react-native';
import RNCallKeep, { type IOptions } from 'react-native-callkeep';

import {
  beginCallKeepIncoming,
  beginCallKeepOutgoing,
  getCallKeepUuid,
  resetCallKeepCoordinator,
} from './callkeep-coordinator';

const APP_NAME = 'RHK Properties';
/** Stable id for the mid-call foreground-service notification channel. */
const FOREGROUND_CHANNEL_ID = 'com.rhkproperties.mobile.callkeep';

const CALLKEEP_OPTIONS: IOptions = {
  ios: {
    appName: APP_NAME,
    supportsVideo: false,
    // CallKit `CXProviderConfiguration`. One call at a time mirrors the brain's
    // single-call assumption; Recents lets users redial from the system call log.
    maximumCallsPerCallGroup: '1',
    maximumCallGroups: '1',
    includesCallsInRecents: true,
  },
  android: {
    alertTitle: 'Phone account permission',
    alertDescription: 'RHK Properties needs to manage calls to ring your phone.',
    cancelButton: 'Cancel',
    okButton: 'OK',
    additionalPermissions: [],
    // iOS-only module now (Android uses notifee for incoming wake). Kept
    // non-self-managed; the Android branch of these options is never exercised
    // because setupCallKeep no longer runs on Android.
    selfManaged: false,
    // Keeps the mic alive when the call is backgrounded (Android 14 FGS mic).
    foregroundService: {
      channelId: FOREGROUND_CHANNEL_ID,
      channelName: 'Ongoing call',
      notificationTitle: 'Call in progress',
    },
  },
};

let setupPromise: Promise<boolean> | null = null;

/**
 * Initialise CallKeep + register the phone account. Idempotent and safe to call
 * from the headless background handler (where the native module instance does
 * not yet exist). Resolves false if setup fails so callers can fall back to the
 * JS-only foreground flow rather than crash.
 */
export async function setupCallKeep(): Promise<boolean> {
  if (setupPromise !== null) return setupPromise;
  setupPromise = (async () => {
    try {
      await RNCallKeep.setup(CALLKEEP_OPTIONS);
      if (Platform.OS === 'android') {
        RNCallKeep.setAvailable(true);
        RNCallKeep.registerAndroidEvents();
      }
      return true;
    } catch {
      setupPromise = null; // allow a later retry
      return false;
    }
  })();
  return setupPromise;
}

/**
 * Ring the native incoming-call UI. On the cold-killed path this runs inside the
 * FCM headless task, so it ensures setup first. Records the call on the
 * coordinator so the brain suppresses its own JS incoming UI for this call.
 *
 * Returns true if the native UI was rung; false if CallKeep setup failed, so
 * callers (the foreground SIP path) can fall back to the JS modal.
 */
export async function displayCallKeepIncoming(
  uuid: string,
  handle: string,
  callerName: string,
): Promise<boolean> {
  const ready = await setupCallKeep();
  if (!ready) return false;
  beginCallKeepIncoming(uuid);
  RNCallKeep.displayIncomingCall(uuid, handle, callerName, 'generic', false);
  return true;
}

/**
 * Report an OUTGOING call to CallKit so iOS shows the Dynamic Island call pill
 * (and a Recents entry). iOS-only: on Android (self-managed ConnectionService)
 * the JS ActiveCallScreen + FGS notification already cover outbound, and a
 * second self-managed Connection would compete with it. The handle type is
 * 'number' so CallKit treats the value as a phone number.
 */
export async function startCallKeepOutgoing(
  uuid: string,
  handle: string,
  displayName?: string,
): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const ready = await setupCallKeep();
  if (!ready) return;
  beginCallKeepOutgoing(uuid);
  RNCallKeep.startCall(uuid, handle, displayName ?? handle, 'number', false);
}

/** Tell the native UI a call has connected (clears the ringing state). */
export function reportCallKeepConnected(uuid: string): void {
  RNCallKeep.setCurrentCallActive(uuid);
}

/**
 * iOS CallKit outbound status: the INVITE is in flight (dialing/ringing). Maps
 * to CXProvider reportOutgoingCall(with:startedConnectingAt:) so the native
 * call screen / Dynamic Island shows the call as connecting rather than stuck
 * in the just-started state. No-op on Android.
 */
export function reportCallKeepOutgoingConnecting(uuid: string): void {
  if (Platform.OS !== 'ios') return;
  try {
    RNCallKeep.reportConnectingOutgoingCallWithUUID(uuid);
  } catch {
    // CallKit call may already be gone
  }
}

/**
 * iOS CallKit outbound status: the remote answered. Maps to CXProvider
 * reportOutgoingCall(with:connectedAt:) — this is what starts the native call
 * timer on the CallKit screen / Dynamic Island. No-op on Android.
 */
export function reportCallKeepOutgoingConnected(uuid: string): void {
  if (Platform.OS !== 'ios') return;
  try {
    RNCallKeep.reportConnectedOutgoingCallWithUUID(uuid);
    RNCallKeep.setCurrentCallActive(uuid);
  } catch {
    // CallKit call may already be gone
  }
}

/** Shape of RNCallKeep.getCalls() entries (iOS CXCallObserver snapshot). */
interface NativeCallKeepCall {
  callUUID: string;
  hasConnected: boolean;
  hasEnded: boolean;
  outgoing: boolean;
  onHold: boolean;
}

/**
 * iOS: true when CallKit currently holds an ANSWERED incoming call (connected,
 * not ended, not outgoing) — i.e. the user already tapped the native Answer
 * button. Cold-start fallback: when the app is killed and the user answers from
 * the CallKit screen, the answer happens before the RN bridge exists, and
 * RNCallKeep drops both PerformAnswerCallAction and didActivateAudioSession
 * (only DidDisplayIncomingCall survives its buffer). Polling CXCallObserver
 * state via getCalls() is deterministic — no event to lose. False on Android
 * and on any error.
 */
export async function hasAnsweredCallKeepCall(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    const calls = (await RNCallKeep.getCalls()) as NativeCallKeepCall[] | undefined;
    return (calls ?? []).some((c) => c.hasConnected && !c.hasEnded && !c.outgoing);
  } catch {
    return false;
  }
}

/**
 * Dismiss a specific CallKeep call by UUID — the caller hung up before the agent
 * answered (`voip_cancel` push). Ends the native ringing UI (iOS CallKit reports
 * `.remoteEnded`; Android tears down the ConnectionService) and, if it is the
 * call the coordinator is tracking, clears that state too. Runs on both the
 * foreground and headless paths, so it takes the UUID from the push rather than
 * the coordinator (whose state does not survive the killed-app cold start).
 */
export function cancelCallKeepIncoming(uuid: string): void {
  try {
    RNCallKeep.endCall(uuid);
  } catch {
    // native UI may already be gone
  }
  if (getCallKeepUuid() === uuid) resetCallKeepCoordinator();
}

/**
 * Dismiss the native call UI for the current CallKeep call (if any) and clear
 * coordinator state. Called by the brain when the SIP session terminates.
 */
export function endCallKeepCall(): void {
  const uuid = getCallKeepUuid();
  try {
    if (uuid) RNCallKeep.endCall(uuid);
    // Belt-and-suspenders: end EVERY CallKit call, not just the coordinator's
    // UUID. On iOS the native PushKit handler reports the incoming call to CallKit
    // synchronously with `dict["uuid"] ?? UUID()`, while JS reports with
    // `payload.uuid ?? newCallUuid()`. If the backend omits `uuid`, those two
    // fall back to DIFFERENT random UUIDs → CallKit shows a call the coordinator
    // can't address, so `endCall(uuid)` leaves it on screen with a ticking timer.
    // This app is single-call, so ending all is safe and guarantees teardown.
    RNCallKeep.endAllCalls();
  } catch {
    // native UI may already be gone / CallKeep not set up (Android)
  }
  resetCallKeepCoordinator();
}
