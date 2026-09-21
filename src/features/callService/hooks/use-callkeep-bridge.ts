/**
 * Bridges CallKeep's per-UUID native call events to the no-arg call controller
 * singleton, so the native call UI (iOS CallKit lock screen / Dynamic Island,
 * Android ConnectionService / killed-app wake) drives the same SIP brain as the
 * in-app UI — without duplicating SIP logic.
 *
 * Mounted once by `CallProvider`. Cross-platform: react-native-callkeep emits the
 * same `answerCall` / `endCall` / `didPerformSetMutedCallAction` /
 * `didToggleHoldCallAction` events on both iOS (CallKit) and Android. Without this
 * hook, tapping Answer/End on the native iOS lock-screen UI would never reach the
 * SIP session.
 *
 * Cold-start note: when the app was killed, the push handler that rang CallKeep
 * (Android FCM headless task / iOS PushKit shim) ran before this runtime existed,
 * so coordinator state it set is gone here. CallKeep retains the events natively,
 * so on mount we replay `getInitialEvents()` to rehydrate the coordinator (which
 * call is in flight, and whether the user already answered on the native UI).
 */

import { useEffect } from 'react';
import { Platform } from 'react-native';
import RNCallKeep from 'react-native-callkeep';

import { startCallAudio } from '../services/call-audio';
import { getCallController } from '../services/call-controller';
import {
  beginCallKeepIncoming,
  isCallKeepIncoming,
  markPendingAnswer,
  resetCallKeepCoordinator,
} from '../services/callkeep-coordinator';
import { hasAnsweredCallKeepCall, setupCallKeep } from '../services/callkeep';
import { useCallStore } from '../store/call.store';

import { dlog } from '@/lib/debug-log';

// Single processor for a native CallKeep action, shared by all three delivery
// channels so the cold-start answer can't slip through a gap:
//   1. getInitialEvents()  — pull of events buffered before mount
//   2. didLoadWithEvents   — PUSH of events buffered AFTER the pull but before
//      JS was "ready" (the killed-app Answer tap lands here: iOS launches the
//      app to deliver the answer, so it arrives mid-boot, just after the
//      getInitialEvents pull — previously dropped)
//   3. live listeners      — warm path (app already running)
// Handlers are idempotent (markPendingAnswer / beginCallKeepIncoming), so the
// same action arriving on two channels is harmless.
function applyCallKeepEvent(name: string, data: { callUUID?: string }): void {
  if (name === 'RNCallKeepDidDisplayIncomingCall') {
    dlog(`[ioscall] event DidDisplayIncomingCall uuid=${data?.callUUID}`);
    if (data?.callUUID) beginCallKeepIncoming(data.callUUID);
  }
  if (name === 'RNCallKeepPerformAnswerCallAction') {
    dlog('[ioscall] event PerformAnswerCallAction → markPendingAnswer');
    markPendingAnswer();
    useCallStore.getState().beginConnectingCall();
    getCallController().answerCall();
  }
  if (name === 'RNCallKeepPerformEndCallAction') {
    dlog('[ioscall] event PerformEndCallAction → hangup');
    getCallController().hangup();
    resetCallKeepCoordinator();
  }
}

/** Apply a batch of buffered CallKeep events (channels 1 and 2). */
function applyBufferedCallKeepEvents(source: string, events: unknown): void {
  const list = (events ?? []) as { name: string; data: { callUUID?: string } }[];
  const names = list.map((e) => e.name).join(', ');
  dlog(`[ioscall] ${source} count=${list.length} names=[${names}]`);
  for (const event of list) applyCallKeepEvent(event.name, event.data);
}

