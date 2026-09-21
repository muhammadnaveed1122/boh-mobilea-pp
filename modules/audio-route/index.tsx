/**
 * JS binding for the local `AudioRoutePicker` native module (iOS-only — see
 * ios/AudioRouteModule.swift).
 *
 * Gives JS what iOS otherwise hides: the live output route, an event for every
 * route change (with the system's reason), and the ability to force earpiece /
 * speaker / Bluetooth / wired. Without it JS cannot tell that CallKit or the
 * WebRTC audio unit stole the route back at connect time, let alone restore it.
 *
 * `AudioRoutePickerView` (the system AVRoutePickerView sheet) stays exported for
 * AirPlay-style pickers, but the call screen drives routing through
 * `setNativeRoute` so the app always knows the selected output.
 *
 * Safe to import on every platform: native lookups only run behind the iOS
 * guard and every export degrades to a no-op elsewhere.
 */

import type { ViewProps } from 'react-native';
import { Platform } from 'react-native';
import { requireNativeViewManager, requireOptionalNativeModule } from 'expo-modules-core';

export interface AudioRoutePickerViewProps extends ViewProps {
  /** Glyph color when no external/speaker route is active. */
  tintColor?: string;
  /** Glyph color when a route is active (e.g. speaker / Bluetooth selected). */
  activeTintColor?: string;
}

/** Route keys mirror the JS `AudioRoute` enum (constants/call.ts). */
export interface NativeRouteState {
  /**
   * Why the route changed: `override`, `categoryChange`, `oldDeviceUnavailable`,
   * … Callers use it to tell a stolen route from vanished hardware.
   */
  reason: string;
  selected: string;
  available: string[];
}

/**
 * The native side hands route state over as a JSON string (one primitive type
 * across the bridge, no dictionary-conversion surprises).
 */
interface AudioRouteNativeModule {
  getRouteState: () => string;
  setRoute: (route: string) => Promise<string>;
  ensureCallCategory: () => Promise<string>;
  addListener: (
    event: 'onAudioRouteChanged',
    listener: (payload: { json: string }) => void,
  ) => { remove: () => void };
}

function parseRouteState(json: string | null | undefined): NativeRouteState | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as Partial<NativeRouteState>;
    if (typeof parsed.selected !== 'string') return null;
    return {
      reason: typeof parsed.reason === 'string' ? parsed.reason : 'unknown',
      selected: parsed.selected,
      available: Array.isArray(parsed.available) ? parsed.available : [],
    };
  } catch {
    return null;
  }
}

const NativeView =
  Platform.OS === 'ios'
    ? requireNativeViewManager<AudioRoutePickerViewProps>('AudioRoutePicker')
    : null;

const NativeModule =
  Platform.OS === 'ios'
    ? requireOptionalNativeModule<AudioRouteNativeModule>('AudioRoutePicker')
    : null;

export function AudioRoutePickerView(props: Readonly<AudioRoutePickerViewProps>) {
  if (NativeView === null) return null;
  return <NativeView {...props} />;
}

/** Live route snapshot, or `null` where the native module is absent. */
export function getNativeRouteState(): NativeRouteState | null {
  if (!NativeModule) return null;
  try {
    return parseRouteState(NativeModule.getRouteState());
  } catch {
    return null;
  }
}

/** Force an output. Resolves with the resulting state, or `null` off iOS. */
export async function setNativeRoute(route: string): Promise<NativeRouteState | null> {
  if (!NativeModule) return null;
  try {
    return parseRouteState(await NativeModule.setRoute(route));
  } catch {
    return null;
  }
}

/**
 * Re-assert PlayAndRecord + Bluetooth category options. Needed after another
 * layer (InCallManager, CallKit) resets the category and drops Bluetooth.
 */
export async function ensureNativeCallCategory(): Promise<NativeRouteState | null> {
  if (!NativeModule) return null;
  try {
    return parseRouteState(await NativeModule.ensureCallCategory());
  } catch {
    return null;
  }
}

/**
 * Subscribe to iOS AVAudioSession route changes. Returns an unsubscribe fn; a
 * no-op off iOS.
 */
export function addAudioRouteChangeListener(cb: (payload: NativeRouteState) => void): () => void {
  if (!NativeModule) return () => {};
  try {
    const sub = NativeModule.addListener('onAudioRouteChanged', ({ json }) => {
      const state = parseRouteState(json);
      if (state) cb(state);
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
