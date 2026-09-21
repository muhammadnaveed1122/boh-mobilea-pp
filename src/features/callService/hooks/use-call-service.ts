/**
 * useCallService — the brain. Direct port of web
 * `boh-lead-magnet/src/features/callService/hooks/useCallServiceManager.ts`
 * with substrate swaps (see plan):
 *   Redux        → Zustand `useCallStore`
 *   window.*     → returned imperative API (registered on the controller)
 *   <audio>      → react-native-incall-manager (via call-audio service)
 *   beforeunload → AppState listener
 *   navigator.permissions → useCallPermissions (PermissionsAndroid / iOS prompt)
 *
 * Foreground-only: when the OS suspends the app the SIP WebSocket drops; this
 * is expected and handled by the AppState listener (clean teardown +
 * re-register on return to foreground).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { mediaDevices, type RTCPeerConnection } from 'react-native-webrtc';
import {
  Invitation,
  Inviter,
  Registerer,
  type Session,
  SessionState,
  TransportState,
  UserAgent,
} from 'sip.js';

import { useAuthStore } from '@/store/auth.store';

import { AudioRoute, CALL_TIMING, CallDirection, CallStatus, SipStatus } from '../constants';
import type { SipConfig } from '../models';
import {
  type AudioRouteState,
  setAudioRoute as applyAudioRoute,
  startCallAudio,
  startRingback,
  startRingtone,
  stopCallAudio,
  stopRingback,
  stopRingtone,
  subscribeAudioRoutes,
} from '../services/call-audio';
import {
  cancelIncomingCallNotification,
  moveAppToBackIfLocked,
} from '../services/android-incoming-notification';
import {
  type CallEndReason,
  classifyCallEnd,
  type ParsedReason,
  parseReasonHeader,
} from '../services/call-end-reason';
import { connectLead, skipLead } from '../services/callService.api';
import {
  endCallKeepCall,
  hasAnsweredCallKeepCall,
  reportCallKeepConnected,
  reportCallKeepOutgoingConnected,
  reportCallKeepOutgoingConnecting,
  startCallKeepOutgoing,
} from '../services/callkeep';
import {
  callBootElapsedMs,
  consumePendingAnswer,
  getCallKeepUuid,
  isCallKeepDriven,
  markPendingAnswer,
  newCallUuid,
} from '../services/callkeep-coordinator';
import { startCallLiveness } from '../services/call-liveness';
import { probeIceServers } from '../services/ice-probe';
import { getIceServers } from '../services/ice-servers';
import { ensureWebRTCRegistered, holdModifier } from '../services/rn-sdh';
import { getAgentExtension, getSipConfigForUser } from '../services/sip-config';
import { isActiveCall, useCallStore } from '../store/call.store';
import { useCallPermissions } from './use-call-permissions';

import { dlog } from '@/lib/debug-log';

interface PeerHolder {
  sessionDescriptionHandler?: { peerConnection?: RTCPeerConnection };
}

function getPeerConnection(session: Session | null): RTCPeerConnection | undefined {
  return (session as unknown as PeerHolder | null)?.sessionDescriptionHandler?.peerConnection;
}

// ---- [audio-stats] temporary diagnostic ------------------------------------
// Distorted ("cutting") playback with a clean uplink: decide network vs device.
// concealedSamples ≈ NetEQ patching over missing/late packets → NETWORK jitter/
// loss on the downlink. Clean packet flow + low concealment while audio still
// chops → DEVICE audio-unit problem. Remove once diagnosed.
interface InboundAudioStats {
  packetsReceived?: number;
  packetsLost?: number;
  jitter?: number;
  concealedSamples?: number;
  totalSamplesReceived?: number;
  type?: string;
  kind?: string;
  mediaType?: string;
  // media-playout (render side): samples the PLAYOUT path had to fabricate
  // because the audio unit asked for data that wasn't there — direct evidence
  // of render underruns, invisible to inbound-rtp.
  synthesizedSamplesDuration?: number;
  totalSamplesDuration?: number;
  totalPlayoutDelay?: number;
  totalSamplesCount?: number;
}

let lastAudioStats: InboundAudioStats = {};
let lastPlayoutStats: InboundAudioStats = {};
let dumpedStatTypes = false;

async function logInboundAudioStats(pc: RTCPeerConnection | undefined): Promise<void> {
  if (!pc) return;
  try {
    const report = (await pc.getStats()) as unknown as {
      forEach: (cb: (s: InboundAudioStats) => void) => void;
    };
    const types: string[] = [];
    report.forEach((s) => {
      types.push(s.type ?? '?');
      if (s.type === 'media-playout') {
        const dSynth =
          (s.synthesizedSamplesDuration ?? 0) - (lastPlayoutStats.synthesizedSamplesDuration ?? 0);
        const dDur = (s.totalSamplesDuration ?? 0) - (lastPlayoutStats.totalSamplesDuration ?? 0);
        const pct = dDur > 0 ? Math.round((dSynth / dDur) * 100) : 0;
        dlog(
          `[audio-stats][playout] synthesized=+${dSynth.toFixed(3)}s/${dDur.toFixed(3)}s (${pct}%) playoutDelayTotal=${s.totalPlayoutDelay?.toFixed(2) ?? '?'}`,
        );
        lastPlayoutStats = s;
        return;
      }
      if (s.type !== 'inbound-rtp') return;
      if (s.kind !== 'audio' && s.mediaType !== 'audio') return;
      const dRecv = (s.packetsReceived ?? 0) - (lastAudioStats.packetsReceived ?? 0);
      const dLost = (s.packetsLost ?? 0) - (lastAudioStats.packetsLost ?? 0);
      const dConcealed = (s.concealedSamples ?? 0) - (lastAudioStats.concealedSamples ?? 0);
      const dTotal = (s.totalSamplesReceived ?? 0) - (lastAudioStats.totalSamplesReceived ?? 0);
      const concealedPct = dTotal > 0 ? Math.round((dConcealed / dTotal) * 100) : 0;
      dlog(
        `[audio-stats] recv=+${dRecv} lost=+${dLost} jitter=${s.jitter ?? '?'} concealed=+${dConcealed}/${dTotal} (${concealedPct}%)`,
      );
      lastAudioStats = s;
    });
    if (!dumpedStatTypes) {
      dumpedStatTypes = true;
      dlog(`[audio-stats] available stat types: ${[...new Set(types)].join(', ')}`);
    }
  } catch (e: unknown) {
    dlog('[audio-stats] getStats failed:', String(e));
  }
}

function resetAudioStats(): void {
  lastAudioStats = {};
  lastPlayoutStats = {};
  dumpedStatTypes = false;
}
// -----------------------------------------------------------------------------

/** Show the JS in-app incoming-call modal + ringtone (foreground fallback path). */
function ringJsIncomingModal(number: string, displayName?: string): void {
  useCallStore.getState().setIncomingCall({ number, displayName });
  startRingtone();
}

/**
 * Present the incoming call once its SIP INVITE arrives.
 *
 * Both platforms show the JS in-app `IncomingCallScreen` + ringtone here. On
 * Android the lock-screen wake is a native CallStyle notification
 * (see android-incoming-notification.ts) that launches the app; once that app
 * UI is up we dismiss the notification and let the JS modal + SIP own the call
 * (Android no longer uses CallKeep). iOS foreground INVITEs use the JS modal
 * too — native CallKit UI on iOS comes only from the PushKit wake path, where
 * `isCallKeepDriven()` suppresses this presenter entirely.
 */