export function useCallKeepBridge(): void {
  useEffect(() => {
    // iOS-only: CallKit drives the native call UI + events here. Android no longer
    // uses CallKeep — its incoming wake is a notifee full-screen-intent
    // notification (android-incoming-notification.ts) and the in-app JS screen.
    if (Platform.OS !== 'ios') return;

    let cancelled = false;
    const subscriptions: { remove: () => void }[] = [];

    void (async () => {
      const ready = await setupCallKeep();
      dlog(`[ioscall] useCallKeepBridge: setupCallKeep ready=${ready} cancelled=${cancelled}`);
      if (!ready || cancelled) return;

      // Channel 2: buffered events pushed once JS finishes loading. This is the
      // channel the killed-app Answer tap actually arrives on.
      subscriptions.push(
        RNCallKeep.addEventListener('didLoadWithEvents', (events) => {
          applyBufferedCallKeepEvents('CallKeep didLoadWithEvents', events);
        }),
      );

      // Channel 1: pull whatever is already buffered at mount.
      try {
        const initial = await RNCallKeep.getInitialEvents();
        applyBufferedCallKeepEvents('getInitialEvents', initial);
        RNCallKeep.clearInitialEvents();
      } catch {
        // no initial events / not supported — fine
      }
      if (cancelled) return;

      // Channel 4 (deterministic boot check): the user may have tapped Answer on
      // CallKit before the RN bridge existed — no event survives that reliably
      // (only DidDisplayIncomingCall makes it through RNCallKeep's buffer). Ask
      // CXCallObserver directly: an already-connected incoming CallKit call means
      // the answer happened. Queue it now (pendingAnswer → onInvite auto-accepts)
      // and show the connecting screen immediately — this also cuts the splash
      // animation short (root layout skips it once a call is present) instead of
      // playing splash → home → call seconds later when SIP finally binds.
      if (isCallKeepIncoming() && (await hasAnsweredCallKeepCall())) {
        dlog('[ioscall] boot answered-state check → true (queue answer + connecting UI)');
        markPendingAnswer();
        useCallStore.getState().beginConnectingCall();
        getCallController().answerCall();
      }
      if (cancelled) return;

      // Channel 3: live events (app already running when the action happens).
      subscriptions.push(
        RNCallKeep.addEventListener('didDisplayIncomingCall', ({ callUUID }) => {
          dlog(`[ioscall] LIVE didDisplayIncomingCall uuid=${callUUID}`);
          beginCallKeepIncoming(callUUID);
        }),
        RNCallKeep.addEventListener('answerCall', () => {
          dlog('[ioscall] LIVE answerCall → markPendingAnswer');
          // Replays in the brain's onInvite if the SIP INVITE has not arrived yet;
          // accepts immediately (no-op) if the session is already present.
          markPendingAnswer();
          useCallStore.getState().beginConnectingCall();
          getCallController().answerCall();
        }),
        RNCallKeep.addEventListener('endCall', () => {
          getCallController().hangup();
          resetCallKeepCoordinator();
        }),
        RNCallKeep.addEventListener('didPerformSetMutedCallAction', () => {
          getCallController().toggleMute();
        }),
        RNCallKeep.addEventListener('didToggleHoldCallAction', () => {
          getCallController().toggleHold();
        }),
        // iOS only (Android never emits it): CallKit owns the AVAudioSession and
        // signals when it is active — the correct moment to start in-call audio
        // routing. Harmless on Android. Idempotent with the brain's Established path.
        RNCallKeep.addEventListener('didActivateAudioSession', () => {
          dlog('[ioscall] didActivateAudioSession');
          startCallAudio();
          // Fallback answer trigger. On the killed-app PushKit path RNCallKeep does
          // not reliably deliver PerformAnswerCallAction to JS, so the CallKit
          // Answer tap is otherwise lost. CallKit activates the audio session for
          // an INCOMING call only AFTER the user answers — so for an incoming
          // CallKeep call, treat this as the answer: queue it (auto-accepted in
          // onInvite if the INVITE has not bound yet) and accept a bound session.
          // Gated to incoming only so it never fires on an outbound CallKit pill.
          if (isCallKeepIncoming()) {
            dlog('[ioscall] didActivateAudioSession → treating as answer (incoming)');
            markPendingAnswer();
            useCallStore.getState().beginConnectingCall();
            getCallController().answerCall();
          }
        }),
      );
    })();

    return () => {
      cancelled = true;
      subscriptions.forEach((s) => s.remove());
    };
  }, []);
}
