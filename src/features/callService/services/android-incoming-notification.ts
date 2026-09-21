/**
 * Android incoming-call ring — drives the local `IncomingCall` native module
 * (modules/incoming-call), which posts a platform CallStyle notification:
 * WhatsApp/Telegram-grade ringing with big Answer/Decline buttons, an
 * insistent looping ringtone, and a full-screen takeover when the device is
 * locked / screen off. Replaces both react-native-callkeep and notifee on
 * Android.
 *
 * The FCM data push is only a WAKE signal; the real call arrives as a SIP
 * INVITE over the websocket once the app boots. Surfaces:
 *  - locked / screen off → full-screen launch of MainActivity (the OS only
 *    allows the takeover when the device is not in active use — same rule
 *    WhatsApp and the system dialer live under);
 *  - unlocked, app backgrounded/killed → CallStyle heads-up, ring loops;
 *  - Answer → app launches with answer extras; the pending-answer mark below
 *    auto-accepts the INVITE when it lands (no second tap);
 *  - Decline → native receiver kills the ring; if JS is alive an `onDecline`
 *    event rejects the SIP session, else the caller just times out.
 *
 * Why not CallKeep on Android: ConnectionService needs the system "calling
 * account" enable step. Why not notifee: no CallStyle support, so its banner
 * ranks (and looks) like a plain notification.
 *
 * The native module only exists on Android — every entry point lazy-requires
 * it behind a Platform.OS guard; a top-level import would crash iOS at module
 * eval.
 */

import { Platform } from 'react-native';

import { getCallController } from './call-controller';
import { markCallBootStart, markPendingAnswer } from './callkeep-coordinator';
import { useCallStore } from '../store/call.store';

import { dlog } from '@/lib/debug-log';

function getIncomingCall(): typeof import('../../../../modules/incoming-call').default {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../../../../modules/incoming-call').default;
}

// The uuid of the most recently shown incoming notification, so the SIP brain
// can dismiss it on connect/terminate without knowing the FCM push uuid.
let lastShownUuid: string | null = null;

/**
 * Ring for an incoming call: CallStyle notification + looping ringtone +
 * full-screen wake when locked. The notification id derives from the call uuid
 * so it can be cancelled precisely (answer / hangup / the caller's voip_cancel
 * push). Safe to call from the headless FCM task. Resolves false if the native
 * module is unavailable so callers can fall back. Android-only.
 */
export async function showIncomingCallNotification(
  uuid: string,
  handle: string,
  callerName: string,
): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    dlog(`[androidcall] showIncomingCallNotification uuid=${uuid} handle=${handle}`);
    await getIncomingCall().show(
      uuid,
      callerName || 'Incoming call',
      handle && handle !== 'unknown' ? handle : 'Incoming call',
    );
    lastShownUuid = uuid;
    return true;
  } catch (e) {
    dlog('[androidcall] showIncomingCallNotification FAILED:', String(e));
    return false;
  }
}

/**
 * Dismiss the incoming-call notification by uuid (answered, ended, or the
 * caller cancelled before answer). Android-only no-op elsewhere; never throws.
 */
export async function cancelIncomingCallNotification(uuid?: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  const target = uuid ?? lastShownUuid;
  if (!target) return;
  try {
    dlog(`[androidcall] cancelIncomingCallNotification uuid=${target}`);
    await getIncomingCall().cancel(target);
    if (target === lastShownUuid) lastShownUuid = null;
  } catch {
    // notification may already be gone
  }
}

/**
 * Subscribe to Answer/Decline presses delivered while a JS runtime is alive
 * (app foregrounded or backgrounded). Answer marks a pending answer — consumed
 * by the brain when the SIP INVITE arrives, covering the push-races-INVITE
 * window — and pokes the controller for the already-ringing case. Returns an
 * unsubscribe fn (attach in a React effect). Android-only no-op elsewhere.
 */
export function registerIncomingCallListeners(): () => void {
  if (Platform.OS !== 'android') return () => {};
  const incomingCall = getIncomingCall();

  const answerSub = incomingCall.addListener('onAnswer', ({ uuid }) => {
    dlog(`[androidcall] onAnswer event uuid=${uuid} → markPendingAnswer + answerCall`);
    markPendingAnswer();
    useCallStore.getState().beginConnectingCall();
    getCallController().answerCall();
    void cancelIncomingCallNotification(uuid);
  });
  const declineSub = incomingCall.addListener('onDecline', ({ uuid }) => {
    // [androidcall] If this fires right after a cancelIncomingCallNotification
    // for the SAME uuid, the native cancel is echoing a decline event — that
    // would explain phantom hangups killing a fresh session.
    dlog(`[androidcall] onDecline event uuid=${uuid} → hangup`);
    getCallController().hangup();
    void cancelIncomingCallNotification(uuid);
  });

  return () => {
    answerSub.remove();
    declineSub.remove();
  };
}

/**
 * Cold-start answer: the user tapped Answer on a killed app, which launched
 * MainActivity with answer extras before any JS existed. Call once at app
 * boot — marks the pending answer so the brain auto-accepts the INVITE after
 * SIP registers. Returns true when an answer intent was consumed (so the boot
 * path can skip the marketing splash and go straight to the call). Android-only
 * no-op elsewhere; never throws.
 */
/**
 * Call ended: if the app is only on screen because it was launched over the lock
 * screen for that call, send it to the background so the device returns to the
 * lock screen instead of stranding the user on the app home. No-op when the
 * device is unlocked (the user is genuinely in the app). Android-only.
 */
export function moveAppToBackIfLocked(): void {
  if (Platform.OS !== 'android') return;
  try {
    getIncomingCall().moveToBackIfLocked();
  } catch {
    // native module unavailable / no current activity
  }
}

/**
 * Cold-start incoming launch: the killed app was opened by the incoming-call
 * notification's full-screen / body-tap intent (locked-screen takeover) rather
 * than the Answer button. Reads-and-clears the caller extras and seeds the
 * `incomingCall` store so the ringing screen shows immediately on boot (and the
 * splash is skipped via `callPresent`) instead of landing on home and waiting
 * for the SIP INVITE. The real INVITE later overwrites this placeholder.
 * Android-only no-op elsewhere; never throws.
 */
export function consumeIncomingCallLaunch(): void {
  if (Platform.OS !== 'android') return;
  try {
    const launch = getIncomingCall().consumeIncomingLaunch();
    dlog('[lockcall] consumeIncomingLaunch ->', JSON.stringify(launch));
    if (!launch) return;
    markCallBootStart();
    const number = launch.handle || launch.name || 'Incoming call';
    useCallStore.getState().setIncomingCall({
      number,
      displayName: launch.name ?? undefined,
    });
    dlog('[lockcall] incoming placeholder set number=', number);
  } catch (e) {
    dlog('[lockcall] consumeIncomingLaunch error', String(e));
  }
}

export function consumeColdStartAnswer(): boolean {
  if (Platform.OS !== 'android') return false;
  try {
    const uuid = getIncomingCall().consumeAnswerIntent();
    dlog('[lockcall] consumeColdStartAnswer uuid=', uuid);
    if (!uuid) return false;
    markCallBootStart();
    markPendingAnswer();
    // Drop straight onto the "Connecting…" call screen (and so skip the splash):
    // this is the reliable consume point — it runs once the Activity is attached
    // (CallProvider's effect), unlike a render-time check where the launch intent
    // is not yet readable.
    useCallStore.getState().beginConnectingCall();
    void cancelIncomingCallNotification(uuid);
    return true;
  } catch {
    // no answer intent to consume
    return false;
  }
}
