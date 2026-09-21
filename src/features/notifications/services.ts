// Notification HTTP layer. Mirrors the web RTK Query endpoints
// (boh-lead-magnet/src/features/notifications/api/notificationsApi.ts) over
// the shared axios apiClient. The response interceptor in src/lib/api.ts
// already unwraps the success envelope, so `data` is the payload directly.

import { apiClient } from '@/lib/api';

import type {
  DevicePlatform,
  Notification,
  NotificationQueryParams,
  PaginatedNotifications,
} from './types';

const BASE = '/api/v1/notifications';

export async function getNotifications(
  params: NotificationQueryParams,
): Promise<PaginatedNotifications> {
  const { data } = await apiClient.get<PaginatedNotifications>(BASE, { params });
  return data;
}

export async function getUnreadCount(): Promise<{ count: number }> {
  const { data } = await apiClient.get<{ count: number }>(`${BASE}/unread-count`);
  return data;
}

export async function markAsRead(id: string): Promise<Notification> {
  const { data } = await apiClient.patch<Notification>(`${BASE}/${id}/read`);
  return data;
}

export async function markAllAsRead(): Promise<{ count: number }> {
  const { data } = await apiClient.patch<{ count: number }>(`${BASE}/read-all`);
  return data;
}

export async function registerDeviceToken(
  token: string,
  platform: DevicePlatform,
  deviceId?: string,
): Promise<void> {
  await apiClient.post(`${BASE}/device-tokens`, { token, platform, deviceId });
}

export async function deleteDeviceToken(token: string): Promise<void> {
  await apiClient.delete(`${BASE}/device-tokens`, { data: { token } });
}

/**
 * Persist the two notification preference flags. Reuses the existing profile
 * endpoint (UpdateProfileDto already accepts both booleans). Caller is
 * responsible for syncing the auth store user afterwards.
 */
export async function updateNotificationPrefs(prefs: {
  notificationsEnabled?: boolean;
  pushNotificationsEnabled?: boolean;
}): Promise<void> {
  await apiClient.patch('/api/v1/auth/profile', prefs);
}
