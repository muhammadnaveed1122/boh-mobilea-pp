/**
 * JS binding for the local `IncomingCall` native module (Android-only — see
 * android/src/main/java/expo/modules/incomingcall/IncomingCallModule.kt).
 *
 * IMPORTANT: `requireNativeModule` runs at import time and throws where the
 * native module is absent (iOS, web). Only import this file lazily behind a
 * `Platform.OS === 'android'` guard — the same pattern the FCM services use.
 */

import { NativeModule, requireNativeModule } from 'expo-modules-core';

export type IncomingCallModuleEvents = {
  /** Answer pressed on the notification while a JS runtime was alive. */
  onAnswer: (event: { uuid: string }) => void;
  /** Decline pressed on the notification while a JS runtime was alive. */
  onDecline: (event: { uuid: string }) => void;
};

declare class IncomingCallModule extends NativeModule<IncomingCallModuleEvents> {
  /**
   * Live USE_FULL_SCREEN_INTENT grant state. Android 14+ (API 34) gates this
   * behind a Settings toggle; below 34 it is install-granted, so returns true.
   * Use to avoid re-prompting a user who has already granted it.
   */
  canUseFullScreenIntent(): boolean;
  /** Show the CallStyle ringing notification (loops until resolved). */
  show(uuid: string, callerName: string, handle: string): Promise<void>;
  /** Dismiss by call uuid; stops the ring. */
  cancel(uuid: string): Promise<void>;
  /**
   * If MainActivity is showing over the lock screen (launched for a call), send
   * it to the background so the device returns to the lock screen on call end.
   * No-op when unlocked. Returns true if the app was backgrounded.
   */
  moveToBackIfLocked(): boolean;
  /**
   * Cold-start answer: read-and-clear the Answer extras MainActivity was
   * launched with before JS existed. Returns the call uuid or null.
   */
  consumeAnswerIntent(): string | null;
  /**
   * Cold-start incoming-launch: read-and-clear the caller extras MainActivity
   * was launched with by the incoming-call notification's full-screen / body-tap
   * intent (locked-screen takeover), so JS can show the ringing screen at once.
   * Returns the caller info or null when this was not an incoming-call launch.
   */
  consumeIncomingLaunch(): { uuid: string; name: string | null; handle: string | null } | null;
}

export default requireNativeModule<IncomingCallModule>('IncomingCall');