/**
 * iOS cold-start answer fallback. When the app is killed and the user answers on
 * the CallKit screen, the answer happens before the RN bridge exists and
 * RNCallKeep loses it (only DidDisplayIncomingCall survives its native buffer —
 * PerformAnswerCallAction and didActivateAudioSession are both dropped), so no
 * pendingAnswer was queued. Don't trust events: ask CXCallObserver directly. An
 * incoming CallKit call with hasConnected=true means the user already tapped
 * Answer — accept the freshly bound INVITE now.
 */
function acceptIfNativelyAnswered(invitation: Invitation): void {
  hasAnsweredCallKeepCall()
    .then((answered) => {
      dlog(`[ioscall] onInvite native answered-state check → ${answered}`);
      if (!answered) return;
      if (invitation.state !== SessionState.Initial) return; // accepted/ended meanwhile
      useCallStore.getState().beginConnectingCall();
      // Final audio-session config BEFORE accept: the WebRTC audio unit is born
      // during accept and must init against the session it will live with —
      // reconfiguring later (Established) glitches playback (cutting).
      startCallAudio();
      return invitation.accept();
    })
    .catch((e: unknown) => {
      dlog('[ioscall] accept via answered-state check FAILED:', String(e));
    });
}

function presentForegroundIncoming(number: string, displayName?: string): void {
  if (Platform.OS === 'android') {
    if (AppState.currentState !== 'active') {
      // App is backgrounded/locked: the JS modal is INVISIBLE there, and killing
      // the native CallStyle notification would silence the only surface the
      // user can see — the phone goes mute mid-ring and the caller gives up.
      // Keep the native notification ringing; just seed the store so the call
      // screen is ready the moment the user answers or opens the app.
      dlog('[androidcall] onInvite while backgrounded — keeping native notification ring');
      useCallStore.getState().setIncomingCall({ number, displayName });
      return;
    }
    // Foreground: the app UI is visible — dismiss the wake notification (if
    // any); the in-app incoming screen now owns the ring.
    void cancelIncomingCallNotification();
  }
  ringJsIncomingModal(number, displayName);
}

async function hangupInvitation(session: Invitation): Promise<void> {
  const { state } = session;
  if (state === SessionState.Initial) {
    await session.reject();
  } else if (state === SessionState.Established) {
    await session.bye();
  } else {
    try {
      await session.bye();
    } catch {
      try {
        await session.reject();
      } catch {
        // Session may already be terminating
      }
    }
  }
}

async function hangupInviter(session: Inviter): Promise<void> {
  if (session.state === SessionState.Established) {
    await session.bye();
  } else {
    try {
      await session.cancel();
    } catch {
      // Session may already be terminating; cleanup continues via state listener.
    }
  }
}

