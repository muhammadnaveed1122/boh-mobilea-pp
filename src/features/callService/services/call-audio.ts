/**
 * Native audio session — wraps `react-native-incall-manager`, replacing the
 * web `<audio>` elements (remote audio, ringtone, outbound ringback).
 *
 * `react-native-webrtc` auto-plays the remote track through the active audio
 * session; InCallManager owns the proximity sensor and ring/ringback tones.
 * Every public fn is best-effort and never throws so it is safe to call from
 * SIP terminal paths.
 *
 * ROUTING
 * Android: InCallManager `chooseAudioRoute` / `onAudioDeviceChanged`.
 * iOS: the local `modules/audio-route` native module — InCallManager can only
 * force the speaker there, and it cannot report the live route at all. Four
 * layers fight over the iOS route (InCallManager, CallKit via RNCallKeep, the
 * WebRTC audio unit, the user), and the last three all re-set the session
 * category at connect time, which cancels the user's output override. So the
 * user's pick is remembered here and re-asserted whenever the system reports a
 * route change that drifted off it.
 */

import { DeviceEventEmitter, Platform } from 'react-native';
import InCallManager from 'react-native-incall-manager';

import { AudioRoute } from '../constants';
import {
  addAudioRouteChangeListener,
  ensureNativeCallCategory,
  getNativeRouteState,
  type NativeRouteState,
  setNativeRoute,
} from '../../../../modules/audio-route';

let audioSessionActive = false;

/**
 * The output the user explicitly picked for the *current* call, or `null` when
 * they have not touched the control. Kept here (not in React state) because
 * `startCallAudio` runs from non-React paths (CallKit events, SIP listeners)
 * and must be able to re-assert the choice.
 *
 * `null` deliberately means "leave the platform default alone": forcing
 * earpiece at call start also cancels the automatic switch to a connected
 * Bluetooth / wired headset.
 */
let userSelectedRoute: AudioRoute | null = null;

/**
 * Re-assert attempts left for the current call. Bounded so a route the hardware
 * refuses cannot turn into an endless force → routeChange → force loop.
 */
const REASSERT_BUDGET = 8;
const REASSERT_DELAY_MS = 300;
let reassertBudget = 0;
let reassertTimer: ReturnType<typeof setTimeout> | null = null;

function toAudioRoute(value: string | undefined): AudioRoute | null {
  return Object.values(AudioRoute).includes(value as AudioRoute) ? (value as AudioRoute) : null;
}

/**
 * Re-assert the user's chosen output. No-op while they have not picked one, so
 * the platform's own default (headset > Bluetooth > earpiece) still wins.
 */
function applyUserRoute(): void {
  if (userSelectedRoute === null) return;
  if (Platform.OS === 'ios') {
    void setNativeRoute(userSelectedRoute);
    return;
  }
  InCallManager.chooseAudioRoute(userSelectedRoute).catch(() => {
    // routing is best-effort
  });
}

/**
 * The route drifted off the user's pick (a category change from CallKit / the
 * WebRTC audio unit cancels the output override). Re-apply shortly after, so
 * the re-assert lands once the layer that reconfigured the session has
 * finished, instead of racing it.
 */
function scheduleReassert(): void {
  if (reassertTimer !== null) return;
  if (reassertBudget <= 0) return;
  reassertBudget -= 1;
  reassertTimer = setTimeout(() => {
    reassertTimer = null;
    applyUserRoute();
  }, REASSERT_DELAY_MS);
}

function cancelReassert(): void {
  if (reassertTimer !== null) {
    clearTimeout(reassertTimer);
    reassertTimer = null;
  }
}

/**
 * Begin the in-call audio session + proximity sensor.
 *
 * Called from several points of a single call (dial, answer, SIP Established,
 * CallKit `didActivateAudioSession`), so every call after the first must be
 * non-destructive: the native `start()` is already idempotent, and re-forcing
 * a route here is what used to drop the user's speaker / Bluetooth pick back
 * to the earpiece the moment the call connected.
 */
export function startCallAudio(): void {
  try {
    if (audioSessionActive) {
      // Session already configured for this call — only keep the route honest.
      applyUserRoute();
      return;
    }
    InCallManager.start({ media: 'audio', auto: true });
    InCallManager.startProximitySensor();
    audioSessionActive = true;
    reassertBudget = REASSERT_BUDGET;
    // InCallManager's iOS start() sets PlayAndRecord with *no* options, which
    // drops Bluetooth from the eligible ports. Put the options back.
    if (Platform.OS === 'ios') void ensureNativeCallCategory();
    applyUserRoute();
  } catch {
    // Native audio session unavailable — call can still proceed silently.
  }
}

