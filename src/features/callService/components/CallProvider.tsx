/**
 * CallProvider — non-visual orchestrator. Mounted once in `app/_layout.tsx`.
 *
 * - Owns the single `useCallService()` instance (SIP UserAgent + lifecycle).
 * - Registers the imperative controller singleton so lead components and the
 *   dialpad can start calls without being in this render subtree (the RN
 *   analogue of web's `window.makeGlobalCall`).
 * - Renders the global full-screen call overlays (incoming / active) above
 *   every route, plus the post-call outcome + mic-permission modals.
 */

import { useEffect } from 'react';
import { Modal } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/auth.store';

import { resetCallController, setCallController } from '../services/call-controller';
import {
  consumeColdStartAnswer,
  consumeIncomingCallLaunch,
  registerIncomingCallListeners,
} from '../services/android-incoming-notification';
import { registerCallForegroundHandler } from '../services/fcm-call-messaging';
import { maybePromptFullScreenIntent } from '../services/full-screen-intent';
import { isActiveCall, useCallStore } from '../store/call.store';
import { useCallService } from '../hooks/use-call-service';
import { useCallKeepBridge } from '../hooks/use-callkeep-bridge';
import { useRegisterCallToken } from '../hooks/use-register-call-token';
import { ActiveCallScreen } from './ActiveCallScreen';
import { CallOutcomeModal } from './CallOutcomeModal';
import { IncomingCallScreen } from './IncomingCallScreen';
import { MicPermissionDialog } from './MicPermissionDialog';
import { MinimizedCallBar } from './MinimizedCallBar';

export function CallProvider({ children }: Readonly<{ children?: React.ReactNode }>) {
  const call = useCallService();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isCallMinimized = useCallStore((s) => s.isCallMinimized);
  const setCallMinimized = useCallStore((s) => s.setCallMinimized);
  // Measured here under the root SafeAreaProvider; the call screens live inside a
  // full-screen Modal whose own SafeAreaProvider reports 0 top inset.
  const insets = useSafeAreaInsets();

  // Register this device's call-wake push token (Android FCM / iOS PushKit VoIP)
  // with the calling backend, and bridge the native CallKeep UI (lock screen /
  // killed-app wake) into the same controller the in-app UI uses. Both are no-ops
  // without the backend, so they are always mounted here alongside the brain.
  useRegisterCallToken(isAuthenticated);
  useCallKeepBridge();

  // Foreground FCM call pushes: setBackgroundMessageHandler only fires when the
  // app is backgrounded/killed, so an incoming-call push arriving while the app
  // is open needs this onMessage listener to ring. Android-only no-op elsewhere;
  // detaches on unmount.
  useEffect(() => registerCallForegroundHandler(), []);

  // Android: Answer/Decline presses on the native CallStyle notification.
  // Cold-start answers (app was killed; Answer launched MainActivity) are read
  // from the launch intent once; live presses arrive as module events.
  useEffect(() => {
    // Cold start: was the app launched by the incoming-call notification? Answer
    // button → auto-accept + connecting screen; full-screen / body tap → show the
    // ringing screen now. Only one fires (distinct launch extras).
    consumeColdStartAnswer();
    consumeIncomingCallLaunch();
    return registerIncomingCallListeners();
  }, []);

  // Android 14+: one-time prompt to allow full-screen incoming calls on the lock
  // screen (USE_FULL_SCREEN_INTENT runtime grant). No-op elsewhere / once shown.
  useEffect(() => {
    if (isAuthenticated) void maybePromptFullScreenIntent();
  }, [isAuthenticated]);

  const {
    makeCall,
    openDialer,
    answerCall,
    hangup,
    toggleMute,
    toggleHold,
    selectAudioRoute,
    sendDtmf,
  } = call;

  // Keep the controller singleton pointed at the live handlers. Async brain
  // handlers are wrapped so callers (lead components, dialpad) are pure
  // fire-and-forget and never see a floating promise.
  useEffect(() => {
    setCallController({
      makeCall: (n, d, l) => {
        makeCall(n, d, l).catch(() => {});
      },
      openDialer,
      answerCall: () => {
        answerCall().catch(() => {});
      },
      hangup: () => {
        hangup().catch(() => {});
      },
      toggleMute,
      toggleHold: () => {
        toggleHold().catch(() => {});
      },
      selectAudioRoute,
      sendDtmf,
    });
    return () => resetCallController();
  }, [
    makeCall,
    openDialer,
    answerCall,
    hangup,
    toggleMute,
    toggleHold,
    selectAudioRoute,
    sendDtmf,
  ]);

  const callActive = isActiveCall(call.activeCall);
  // During the brief post-call window the status is terminal (so callActive is
  // false) but endReason is set — keep the full-screen call UI mounted so it can
  // show the reason ("Busy", "No answer", "Call ended") before it dismisses.
  const callEnding = call.activeCall.endReason != null;
  const showCallScreen = callActive || callEnding;
  const showIncoming = call.incomingCall !== null && !showCallScreen;

  return (
    <>
      {children}

      {/* Mount the call Modals only when needed — two always-on full-screen
          RN Modal hosts add render/gesture overhead app-wide. */}
      {showIncoming && call.incomingCall ? (
        <Modal
          visible
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => {
            hangup().catch(() => {});
          }}
        >
          <SafeAreaProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <IncomingCallScreen
                incomingCall={call.incomingCall}
                onAnswer={() => {
                  answerCall().catch(() => {});
                }}
                onDecline={() => {
                  hangup().catch(() => {});
                }}
              />
            </GestureHandlerRootView>
          </SafeAreaProvider>
        </Modal>
      ) : null}

      {showCallScreen && !isCallMinimized ? (
        <Modal
          visible
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => {
            // Hardware back / swipe-down dismisses to the minimized bar rather
            // than ending the call — matches WhatsApp/Telegram. (No-op-ish during
            // the ending window: the call card auto-dismisses shortly.)
            setCallMinimized(true);
          }}
        >
          {/* fullScreen Modal renders in a separate native window outside the
              root SafeAreaProvider, so safe-area insets resolve to 0 in here
              (clipping the top-left Minimize button under the status bar).
              Re-establish a provider scoped to the modal window. */}
          <SafeAreaProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <ActiveCallScreen
                activeCall={call.activeCall}
                audioRoute={call.audioRoute}
                onToggleMute={toggleMute}
                onToggleHold={() => {
                  toggleHold().catch(() => {});
                }}
                onSelectAudioRoute={selectAudioRoute}
                onSendDtmf={sendDtmf}
                onHangup={() => {
                  hangup().catch(() => {});
                }}
                onMinimize={() => setCallMinimized(true)}
                topInset={insets.top}
              />
            </GestureHandlerRootView>
          </SafeAreaProvider>
        </Modal>
      ) : null}

      {callActive && isCallMinimized ? (
        <MinimizedCallBar
          activeCall={call.activeCall}
          onExpand={() => setCallMinimized(false)}
          onToggleMute={toggleMute}
          onHangup={() => {
            hangup().catch(() => {});
          }}
        />
      ) : null}

      <CallOutcomeModal />

      <MicPermissionDialog
        visible={call.showMicPermissionModal}
        onClose={call.handleCloseMicPermissionModal}
      />
    </>
  );
}