export function useCallService() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.tokens?.accessToken ?? null);

  // NOTE: deliberately does NOT subscribe to `phoneNumber` / `isDialerOpen`.
  // This hook is mounted globally in CallProvider; subscribing to dialer state
  // re-rendered the whole brain on every keystroke (severe input lag). The
  // dialpad owns its own local input now.
  const sipConnection = useCallStore((s) => s.sipConnection);
  const activeCall = useCallStore((s) => s.activeCall);
  const incomingCall = useCallStore((s) => s.incomingCall);
  const showMicPermissionModal = useCallStore((s) => s.showMicPermissionModal);

  const [audioRoute, setAudioRouteState] = useState<AudioRouteState>({
    selected: AudioRoute.EARPIECE,
    available: [AudioRoute.EARPIECE, AudioRoute.SPEAKER_PHONE],
  });

  const { checkMicrophonePermission } = useCallPermissions();

  const hasCredentials = useMemo(
    () => Boolean(isAuthenticated && getSipConfigForUser(user)),
    [isAuthenticated, user],
  );

  // SIP.js refs (not serializable — kept out of the store)
  const uaRef = useRef<UserAgent | null>(null);
  const registererRef = useRef<Registerer | null>(null);
  const activeSessionRef = useRef<Inviter | Invitation | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationStartTimeRef = useRef<number | null>(null);
  const durationInitialValueRef = useRef(0);
  const connectionAttemptedRef = useRef(false);
  const isConnectingRef = useRef(false);
  const sipConfigRef = useRef<SipConfig | null>(null);
  const isHangingUpRef = useRef(false);
  const lastHangupTimeRef = useRef(0);

  // ---- end-reason capture (per call) ----
  // Raw SIP signals collected over the call's lifetime; classified into a
  // CallEndReason at SessionState.Terminated. See call-end-reason.ts.
  const wasEstablishedRef = useRef(false);
  const rejectCodeRef = useRef<number | null>(null);
  const reasonHeaderRef = useRef<ParsedReason | null>(null);
  const endReasonRef = useRef<CallEndReason | null>(null);
  // True once the user initiates the hangup/decline this call, so the reason can
  // be labelled "Declined"/"Cancelled" rather than "Missed".
  const localHangupRef = useRef(false);
  // Holds the timer that dismisses the post-call "ending" display.
  const endDisplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearEndDisplayTimer = useCallback(() => {
    if (endDisplayTimerRef.current) {
      clearTimeout(endDisplayTimerRef.current);
      endDisplayTimerRef.current = null;
    }
  }, []);

  const resetEndReasonCapture = useCallback(() => {
    wasEstablishedRef.current = false;
    rejectCodeRef.current = null;
    reasonHeaderRef.current = null;
    endReasonRef.current = null;
    localHangupRef.current = false;
  }, []);

  // Wire a session's delegate to capture the hangup cause (BYE/CANCEL Reason
  // header). Preserves any existing delegate fields.
  const captureSessionReason = useCallback((session: Inviter | Invitation) => {
    session.delegate = {
      ...session.delegate,
      onBye: (bye) => {
        const raw = bye.request.getHeader('reason');
        dlog(`[callend] onBye received. Reason header=${raw ?? '(none)'}`);
        reasonHeaderRef.current = parseReasonHeader(raw);
      },
      onCancel: (cancel) => {
        const raw = cancel.request.getHeader('reason');
        dlog(`[callend] onCancel received. Reason header=${raw ?? '(none)'}`);
        reasonHeaderRef.current = parseReasonHeader(raw);
      },
    };
  }, []);

  // ---- store action getters (read fresh inside SIP listeners) ----
  const store = useCallStore;

  // Resolve SIP config when credentials become available.
  useEffect(() => {
    if (hasCredentials) {
      sipConfigRef.current = getSipConfigForUser(user);
      connectionAttemptedRef.current = false;
      return;
    }
    sipConfigRef.current = null;
  }, [hasCredentials, user]);

  // Globally suppress harmless sip.js errors (ported verbatim from web).
  useEffect(() => {
    const originalConsoleError = console.error;
    const stringifyArg = (a: unknown): string => {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return a.message;
      try {
        return JSON.stringify(a) ?? '';
      } catch {
        return '';
      }
    };
    console.error = (...args: unknown[]) => {
      const message = args.map(stringifyArg).join(' ');
      const is403UnregisterError =
        message.includes('sip.Registerer') &&
        (message.includes('Unregister rejected') || message.includes('unregister rejected')) &&
        message.includes('403');
      const isTerminatingStateError =
        (message.includes('sip.Inviter') || message.includes('sip.Invitation')) &&
        message.includes('Trying received while in state Terminating');
      const isWebSocketTransportError =
        message.includes('sip.Transport') && message.includes('WebSocket error');
      const isNotConnectedError =
        message.includes('sip.user-agent-client') && message.includes('Not connected');
      if (
        !is403UnregisterError &&
        !isTerminatingStateError &&
        !isWebSocketTransportError &&
        !isNotConnectedError
      ) {
        originalConsoleError.apply(console, args);
      }
    };
    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  // ---- duration timer ----
  const startDurationTimer = useCallback(() => {
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    durationStartTimeRef.current = Date.now();
    durationInitialValueRef.current = store.getState().activeCall.duration || 0;
    durationTimerRef.current = setInterval(() => {
      if (durationStartTimeRef.current === null) return;
      const elapsed = Math.floor((Date.now() - durationStartTimeRef.current) / 1000);
      store.getState().updateActiveCall({
        duration: durationInitialValueRef.current + elapsed,
      });
    }, CALL_TIMING.DURATION_TIMER_INTERVAL);
  }, [store]);

  const stopDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    durationStartTimeRef.current = null;
    durationInitialValueRef.current = 0;
  }, []);

  // Classify how the call ended from the SIP signals captured this call, and
  // remember it for the outcome modal. Called from each Terminated handler
  // before state is reset.
  const finalizeEndReason = useCallback((direction: CallDirection) => {
    endReasonRef.current = classifyCallEnd({
      wasEstablished: wasEstablishedRef.current,
      rejectCode: rejectCodeRef.current,
      reason: reasonHeaderRef.current,
      direction,
      localHangup: localHangupRef.current,
    });
    return endReasonRef.current;
  }, []);

  // Capture context + open outcome modal when a call ends.
  const triggerOutcomeModal = useCallback(() => {
    const s = store.getState();
    const number = s.activeCall.number ?? s.incomingCall?.number ?? null;
    if (!number) return;
    const endedAt = new Date().toISOString();
    const startedAt =
      s.activeCall.startTime ??
      (s.activeCall.duration > 0
        ? new Date(Date.now() - s.activeCall.duration * 1000).toISOString()
        : null);
    s.openOutcomeModal({
      leadId: s.activeCall.contactId,
      number,
      displayName: s.activeCall.displayName ?? s.incomingCall?.displayName ?? null,
      direction: s.activeCall.direction,
      duration: s.activeCall.duration,
      startedAt,
      endedAt,
      endReason: endReasonRef.current ?? undefined,
    });
  }, [store]);

  // Single teardown path for a terminated SIP session. Classifies the end
  // reason, stops media, then keeps the call screen on screen for a beat showing
  // that reason (e.g. "Busy", "No answer", "Call ended") before dismissing it
  // and opening the outcome modal. Idempotent: a second call while the ending
  // display is already scheduled is a no-op.
  const gracefulEnd = useCallback(
    (direction: CallDirection) => {
      if (endDisplayTimerRef.current) {
        dlog('[callend] gracefulEnd skipped — ending display already in flight');
        return; // ending display already in flight
      }
      const reason = finalizeEndReason(direction);
      dlog(
        `[callend] gracefulEnd dir=${direction} reason=${reason} ` +
          `wasEstablished=${wasEstablishedRef.current} rejectCode=${rejectCodeRef.current} ` +
          `reasonHeader=${JSON.stringify(reasonHeaderRef.current)} localHangup=${localHangupRef.current}`,
      );

      stopRingtone();
      stopRingback();
      stopDurationTimer();
      stopCallAudio();
      endCallKeepCall(); // iOS: dismiss CallKit now (JS shows the reason itself)
      void cancelIncomingCallNotification(); // Android: dismiss wake notification

      activeSessionRef.current = null;
      isHangingUpRef.current = false;
      lastHangupTimeRef.current = 0;

      const s = store.getState();
      const number = s.activeCall.number ?? s.incomingCall?.number ?? null;
      // Nothing meaningful to show (no call context at all) — reset immediately.
      if (!number) {
        store.getState().resetActiveCall();
        store.getState().setIncomingCall(null);
        return;
      }

      // Keep the call card populated (duration/startTime intact for the outcome
      // modal) but flip to the terminal status + reason so the screen shows it.
      store.getState().setActiveCall({
        ...s.activeCall,
        number,
        displayName: s.activeCall.displayName ?? s.incomingCall?.displayName,
        direction: s.activeCall.direction ?? direction,
        status: CallStatus.ENDED,
        endReason: reason,
      });
      store.getState().setIncomingCall(null);
      store.getState().setCallMinimized(false); // surface the reason full-screen
      store.getState().setDialerOpen(false);
      dlog(`[callend] showing end screen (${reason}) for ${CALL_TIMING.END_DISPLAY_DURATION}ms`);

      endDisplayTimerRef.current = setTimeout(() => {
        endDisplayTimerRef.current = null;
        dlog('[callend] end display elapsed — resetting to idle + outcome modal');
        triggerOutcomeModal(); // reads the still-populated activeCall
        store.getState().resetActiveCall();
        store.getState().setIncomingCall(null);
      }, CALL_TIMING.END_DISPLAY_DURATION);
    },
    [finalizeEndReason, stopDurationTimer, triggerOutcomeModal, store],
  );

  // ---- disconnect (logout / teardown) ----
  const handleDisconnect = useCallback(async () => {
    isConnectingRef.current = false;
    connectionAttemptedRef.current = false;
    isHangingUpRef.current = false;
    lastHangupTimeRef.current = 0;
    clearEndDisplayTimer();

    if (registererRef.current) {
      try {
        await registererRef.current.unregister({
          requestDelegate: { onReject: () => {} },
        });
      } catch {
        // ignore
      }
      registererRef.current = null;
    }
    if (uaRef.current) {
      try {
        await uaRef.current.stop();
      } catch {
        // ignore
      }
      uaRef.current = null;
    }
    activeSessionRef.current = null;
    stopDurationTimer();
    stopCallAudio();

    store.getState().setSipConnection({
      status: SipStatus.DISCONNECTED,
      isConnected: false,
      isRegistered: false,
    });
    store.getState().resetActiveCall();
    store.getState().setIncomingCall(null);
  }, [stopDurationTimer, clearEndDisplayTimer, store]);

  // If we return to the foreground holding an "active" call whose SIP session is
  // gone or whose transport is dead, the far-end BYE was lost while suspended.
  // Reconcile: tear the ghost call down (incl. CallKit via gracefulEnd) before
  // rebuilding the UA, so the phone can never show a call the far end already ended.
  const reconcileStaleCall = useCallback(() => {
    const s = store.getState();
    if (!isActiveCall(s.activeCall)) return;
    const session = activeSessionRef.current;
    const sessionDead =
      session === null ||
      session.state === SessionState.Terminated ||
      session.state === SessionState.Terminating;
    const transportDead = uaRef.current?.transport.isConnected() !== true;
    if (sessionDead || transportDead) {
      dlog(
        `[callend] foreground reconcile: stale call (sessionDead=${sessionDead} transportDead=${transportDead}) → gracefulEnd`,
      );
      gracefulEnd(s.activeCall.direction ?? CallDirection.OUTBOUND);
    }
  }, [store, gracefulEnd]);

  // ---- connect ----
  const connect = useCallback(async () => {
    dlog(
      `[lockcall] connect() called hasUA=${!!uaRef.current} connecting=${isConnectingRef.current} hasConfig=${!!sipConfigRef.current}`,
    );
    // Zombie-UA guard (Android): backgrounding freezes the WebSocket but — unlike
    // iOS, which tears the UA down on background — the UserAgent object survives.
    // With reconnectionAttempts=0 the dead transport never self-heals, and the
    // plain `uaRef.current` guard below then blocks every rebuild: the app looks
    // "connected" (hasUA=true) while every send dies with "Not connected", so the
    // wake push arrives but the INVITE never can. Dispose the corpse and rebuild.
    if (uaRef.current && !isConnectingRef.current && !uaRef.current.transport.isConnected()) {
      dlog('[lockcall] connect(): stale UA with dead transport — disposing + rebuilding');
      const staleUa = uaRef.current;
      uaRef.current = null;
      registererRef.current = null;
      try {
        await staleUa.stop();
      } catch {
        // already dead — expected
      }
    }

    if (uaRef.current || isConnectingRef.current || !sipConfigRef.current) {
      return;
    }

    ensureWebRTCRegistered();

    isConnectingRef.current = true;
    connectionAttemptedRef.current = true;

    try {
      store.getState().setSipConnection({
        status: SipStatus.CONNECTING,
        isConnected: false,
        isRegistered: false,
        error: undefined,
      });

      const sipConfig = sipConfigRef.current;
      const uri = UserAgent.makeURI(sipConfig.sipUri);
      if (!uri) throw new Error('Invalid SIP URI configuration');

      const iceServers = getIceServers(sipConfig);
      // Log URLs only (never the TURN credential) — lets a build with stale env
      // (missing TURN) be spotted straight from the device log.
      dlog(
        '[ice] servers:',
        iceServers
          .map((s) => s.urls)
          .flat()
          .join(' | '),
      );
      // [ice-probe] temporary: verify the TURN ALLOCATE end-to-end and log the
      // exact STUN error code if the server rejects it. Remove once relay works.
      probeIceServers(sipConfig);

      const userAgent = new UserAgent({
        uri,
        transportOptions: {
          server: sipConfig.wsServer,
          connectionTimeout: CALL_TIMING.CONNECTION_TIMEOUT,
          // Keep the socket supervised: CRLF keep-alive detects a dead transport
          // and keeps NAT bindings warm; bounded reconnect recovers a brief WS
          // blip. Bounded (not 0, not infinite) so an unreachable FreeSWITCH
          // can't retry forever and starve the JS thread. A mid-call drop that
          // does not recover in time is torn down by the stateChange grace below.
          keepAliveInterval: CALL_TIMING.WS_KEEPALIVE_INTERVAL,
          reconnectionAttempts: CALL_TIMING.WS_RECONNECT_ATTEMPTS,
          reconnectionDelay: CALL_TIMING.WS_RECONNECT_DELAY,
        },
        authorizationUsername: sipConfig.authUsername,
        authorizationPassword: sipConfig.authPassword,
        sessionDescriptionHandlerFactoryOptions: {
          constraints: {
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: false,
            },
            video: false,
          },
          peerConnectionConfiguration: {
            iceServers,
            iceTransportPolicy: 'all',
            bundlePolicy: 'balanced',
            rtcpMuxPolicy: 'require',
          },
        },
        logLevel: 'error',
      });

      // Mid-call transport-drop recovery. A dropped WS mid-call means a far-end
      // BYE can never arrive; if the socket does not come back within the grace
      // window we tear the call down ourselves (the media-liveness watchdog is
      // the other guard). Hoisted callback keeps nesting within the lint limit.
      let midCallDropTimer: ReturnType<typeof setTimeout> | null = null;
      const clearMidCallDrop = (): void => {
        if (midCallDropTimer) {
          clearTimeout(midCallDropTimer);
          midCallDropTimer = null;
        }
      };
      const onMidCallDropElapsed = (): void => {
        midCallDropTimer = null;
        if (
          isActiveCall(store.getState().activeCall) &&
          uaRef.current?.transport.isConnected() !== true
        ) {
          dlog('[callend] mid-call drop not recovered → gracefulEnd');
          gracefulEnd(store.getState().activeCall.direction ?? CallDirection.OUTBOUND);
        }
      };
      userAgent.transport.stateChange.addListener((state: TransportState) => {
        if (state === TransportState.Connected) {
          clearMidCallDrop();
        }
        if (state === TransportState.Disconnected) {
          // Only write if it actually changed — avoids redundant store
          // updates / re-render churn if the transport flaps.
          if (store.getState().sipConnection.status !== SipStatus.DISCONNECTED) {
            store.getState().setSipConnection({
              status: SipStatus.DISCONNECTED,
              isConnected: false,
              isRegistered: false,
              error: undefined,
            });
          }
          if (isActiveCall(store.getState().activeCall) && !midCallDropTimer) {
            dlog('[callend] transport dropped mid-call — starting recovery grace');
            midCallDropTimer = setTimeout(
              onMidCallDropElapsed,
              CALL_TIMING.MIDCALL_RECONNECT_GRACE,
            );
          }
        }
      });

      userAgent.delegate = {
        onInvite: (invitation: Invitation) => {
          const remoteNumber = invitation.remoteIdentity.uri.user ?? 'Unknown';
          const remoteDisplayName = invitation.remoteIdentity.displayName;
          activeSessionRef.current = invitation;
          // A previous call may still be showing its end-reason; clear it so the
          // two never overlap.
          clearEndDisplayTimer();
          if (store.getState().activeCall.endReason) store.getState().resetActiveCall();
          resetEndReasonCapture();
          captureSessionReason(invitation);

          const callKeepDriven = isCallKeepDriven();
          // The user already tapped Answer on a native surface before this INVITE
          // arrived — iOS CallKit answer, or the Android notification's Answer
          // action (which launches the app and races SIP registration). Consume
          // it once here: it both suppresses the incoming UI and accepts below.
          const pendingAnswer = consumePendingAnswer();
          dlog(
            `[lockcall] onInvite from=${remoteNumber} callKeepDriven=${callKeepDriven} pendingAnswer=${pendingAnswer} +${callBootElapsedMs()}ms`,
          );

          // When the native CallKeep UI is already ringing (iOS lock-screen /
          // killed-app wake) it owns the incoming UI + ringtone; a pending answer
          // skips straight to accept. Otherwise present the call now (JS modal +
          // ringtone — see presentForegroundIncoming). `isCallKeepDriven()` is
          // read live below so the connection is reported to whichever UI ended
          // up owning the call.
          if (!callKeepDriven && !pendingAnswer) {
            presentForegroundIncoming(remoteNumber, remoteDisplayName);
          }

          // Tell FreeSWITCH + the caller that this device is ringing (180 Ringing)
          // so the caller hears ringback and FS marks the agent leg as ringing.
          // sip.js auto-sends 100 Trying but not 180. Skip when a native answer is
          // already queued — we accept immediately below, no ring phase.
          if (!pendingAnswer) {
            invitation.progress().catch(() => {
              // Session may already be cancelled/terminating — harmless.
            });
          }

          let statsTimer: ReturnType<typeof setInterval> | null = null;
          let stopLiveness: (() => void) | null = null;
          // Defined here (not inside the listener) to stay within the lint
          // nesting limit; closes over the same `invitation`.
          const probeInboundAudioStats = () => {
            void logInboundAudioStats(getPeerConnection(invitation));
          };
          // Hoisted (not inline) to stay within the function-nesting lint limit.
          const endInboundCall = () => gracefulEnd(CallDirection.INBOUND);
          invitation.stateChange.addListener((newState: SessionState) => {
            dlog(`[callend] inbound session state -> ${newState}`);
            if (newState === SessionState.Establishing) {
              store.getState().updateActiveCall({ status: CallStatus.CONNECTING });
            }
            if (newState === SessionState.Established) {
              wasEstablishedRef.current = true;
              stopRingtone();
              startCallAudio();
              // [audio-stats] probe the downlink every 3s while established.
              resetAudioStats();
              statsTimer = setInterval(probeInboundAudioStats, 3000);
              store.getState().setActiveCall({
                contactId: null,
                number: remoteNumber,
                displayName: remoteDisplayName,
                status: CallStatus.IN_CALL,
                direction: CallDirection.INBOUND,
                startTime: new Date().toISOString(),
                duration: 0,
                isMuted: false,
                isOnHold: false,
                isRecording: false,
              });
              startDurationTimer();
              // Media-liveness watchdog: end the call if ICE fails or inbound RTP
              // stops, even when a SIP BYE never reaches this (dead) socket.
              stopLiveness = startCallLiveness(invitation, endInboundCall);
              if (isCallKeepDriven()) {
                const uuid = getCallKeepUuid();
                if (uuid) reportCallKeepConnected(uuid);
              }
            }
            if (newState === SessionState.Terminated) {
              if (statsTimer) {
                clearInterval(statsTimer);
                statsTimer = null;
              }
              if (stopLiveness) {
                stopLiveness();
                stopLiveness = null;
              }
              dlog('[callend] inbound Terminated → gracefulEnd');
              gracefulEnd(CallDirection.INBOUND);
            }
          });

          // Replay the native answer intent (consumed above) now the session exists.
          if (pendingAnswer) {
            dlog('[lockcall] onInvite auto-accepting (pendingAnswer)');
            // Dismiss the Android wake notification (no-op if already gone/iOS).
            void cancelIncomingCallNotification();
            // Audio session must reach final config before accept (see
            // acceptIfNativelyAnswered) — the audio unit inits during accept.
            startCallAudio();
            invitation.accept().catch((e: unknown) => {
              dlog('[lockcall] invitation.accept() FAILED:', String(e));
            });
          }

          // iOS cold-start answer fallback (see acceptIfNativelyAnswered).
          if (!pendingAnswer && callKeepDriven && Platform.OS === 'ios') {
            acceptIfNativelyAnswered(invitation);
          }
        },
      };

      await userAgent.start();
      uaRef.current = userAgent;
      dlog(`[lockcall] SIP UA started (transport connected) +${callBootElapsedMs()}ms`);

      // DEBUG: log the first line of every INCOMING SIP frame (INVITE/BYE/CANCEL/
      // 180/200/...) so we can confirm whether FreeSWITCH's BYE actually reaches
      // the phone. Wrap (do not replace) the transport's receive handler so sip.js
      // still parses every message. Remove once the hangup issue is resolved.
      const transport = userAgent.transport;
      const originalOnMessage = transport.onMessage?.bind(transport);
      transport.onMessage = (message: string) => {
        const firstLine = message.split('\r\n', 1)[0];
        dlog(`[callend][sip-rx] ${firstLine}`);
        // [invite-debug] Highlight the INVITE specifically so we can prove
        // whether FreeSWITCH actually delivered it to this socket, separate from
        // BYE/CANCEL/1xx noise. If this line NEVER prints on a failed call, the
        // problem is server-side delivery (stale/ghost sofia_contact); if it
        // prints but no [lockcall] onInvite follows, the problem is on the phone.
        if (firstLine.startsWith('INVITE ')) {
          dlog(`[invite-debug] INVITE received on transport +${callBootElapsedMs()}ms`);
        }
        originalOnMessage?.(message);
      };

      store.getState().setSipConnection({
        status: SipStatus.CONNECTED,
        isConnected: true,
        isRegistered: false,
      });
      isConnectingRef.current = false;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      dlog('[lockcall] SIP connect FAILED:', errorMessage);
      store.getState().setSipConnection({
        status: SipStatus.ERROR,
        isConnected: false,
        isRegistered: false,
        error: errorMessage || 'Cannot connect. Server may be down or unreachable.',
      });
      isConnectingRef.current = false;
      // Keep `connectionAttemptedRef` TRUE so a failed connect does not get
      // silently retried in a loop. A retry is only triggered explicitly when
      // the app returns to the foreground (AppState handler resets the ref).
      connectionAttemptedRef.current = true;
    }
  }, [
    startDurationTimer,
    gracefulEnd,
    clearEndDisplayTimer,
    resetEndReasonCapture,
    captureSessionReason,
    store,
  ]);

  // ---- 403 handler ----
  const handle403Error = useCallback(async () => {
    if (registererRef.current) {
      try {
        await registererRef.current.unregister();
      } catch {
        // ignore
      }
      registererRef.current = null;
    }
    if (uaRef.current) {
      try {
        await uaRef.current.stop();
      } catch {
        // ignore
      }
      uaRef.current = null;
    }
    store.getState().updateSipConnection({
      status: SipStatus.ERROR,
      error: 'Authentication failed. Please check credentials.',
    });
  }, [store]);

  // ---- register ----
  const register = useCallback(async () => {
    if (!uaRef.current || registererRef.current) return;

    try {
      store.getState().updateSipConnection({ status: SipStatus.REGISTERING });
      const newRegisterer = new Registerer(uaRef.current);
      await newRegisterer.register({
        requestDelegate: {
          onReject: (response: { message?: { statusCode?: number; toString?: () => string } }) => {
            const statusCode = response.message?.statusCode;
            const messageStr = response.message?.toString?.() ?? '';
            if (statusCode === 403 || messageStr.includes('403')) {
              void handle403Error();
            }
          },
        },
      });
      registererRef.current = newRegisterer;
      store.getState().updateSipConnection({
        status: SipStatus.REGISTERED,
        isRegistered: true,
      });
      dlog(
        `[lockcall] SIP REGISTERED +${callBootElapsedMs()}ms (backend must hold at least this long)`,
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      dlog('[lockcall] SIP register FAILED:', errorMessage);
      if (errorMessage.toLowerCase().includes('403')) {
        await handle403Error();
        return;
      }
      store.getState().updateSipConnection({
        status: SipStatus.ERROR,
        error: errorMessage || 'Registration failed',
      });
    }
  }, [handle403Error, store]);

  // ---- auto connect ----
  const autoConnect = useCallback(async () => {
    dlog(
      `[lockcall] autoConnect auth=${isAuthenticated} creds=${hasCredentials} hasConfig=${!!sipConfigRef.current} connecting=${isConnectingRef.current} attempted=${connectionAttemptedRef.current}`,
    );
    if (!isAuthenticated || !hasCredentials || !sipConfigRef.current) return;
    const conn = store.getState().sipConnection;
    if (conn.isConnected && conn.isRegistered) return;
    if (isConnectingRef.current || connectionAttemptedRef.current) return;
    try {
      if (!conn.isConnected) {
        await connect();
      } else if (!conn.isRegistered && uaRef.current && !registererRef.current) {
        await register();
      }
    } catch {
      connectionAttemptedRef.current = false;
      isConnectingRef.current = false;
    }
  }, [isAuthenticated, hasCredentials, connect, register, store]);

  // Auto-register once connected.
  useEffect(() => {
    if (
      sipConnection.isConnected &&
      !sipConnection.isRegistered &&
      hasCredentials &&
      uaRef.current &&
      !registererRef.current
    ) {
      void register();
    }
  }, [sipConnection.isConnected, sipConnection.isRegistered, hasCredentials, register]);

  // Cold-start "Connecting…" placeholder watchdog. If the SIP INVITE never lands
  // (registration failed, or the caller already gave up), don't leave the user
  // stuck on the connecting screen. Guarded by the live session ref so it can
  // never tear down a real, in-flight call.
  useEffect(() => {
    if (activeCall.status !== CallStatus.CONNECTING) return;
    if (activeSessionRef.current) return; // real INVITE already bound — its own flow governs
    const timer = setTimeout(() => {
      if (activeSessionRef.current) return;
      if (store.getState().activeCall.status !== CallStatus.CONNECTING) return;
      consumePendingAnswer();
      stopRingback();
      stopCallAudio();
      store.getState().resetActiveCall();
      endCallKeepCall();
    }, CALL_TIMING.CONNECTING_ANSWER_TIMEOUT);
    return () => clearTimeout(timer);
  }, [activeCall.status, store]);

  // Cold-launch ringing-placeholder watchdog. The full-screen incoming launch
  // seeds `incomingCall` before any SIP session exists; if the INVITE never
  // binds (caller gave up, SIP failed), clear it so the ringing screen doesn't
  // hang. Guarded by the live session ref so a real incoming call is untouched.
  useEffect(() => {
    if (!incomingCall) return;
    if (activeSessionRef.current) return; // real INVITE bound — its own flow governs
    const timer = setTimeout(() => {
      if (activeSessionRef.current) return;
      if (store.getState().incomingCall === null) return;
      store.getState().setIncomingCall(null);
      void cancelIncomingCallNotification();
    }, CALL_TIMING.INCOMING_PLACEHOLDER_TIMEOUT);
    return () => clearTimeout(timer);
  }, [incomingCall, store]);

  // Post-register cold-start watchdog. Once REGISTERED, a live incoming call's
  // INVITE arrives within ~1–2s. If a ringing placeholder is showing with no SIP
  // session bound and no INVITE lands within POST_REGISTER_INVITE_TIMEOUT, the
  // call was already torn down server-side before the phone booted (caller hung
  // up) — clear the stuck placeholder. Much tighter than the 65s pre-register
  // safety net. Guarded by the live session ref so a real call is never touched.
  useEffect(() => {
    if (!incomingCall) return;
    if (!sipConnection.isRegistered) return;
    if (activeSessionRef.current) return; // real INVITE bound — its own flow governs
    const timer = setTimeout(() => {
      if (activeSessionRef.current) return;
      if (store.getState().incomingCall === null) return;
      dlog(
        '[callend] post-register watchdog: no INVITE after register — clearing stuck placeholder',
      );
      store.getState().setIncomingCall(null);
      void cancelIncomingCallNotification();
    }, CALL_TIMING.POST_REGISTER_INVITE_TIMEOUT);
    return () => clearTimeout(timer);
  }, [incomingCall, sipConnection.isRegistered, store]);

  // Android: when a call fully ends while the device is still locked (the app was
  // launched over the lock screen just for the call), return to the lock screen
  // rather than stranding the user on the app home. No-op when unlocked.
  const callOnScreen = isActiveCall(activeCall) || incomingCall !== null;
  const prevCallOnScreenRef = useRef(false);
  useEffect(() => {
    const was = prevCallOnScreenRef.current;
    prevCallOnScreenRef.current = callOnScreen;
    if (was && !callOnScreen) moveAppToBackIfLocked();
  }, [callOnScreen]);

  // Auto-connect on auth.
  useEffect(() => {
    if (isAuthenticated && accessToken && hasCredentials) {
      const timer = setTimeout(() => {
        if (!isConnectingRef.current) void autoConnect();
      }, CALL_TIMING.AUTO_CONNECT_DELAY);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, accessToken, hasCredentials, autoConnect]);

  // Disconnect on logout.
  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      if (store.getState().sipConnection.isConnected) {
        void handleDisconnect();
        store.getState().resetCallService();
      }
    }
  }, [isAuthenticated, accessToken, handleDisconnect, store]);

  // ---- AppState: foreground-only lifecycle (replaces web unload guards) ----
  useEffect(() => {
    const appStateRef = { current: AppState.currentState };
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (next === 'background' || next === 'inactive') {
        // OS will suspend us → the SIP socket drops. Stop local timers/tones
        // so nothing dangles; the session terminates naturally.
        stopRingtone();
        stopRingback();
      }
      if (next === 'background') {
        // iOS: a suspended app cannot service the SIP WebSocket, so an INVITE the
        // backend routes over WS while we are backgrounded is lost — no native
        // CallKit (the backend only push-wakes a device it sees as OFFLINE) and
        // no JS screen (we're suspended). Proactively go offline on background so
        // the backend falls back to a VoIP push → CallKit rings the next call.
        // Skip while a call is in progress: CallKit + the VoIP background audio
        // session keep that call alive in the background, and tearing down the UA
        // would drop it. Re-registers on foreground via the `active` branch below.
        const s = store.getState();
        const callBusy = isActiveCall(s.activeCall) || s.incomingCall !== null;
        if (Platform.OS === 'ios' && !callBusy) {
          void handleDisconnect();
        }
      }
      if (/inactive|background/.exec(prev) !== null && next === 'active') {
        // First reconcile any call that died while we were suspended (lost BYE),
        // then bring SIP back up.
        reconcileStaleCall();
        if (isAuthenticated && hasCredentials && !isConnectingRef.current) {
          connectionAttemptedRef.current = false;
          void autoConnect();
        }
      }
    });
    return () => sub.remove();
  }, [isAuthenticated, hasCredentials, autoConnect, handleDisconnect, reconcileStaleCall, store]);

  // ---- imperative call API ----
  const makeCall = useCallback(
    async (number: string, displayName?: string, leadId?: string) => {
      if (!uaRef.current || !sipConfigRef.current) return;

      const current = store.getState().activeCall;
      if (
        current.status !== CallStatus.IDLE &&
        current.status !== CallStatus.ENDED &&
        current.status !== CallStatus.FAILED
      ) {
        return;
      }

      // Microphone permission.
      try {
        const status = await checkMicrophonePermission();
        if (status.denied) {
          store.getState().setShowMicPermissionModal(true);
          return;
        }
        if (status.prompt) {
          try {
            const stream = await mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((t) => t.stop());
          } catch {
            store.getState().setShowMicPermissionModal(true);
            return;
          }
        }
      } catch {
        // permission check failed — let SIP handle it
      }

      try {
        isHangingUpRef.current = false;
        lastHangupTimeRef.current = 0;
        clearEndDisplayTimer(); // cancel any prior call's lingering end display
        resetEndReasonCapture();
        store.getState().setDialerOpen(false);
        store.getState().setPhoneNumber('');

        const formattedNumber = number.startsWith('+') ? number : `+${number}`;
        store.getState().setActiveCall({
          contactId: leadId ?? null,
          number: formattedNumber,
          displayName,
          status: CallStatus.CALLING,
          direction: CallDirection.OUTBOUND,
          startTime: null,
          duration: 0,
          isMuted: false,
          isOnHold: false,
          isRecording: false,
        });
        // Report the outbound call to CallKit so iOS shows the Dynamic Island
        // call pill + a Recents entry. iOS-only (guarded in startCallKeepOutgoing);
        // a no-op on Android, where the JS UI + FGS notification already cover it.
        void startCallKeepOutgoing(newCallUuid(), formattedNumber, displayName);
        // Open the in-call audio session up front (not at Established): the
        // native audio manager only knows the available outputs once it is
        // running, so a speaker/Bluetooth pick made while the call is still
        // dialing would otherwise be dropped on the floor. Idempotent — the
        // Established / CallKit re-entries below become route re-asserts.
        startCallAudio();
        startRingback();

        const sipConfig = sipConfigRef.current;
        const target = `sip:${formattedNumber}@${sipConfig.domain}`;
        const targetUri = UserAgent.makeURI(target);
        if (!targetUri) throw new Error('Invalid target URI for outbound call');

        const inviter = new Inviter(uaRef.current, targetUri);
        captureSessionReason(inviter);

        const onEstablished = () => {
          store.getState().setActiveCall({
            contactId: leadId ?? null,
            number: formattedNumber,
            displayName,
            status: CallStatus.IN_CALL,
            direction: CallDirection.OUTBOUND,
            startTime: new Date().toISOString(),
            duration: 0,
            isMuted: false,
            isOnHold: false,
            isRecording: false,
          });
          startDurationTimer();
        };

        let stopLiveness: (() => void) | null = null;
        // Hoisted (not inline) to stay within the function-nesting lint limit.
        const endOutboundCall = () => gracefulEnd(CallDirection.OUTBOUND);
        inviter.stateChange.addListener((newState: SessionState) => {
          dlog(`[callend] outbound session state -> ${newState}`);
          if (newState === SessionState.Establishing) {
            // INVITE sent, no response yet — still "Calling…" (dialing). "Ringing…"
            // is driven by a real 180/183 provisional response (onProgress below),
            // so the caller's status tracks when the remote actually rings.
            store.getState().updateActiveCall({ status: CallStatus.CALLING });
            // iOS native call screen: flip CallKit to its "connecting" phase too.
            if (isCallKeepDriven()) {
              const uuid = getCallKeepUuid();
              if (uuid) reportCallKeepOutgoingConnecting(uuid);
            }
          }
          if (newState === SessionState.Established) {
            wasEstablishedRef.current = true;
            stopRingback();
            startCallAudio();
            store.getState().updateActiveCall({ status: CallStatus.CONNECTING });
            // iOS: report the outbound call CONNECTED → CallKit starts its native
            // duration timer (Dynamic Island green pill + call screen clock).
            if (isCallKeepDriven()) {
              const uuid = getCallKeepUuid();
              if (uuid) reportCallKeepOutgoingConnected(uuid);
            }
            setTimeout(onEstablished, CALL_TIMING.CALL_CONNECT_DELAY);
            // Media-liveness watchdog (see inbound path).
            stopLiveness = startCallLiveness(inviter, endOutboundCall);
          }
          if (newState === SessionState.Terminated) {
            if (stopLiveness) {
              stopLiveness();
              stopLiveness = null;
            }
            dlog('[callend] outbound Terminated → gracefulEnd');
            gracefulEnd(CallDirection.OUTBOUND);
          }
        });

        // Capture the SIP reject code (busy/no-answer/decline/...) and any Reason
        // header (e.g. LOSE_RACE on a forked leg) for a call that fails before it
        // ever connects. The Terminated handler classifies.
        await inviter.invite({
          requestDelegate: {
            onProgress: (response) => {
              const code = response.message.statusCode ?? 0;
              // 180 Ringing = the remote phone is actually ringing; 183 Session
              // Progress = early media/progress. Advance "Calling…" → "Ringing…"
              // only (never regress a later state if a stray 18x lands after 200).
              if (
                (code === 180 || code === 183) &&
                store.getState().activeCall.status === CallStatus.CALLING
              ) {
                dlog(`[callstatus] outbound provisional ${code} → RINGING`);
                store.getState().updateActiveCall({ status: CallStatus.RINGING });
              }
            },
            onReject: (response) => {
              rejectCodeRef.current = response.message.statusCode ?? null;
              const reasonHeader = response.message.getHeader('reason');
              dlog(
                `[callend] outbound onReject code=${rejectCodeRef.current} reason=${reasonHeader ?? '(none)'}`,
              );
              if (reasonHeader) reasonHeaderRef.current = parseReasonHeader(reasonHeader);
            },
          },
        });
        activeSessionRef.current = inviter;
      } catch {
        stopRingback();
        stopCallAudio();
        store.getState().updateActiveCall({ status: CallStatus.FAILED });
        store.getState().setDialerOpen(false);
      }
    },
    [
      checkMicrophonePermission,
      startDurationTimer,
      gracefulEnd,
      clearEndDisplayTimer,
      resetEndReasonCapture,
      captureSessionReason,
      store,
    ],
  );

  const answerCall = useCallback(async () => {
    const session = activeSessionRef.current;
    dlog(
      `[lockcall] answerCall hasSession=${!!session} isInvitation=${session instanceof Invitation}`,
    );
    if (!session || !(session instanceof Invitation)) {
      // Answered the cold-launch placeholder before the SIP INVITE arrived:
      // queue the answer (auto-accepted in onInvite) and swap the ringing screen
      // for the "Connecting…" screen, mirroring the native-answer cold start.
      if (store.getState().incomingCall !== null) {
        dlog('[lockcall] answerCall: no session yet -> queue pending answer');
        markPendingAnswer();
        store.getState().setIncomingCall(null);
        store.getState().beginConnectingCall();
        void cancelIncomingCallNotification();
      }
      return;
    }

    try {
      const status = await checkMicrophonePermission();
      if (status.denied) {
        store.getState().setShowMicPermissionModal(true);
        return;
      }
      if (status.prompt) {
        try {
          const stream = await mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t) => t.stop());
        } catch {
          store.getState().setShowMicPermissionModal(true);
          return;
        }
      }
    } catch {
      // continue, let SIP handle it
    }

    isHangingUpRef.current = false;
    lastHangupTimeRef.current = 0;
    try {
      // Show "Connecting…" the instant Answer is tapped — before the accept
      // round-trip / Establishing state — so the callee transitions smoothly out
      // of the ringing screen instead of flashing a blank beat. The Established
      // handler then overwrites this with the full call info + "In Call".
      const incoming = store.getState().incomingCall;
      store.getState().setIncomingCall(null);
      store.getState().beginConnectingCall({
        number: incoming?.number,
        displayName: incoming?.displayName,
      });
      // Audio session must reach final config before accept (see
      // acceptIfNativelyAnswered) — the audio unit inits during accept.
      startCallAudio();
      await session.accept();
    } catch {
      stopRingtone();
      stopCallAudio();
    }
  }, [checkMicrophonePermission, store]);

  const hangup = useCallback(async () => {
    const session = activeSessionRef.current;
    const now = Date.now();
    dlog(`[callend] hangup() called hasSession=${!!session} state=${session?.state ?? 'none'}`);
    if (!session) {
      // No SIP session yet, but a cold-launch placeholder may be on screen:
      // the "Connecting…" screen (answer not yet bound) or the ringing screen
      // (full-screen launch, INVITE not yet arrived). Tear it down so End /
      // Decline work before the INVITE lands.
      const st = store.getState();
      if (st.activeCall.status === CallStatus.CONNECTING || st.incomingCall !== null) {
        consumePendingAnswer();
        stopRingtone();
        stopRingback();
        stopCallAudio();
        store.getState().resetActiveCall();
        store.getState().setIncomingCall(null);
        void cancelIncomingCallNotification();
        endCallKeepCall();
      }
      return;
    }
    if (now - lastHangupTimeRef.current < 300) return;
    if (isHangingUpRef.current) return;

    const fallbackDirection = (s: Inviter | Invitation) =>
      store.getState().activeCall.direction ??
      (s instanceof Invitation ? CallDirection.INBOUND : CallDirection.OUTBOUND);

    const sessionState = session.state;
    if (sessionState === SessionState.Terminated || sessionState === SessionState.Terminating) {
      // The session's own Terminated listener drives the end display (gracefulEnd);
      // don't race it with an immediate teardown. Only fall back if nothing is in
      // flight (no listener fired yet and no ending display scheduled).
      if (!endDisplayTimerRef.current && !store.getState().activeCall.endReason) {
        gracefulEnd(fallbackDirection(session));
      }
      return;
    }

    lastHangupTimeRef.current = now;
    isHangingUpRef.current = true;
    localHangupRef.current = true; // this end was user-initiated → "Declined"/"Cancelled"
    const sessionToEnd = activeSessionRef.current;

    // Stop the ringing/ringback tone immediately so End feels instant; the rest
    // of teardown (state reset + end-reason display) is owned by the session's
    // Terminated listener → gracefulEnd, which fires once the BYE/CANCEL lands.
    stopRingtone();
    stopRingback();

    try {
      if (sessionToEnd instanceof Invitation) {
        await hangupInvitation(sessionToEnd);
      } else if (sessionToEnd instanceof Inviter) {
        await hangupInviter(sessionToEnd);
      }
    } catch {
      // ignore — cleanup proceeds via the Terminated listener / fallback below
    } finally {
      // Safety net: if the Terminated listener somehow did not run (no ending
      // display scheduled and state never flipped), drive teardown ourselves so
      // the UI can never get stuck on a dead call.
      if (sessionToEnd && !endDisplayTimerRef.current && !store.getState().activeCall.endReason) {
        gracefulEnd(fallbackDirection(sessionToEnd));
      }
    }
  }, [gracefulEnd, store]);

  const toggleMute = useCallback(() => {
    const session = activeSessionRef.current;
    if (!session || session.state !== SessionState.Established) return;
    const pc = getPeerConnection(session);
    if (!pc) return;
    const audioSender = pc.getSenders().find((s) => s.track?.kind === 'audio');
    if (audioSender?.track) {
      const { track } = audioSender;
      track.enabled = !track.enabled;
      store.getState().updateActiveCall({ isMuted: !track.enabled });
    }
  }, [store]);

  const toggleHold = useCallback(async () => {
    const session = activeSessionRef.current;
    if (!session || session.state !== SessionState.Established) return;
    if (!(session instanceof Inviter || session instanceof Invitation)) return;

    const isOnHold = store.getState().activeCall.isOnHold;
    try {
      if (isOnHold) {
        await session.invite({ sessionDescriptionHandlerModifiers: [] });
        store.getState().updateActiveCall({ isOnHold: false });
      } else {
        await session.invite({ sessionDescriptionHandlerModifiers: [holdModifier] });
        store.getState().updateActiveCall({ isOnHold: true });
      }
    } catch {
      const pc = getPeerConnection(activeSessionRef.current);
      if (pc) {
        pc.getSenders().forEach((s) => {
          if (s.track?.kind === 'audio') s.track.enabled = true;
        });
      }
    }
  }, [store]);

  const sendDtmf = useCallback(
    (digit: string) => {
      const s = store.getState();
      const displayName = s.activeCall.displayName ?? '';
      const number = s.activeCall.number ?? '';

      // FreeSWITCH speed-to-lead: number=0000000000, leadId as display name.
      const isLeadCall = number === '0000000000' && displayName.length > 0;
      if (isLeadCall && (digit === '1' || digit === '2')) {
        const leadId = displayName.trim();
        const agentExtension = getAgentExtension(user);
        const action = digit === '1' ? connectLead : skipLead;
        action(leadId, agentExtension).catch(() => {
          // 404/502 = backend already moved on; dismiss silently
        });
        return;
      }

      const session = activeSessionRef.current;
      if (!session || session.state !== SessionState.Established) return;
      if (session instanceof Inviter || session instanceof Invitation) {
        session
          .info({
            requestOptions: {
              body: {
                contentDisposition: 'render',
                contentType: 'application/dtmf-relay',
                content: `Signal=${digit}\r\nDuration=160`,
              },
            },
          })
          .catch(() => {});
      }
    },
    [store, user],
  );

  // ---- dialer ----
  const openDialer = useCallback(
    (initialNumber?: string) => {
      if (initialNumber) store.getState().setPhoneNumber(initialNumber);
      store.getState().setDialerOpen(true);
    },
    [store],
  );

  const closeDialer = useCallback(() => {
    store.getState().setDialerOpen(false);
    setTimeout(() => store.getState().setPhoneNumber(''), CALL_TIMING.DIALER_CLOSE_DELAY);
  }, [store]);

  // ---- audio route ----
  // Pick an output (earpiece / speaker / bluetooth / wired). Optimistically
  // reflect the choice; the native onAudioDeviceChanged subscription below
  // reconciles to the true route (e.g. if a forced route is unavailable).
  const selectAudioRoute = useCallback((route: AudioRoute) => {
    applyAudioRoute(route);
    setAudioRouteState((prev) => ({ ...prev, selected: route }));
  }, []);

  // True whenever a call occupies the audio session (dialing, ringing, in call).
  // Derived to a boolean on purpose: `activeCall` is a fresh object on every
  // duration tick, which would tear down and re-attach the route subscription
  // once a second.
  const callOwnsAudio = isActiveCall(activeCall) || incomingCall !== null;

  // Track the live route + available outputs while a call is active. The
  // subscription fires on plug/unplug, BT connect, and route switches.
  useEffect(() => {
    if (!callOwnsAudio) return;
    const unsubscribe = subscribeAudioRoutes((state) => {
      setAudioRouteState((prev) => ({
        selected: state.selected,
        // Always offer earpiece + speaker; merge in any extra hardware routes.
        available: Array.from(
          new Set<AudioRoute>([
            AudioRoute.EARPIECE,
            AudioRoute.SPEAKER_PHONE,
            ...prev.available,
            ...state.available,
          ]),
        ),
      }));
    });
    return unsubscribe;
  }, [callOwnsAudio]);

  // Reset to earpiece (the call-start default) when no call is active.
  useEffect(() => {
    if (callOwnsAudio) return;
    setAudioRouteState((prev) =>
      prev.selected === AudioRoute.EARPIECE
        ? prev
        : {
            selected: AudioRoute.EARPIECE,
            available: [AudioRoute.EARPIECE, AudioRoute.SPEAKER_PHONE],
          },
    );
  }, [callOwnsAudio]);

  const handleCloseMicPermissionModal = useCallback(() => {
    store.getState().setShowMicPermissionModal(false);
  }, [store]);

  return {
    // state
    sipConnection,
    activeCall,
    incomingCall,
    audioRoute,
    showMicPermissionModal,
    hasCredentials,
    // imperative API
    makeCall,
    answerCall,
    hangup,
    toggleMute,
    toggleHold,
    selectAudioRoute,
    sendDtmf,
    openDialer,
    closeDialer,
    handleCloseMicPermissionModal,
  };
}

export type CallServiceApi = ReturnType<typeof useCallService>;