/** Snapshot of the current output route + what the user can switch to. */
export interface AudioRouteState {
  selected: AudioRoute;
  available: AudioRoute[];
}

function parseAndroidRoutes(list: unknown): AudioRoute[] {
  if (typeof list !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(list);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r): r is AudioRoute =>
      Object.values(AudioRoute).includes(r as AudioRoute),
    );
  } catch {
    return [];
  }
}

/**
 * Switch the live call's audio output.
 * Android: `chooseAudioRoute` covers earpiece/speaker/bluetooth/wired.
 * iOS: the native module overrides the output port (speaker) or sets the
 * preferred input (Bluetooth / wired), which is what actually moves the route.
 */
export function setAudioRoute(route: AudioRoute): void {
  // Remembered for the rest of the call so the later startCallAudio() re-entries
  // (SIP Established / CallKit audio-session activation) and the drift healer
  // re-apply it instead of leaving the output reset.
  userSelectedRoute = route;
  reassertBudget = REASSERT_BUDGET;
  cancelReassert();
  try {
    applyUserRoute();
  } catch {
    // ignore — routing is best-effort
  }
}

/**
 * A route change that drifted off the user's pick means another layer stole the
 * output — re-assert it. The exception is the pick's own hardware going away
 * (headset unplugged, Bluetooth link dropped): there is nothing to restore, so
 * forget the choice and follow the platform default again.
 */
function reconcileRoute(selected: AudioRoute, reason: string): void {
  if (userSelectedRoute === null || selected === userSelectedRoute) return;
  if (reason === 'oldDeviceUnavailable') {
    userSelectedRoute = null;
    cancelReassert();
    return;
  }
  scheduleReassert();
}

/** iOS: translate a native snapshot into the shared state shape. */
function toRouteState(payload: NativeRouteState): AudioRouteState {
  const available = payload.available.map(toAudioRoute).filter((r): r is AudioRoute => r !== null);
  return {
    selected: toAudioRoute(payload.selected) ?? AudioRoute.EARPIECE,
    available: available.length > 0 ? available : [AudioRoute.EARPIECE, AudioRoute.SPEAKER_PHONE],
  };
}

function subscribeIosRoutes(cb: (state: AudioRouteState) => void): () => void {
  const initial = getNativeRouteState();
  if (initial) cb(toRouteState(initial));
  return addAudioRouteChangeListener((payload) => {
    const state = toRouteState(payload);
    cb(state);
    reconcileRoute(state.selected, payload.reason);
  });
}

/**
 * Subscribe to audio-device changes (plug/unplug headset, BT connect, route
 * switch). Fires once on attach with the current state where the platform
 * supports it. Returns an unsubscribe fn.
 */
export function subscribeAudioRoutes(cb: (state: AudioRouteState) => void): () => void {
  if (Platform.OS === 'ios') return subscribeIosRoutes(cb);
  if (Platform.OS !== 'android') return () => {};
  const sub = DeviceEventEmitter.addListener(
    'onAudioDeviceChanged',
    (data: { availableAudioDeviceList?: unknown; selectedAudioDevice?: unknown }) => {
      const available = parseAndroidRoutes(data.availableAudioDeviceList);
      const selected = toAudioRoute(String(data.selectedAudioDevice)) ?? AudioRoute.EARPIECE;
      cb({ selected, available });
      // Android reports the device list with the event, so a pick that vanished
      // from it is the unplugged-hardware case.
      reconcileRoute(
        selected,
        userSelectedRoute !== null && !available.includes(userSelectedRoute)
          ? 'oldDeviceUnavailable'
          : 'routeChange',
      );
    },
  );
  return () => sub.remove();
}

/** Tear down the audio session. MUST run in every call terminal path. */
export function stopCallAudio(): void {
  try {
    cancelReassert();
    reassertBudget = 0;
    InCallManager.stopRingtone();
    InCallManager.stopRingback();
    InCallManager.stopProximitySensor();
    if (audioSessionActive) {
      InCallManager.stop();
      audioSessionActive = false;
    }
    // The route choice is per-call — the next call starts on the default again.
    userSelectedRoute = null;
  } catch {
    // ignore teardown errors
  }
}

/** Incoming-call ringtone. */
export function startRingtone(): void {
  try {
    InCallManager.startRingtone('_DEFAULT_', 1, 'playback', 30);
  } catch {
    // ignore
  }
}

export function stopRingtone(): void {
  try {
    InCallManager.stopRingtone();
  } catch {
    // ignore
  }
}

/** Outbound ringback (heard by the caller while the far end rings). */
export function startRingback(): void {
  try {
    InCallManager.startRingback('_DEFAULT_');
  } catch {
    // ignore
  }
}

export function stopRingback(): void {
  try {
    InCallManager.stopRingback();
  } catch {
    // ignore
  }
}
