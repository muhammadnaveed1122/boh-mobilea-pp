// expo-notifications wrapper. Centralizes permission, token, channel, badge,
// local-present and listener concerns so the NotificationsProvider stays thin.
//
// Foreground policy: OS banner is SUPPRESSED while the app is foregrounded —
// we render our own in-app banner instead (mirrors the web in-app/push split
// and avoids a double notification). Background/killed → OS shows it natively.

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type PushPermissionStatus = 'granted' | 'denied' | 'blocked' | 'undetermined';

const ANDROID_CHANNEL_ID = 'default';

/**
 * `expo-device` is a native module — it is absent until a dev build is made
 * (`expo prebuild` + `expo run:*`). Resolve it optionally so importing this
 * file never hard-crashes Expo Go / a pre-rebuild binary; fall back to a
 * platform heuristic. After a proper rebuild this uses the real value.
 */
function isPhysicalDevice(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Device = require('expo-device') as { isDevice?: boolean };
    return Device.isDevice ?? Platform.OS !== 'web';
  } catch {
    return Platform.OS !== 'web';
  }
}

/**
 * Install the foreground handler. Call once at module/app init (before any
 * notification can arrive). Suppresses the OS banner in foreground; still
 * updates the list + badge so the tray/badge stay correct.
 */
export function configureForegroundHandler(): void {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: false,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: true,
      }),
    });
  } catch {
    /* native module absent until dev build — non-fatal */
  }
}

/** Android requires a channel for heads-up + sound. No-op on iOS. */
export async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

function mapPermission(res: Notifications.NotificationPermissionsStatus): PushPermissionStatus {
  if (res.status === 'granted') return 'granted';
  if (res.status === 'undetermined') return 'undetermined';
  // denied — distinguish "can ask again" from OS-blocked.
  return res.canAskAgain ? 'denied' : 'blocked';
}

export async function getPushPermission(): Promise<PushPermissionStatus> {
  return mapPermission(await Notifications.getPermissionsAsync());
}

/** Requests permission (Android 13+ POST_NOTIFICATIONS handled by the lib). */
export async function requestPushPermission(): Promise<PushPermissionStatus> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return 'granted';
  if (current.status === 'denied' && !current.canAskAgain) return 'blocked';
  return mapPermission(await Notifications.requestPermissionsAsync());
}

/**
 * Returns the Expo push token for this install, or null if unavailable
 * (simulator/emulator without a device, missing projectId, no permission).
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (!isPhysicalDevice()) return null;
  const projectId =
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ??
    (Constants.easConfig as { projectId?: string } | undefined)?.projectId;
  if (projectId === undefined || projectId === '') return null;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}

export function getDevicePlatform(): 'ios' | 'android' | null {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return null;
}

export async function setBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch {
    /* badge unsupported on some platforms — non-fatal */
  }
}

/**
 * Present a local notification immediately. Used when a socket notification
 * arrives while foregrounded AND push is enabled but in-app banners are off
 * (mirrors web `showPushNotification` inside handleIncomingNotification).
 */
export async function presentLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: data ?? {}, sound: 'default' },
    trigger: null,
  });
}

export type NotificationResponse = Notifications.NotificationResponse;

/** Tap on a notification while the app is running (foreground/background). */
export function addResponseListener(
  handler: (response: NotificationResponse) => void,
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

/** Tap that cold-started the app. Call after auth + router are ready. */
export async function getInitialResponse(): Promise<NotificationResponse | null> {
  return Notifications.getLastNotificationResponseAsync();
}

/** Expo push token rotation. */
export function addTokenRotationListener(
  handler: (token: string) => void,
): Notifications.Subscription {
  return Notifications.addPushTokenListener((t) => handler(t.data));
}
