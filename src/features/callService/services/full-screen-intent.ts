/**
 * Android 14+ (API 34) `USE_FULL_SCREEN_INTENT` runtime grant.
 *
 * The permission is declared in app.json, but on Android 14+ it is NOT auto-granted
 * for every app — without it a locked-screen incoming call degrades from the
 * full-screen CallKeep UI to a heads-up banner (still rings + tappable, just not
 * full-screen). The OS only lets the USER toggle the grant in Settings; no app can
 * grant it itself. So the complete client-side handling is:
 *   1. a one-time prompt that deep-links to the exact Settings screen, and
 *   2. `openFullScreenIntentSettings()` for an always-available manual entry.
 *
 * The local IncomingCall native module exposes `canUseFullScreenIntent()`, so we
 * gate the prompt on the LIVE grant state: an already-granted user is never asked
 * again (the AsyncStorage "prompted once" flag is a secondary guard for the
 * not-yet-granted case). No-op on iOS and on Android < 14 (there the manifest
 * permission is granted at install).
 */

import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';

const PROMPTED_KEY = 'callService.fullScreenIntentPrompted.v1';
const ANDROID_14 = 34;
// android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT — requires `package:` data.
const ACTION_MANAGE_FULL_SCREEN_INTENT = 'android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT';
const ACTION_APP_NOTIFICATION_SETTINGS = 'android.settings.APP_NOTIFICATION_SETTINGS';
const ACTION_APP_DETAILS_SETTINGS = 'android.settings.APPLICATION_DETAILS_SETTINGS';
const EXTRA_APP_PACKAGE = 'android.provider.extra.APP_PACKAGE';
// Launching a Settings activity from the JS bridge can resolve against the
// application context (no foreground task), which throws without NEW_TASK.
const FLAG_ACTIVITY_NEW_TASK = 0x10000000;

function androidPackage(): string {
  return Constants.expoConfig?.android?.package ?? 'com.rhkproperties.mobile';
}

function isAndroid14Plus(): boolean {
  return Platform.OS === 'android' && Number(Platform.Version) >= ANDROID_14;
}

/**
 * Live USE_FULL_SCREEN_INTENT grant state via the local native module. Lazily
 * required behind the Android guard — the module throws at import on iOS/web.
 * Defaults to `false` (i.e. "may still need to prompt") if the module is absent
 * or throws, so we never suppress the prompt on a false negative.
 */
export function hasFullScreenIntentGrant(): boolean {
  if (Platform.OS !== 'android') return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const IncomingCall = require('../../../../modules/incoming-call').default;
    return IncomingCall.canUseFullScreenIntent() === true;
  } catch {
    return false;
  }
}

/**
 * Open the system "Full-screen notifications" settings screen for this app.
 * Android 14+ only; safe no-op elsewhere. Use for a manual settings entry.
 *
 * `MANAGE_APP_USE_FULL_SCREEN_INTENT` is the exact target, but it is missing on
 * some OEM builds and throws `ActivityNotFoundException`. We fall back to the
 * app notification settings, then to the app details page, so the button always
 * lands the user *somewhere* they can grant the permission instead of silently
 * doing nothing.
 */
export async function openFullScreenIntentSettings(): Promise<void> {
  if (!isAndroid14Plus()) return;

  const pkg = androidPackage();
  const attempts: { action: string; params: IntentLauncher.IntentLauncherParams }[] = [
    {
      action: ACTION_MANAGE_FULL_SCREEN_INTENT,
      params: { data: `package:${pkg}`, flags: FLAG_ACTIVITY_NEW_TASK },
    },
    {
      action: ACTION_APP_NOTIFICATION_SETTINGS,
      params: { extra: { [EXTRA_APP_PACKAGE]: pkg }, flags: FLAG_ACTIVITY_NEW_TASK },
    },
    {
      action: ACTION_APP_DETAILS_SETTINGS,
      params: { data: `package:${pkg}`, flags: FLAG_ACTIVITY_NEW_TASK },
    },
  ];

  for (const { action, params } of attempts) {
    try {
      await IntentLauncher.startActivityAsync(action, params);
      return;
    } catch {
      // This Settings activity is unavailable on this OEM build — try the next.
    }
  }
}

/**
 * Show the one-time explainer + deep-link to enable full-screen incoming calls.
 * Idempotent across launches (AsyncStorage flag). Call after the user is
 * authenticated and known to have a calling extension.
 */
export async function maybePromptFullScreenIntent(): Promise<void> {
  if (!isAndroid14Plus()) return;
  // Already granted → never ask again, regardless of the prompted flag.
  if (hasFullScreenIntentGrant()) return;
  try {
    if (await AsyncStorage.getItem(PROMPTED_KEY)) return;
    // Mark first so a dismissed prompt is not re-shown every launch.
    await AsyncStorage.setItem(PROMPTED_KEY, 'true');
  } catch {
    // Storage unavailable — fall through and prompt once this session.
  }

  Alert.alert(
    'Allow full-screen calls',
    'To see incoming calls full-screen on your lock screen, allow full-screen notifications for RHK Properties.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open settings', onPress: () => void openFullScreenIntentSettings() },
    ],
  );
}
