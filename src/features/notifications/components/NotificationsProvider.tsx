// Non-visual provider. Owns the realtime + native-push lifecycle, mirroring
// the web NotificationsProvider + SocketContext:
//   - socket connect/disconnect on auth, JWT in handshake auth.token
//   - 'notification'      → prepend + debounced refetch + banner/local-push
//   - 'notification:count'→ debounced refetch
//   - AppState bg→fg      → reconnect + catch-up refetch (mirrors use-permission-sync)
//   - app icon badge kept in sync with the unread count
//   - OS-notification tap (cold + warm) → deep-link via the redirect resolver
//   - Expo push-token registration while push is enabled
//
// Mounted once in app/_layout.tsx inside QueryClientProvider. Renders nothing.

import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import {
  addResponseListener,
  configureForegroundHandler,
  getInitialResponse,
  type NotificationResponse,
  presentLocalNotification,
  setBadgeCount,
  setupAndroidChannel,
} from '@/lib/push-notifications';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth.store';

import { useUnreadCount } from '../hooks/use-unread-count';
import { notificationKeys } from '../hooks/keys';
import { selectUnreadCount, useNotificationsStore } from '../store/notifications.store';
import type { Notification } from '../types';
import { resolveRedirectFromData } from '../utils/resolve-redirect';

const INVALIDATE_DEBOUNCE_MS = 500;

configureForegroundHandler();

function navigateTo(href: string | null): void {
  if (href !== null) {
    router.push(href as never);
  }
}

export function NotificationsProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const qc = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.tokens?.accessToken ?? null);
  const user = useAuthStore((s) => s.user);

  const prependNotification = useNotificationsStore((s) => s.prependNotification);
  const addBanner = useNotificationsStore((s) => s.addBanner);
  const setPage = useNotificationsStore((s) => s.setPage);
  const resetNotifications = useNotificationsStore((s) => s.resetNotifications);
  const unreadCount = useNotificationsStore(selectUnreadCount);

  // Live preference refs so socket handlers read current values without
  // re-subscribing (mirrors web inAppEnabledRef / pushEnabledRef).
  const inAppEnabledRef = useRef(true);
  const pushEnabledRef = useRef(true);
  inAppEnabledRef.current = user?.notificationsEnabled ?? true;
  pushEnabledRef.current = user?.pushNotificationsEnabled ?? true;

  // Keep the unread query alive app-wide (header badge + socket invalidation).
  useUnreadCount();

  // Android channel once.
  useEffect(() => {
    setupAndroidChannel().catch(() => {});
  }, []);

  // Debounced cache invalidation (mirrors web invalidateNotifications: reset
  // to page 1 + invalidate the notifications query tree).
  const invalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const invalidate = useRef(() => {
    if (invalidateTimer.current !== null) {
      clearTimeout(invalidateTimer.current);
    }
    invalidateTimer.current = setTimeout(() => {
      setPage(1);
      qc.invalidateQueries({ queryKey: notificationKeys.all }).catch(() => {});
      invalidateTimer.current = null;
    }, INVALIDATE_DEBOUNCE_MS);
  });

  useEffect(() => {
    return () => {
      if (invalidateTimer.current !== null) {
        clearTimeout(invalidateTimer.current);
      }
    };
  }, []);

  // Socket lifecycle + handlers.
  useEffect(() => {
    if (!isAuthenticated || accessToken === null) {
      disconnectSocket();
      resetNotifications();
      setBadgeCount(0).catch(() => {});
      return;
    }

    const socket = connectSocket(accessToken);

    const onNotification = (notification: Notification): void => {
      prependNotification(notification);
      invalidate.current();
      if (notification.silent) {
        return;
      }
      if (inAppEnabledRef.current) {
        addBanner(notification);
      }
      if (pushEnabledRef.current) {
        presentLocalNotification(notification.title, notification.body, {
          notificationId: notification.id,
          redirectUrl: notification.data?.redirectUrl ?? null,
          category: notification.category,
          conversationId: notification.data?.conversationId ?? null,
          resourceId: notification.data?.resourceId ?? null,
          resourceKind: notification.data?.resourceKind ?? null,
        }).catch(() => {});
      }
    };
    const onCount = (): void => invalidate.current();

    socket.on('notification', onNotification);
    socket.on('notification:count', onCount);

    return () => {
      socket.off('notification', onNotification);
      socket.off('notification:count', onCount);
    };
  }, [isAuthenticated, accessToken, prependNotification, addBanner, resetNotifications]);

  // AppState catch-up: on background→active, reconnect if dropped + refetch
  // so notifications missed while suspended are pulled in (mirrors
  // use-permission-sync).
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const appStateRef = { current: AppState.currentState };
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (/inactive|background/.exec(prev) !== null && next === 'active') {
        const socket = getSocket();
        if (!socket?.connected && accessToken !== null) {
          connectSocket(accessToken);
        }
        invalidate.current();
      }
    });
    return () => sub.remove();
  }, [isAuthenticated, accessToken]);

  // App icon badge follows unread count.
  useEffect(() => {
    setBadgeCount(unreadCount).catch(() => {});
  }, [unreadCount]);

  // Tap handling — warm (listener) + cold start (initial response).
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const handle = (response: NotificationResponse): void => {
      const data = response.notification.request.content.data as
        | {
            redirectUrl?: unknown;
            category?: unknown;
            conversationId?: unknown;
            resourceId?: unknown;
            resourceKind?: unknown;
          }
        | undefined;
      navigateTo(
        resolveRedirectFromData(
          data?.redirectUrl,
          data?.category,
          data?.conversationId,
          data?.resourceId,
          data?.resourceKind,
        ),
      );
    };

    const sub = addResponseListener(handle);
    getInitialResponse()
      .then((res) => {
        if (res !== null) {
          handle(res);
        }
      })
      .catch(() => {});
    return () => sub.remove();
  }, [isAuthenticated]);

  return <>{children}</>;
}

export { resolveRedirect } from '../utils/resolve-redirect';
