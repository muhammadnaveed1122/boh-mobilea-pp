/**
 * Safe haptics. The iOS Simulator has no Taptic Engine — Core Haptics fails
 * ("hapticpatternlibrary.plist couldn't be opened") on EVERY call, and firing
 * one per dialpad keystroke thrashed the JS/native bridge (severe input lag).
 *
 * `Device.isDevice` is false on simulators/emulators, so we only invoke
 * expo-haptics on real hardware. All calls are fire-and-forget.
 *
 * Keypress uses `impactAsync(Light)`, NOT `selectionAsync()`: the latter's
 * un-prewarmed UISelectionFeedbackGenerator hitched the dialpad on iOS.
 */

import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';

const HAPTICS_ENABLED = Device.isDevice;

export function tapHaptic(): void {
  if (!HAPTICS_ENABLED) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function lightHaptic(): void {
  if (!HAPTICS_ENABLED) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function successHaptic(): void {
  if (!HAPTICS_ENABLED) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
