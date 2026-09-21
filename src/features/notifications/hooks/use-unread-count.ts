import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth.store';

import { getUnreadCount } from '../services';
import { notificationKeys } from './keys';
import { selectUnreadCount, useNotificationsStore } from '../store/notifications.store';

/**
 * Keeps the server unread count in the store and returns the resolved count
 * (derived from loaded items, falling back to the server value).
 */
export function useUnreadCount(): number {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setServerUnreadCount = useNotificationsStore((s) => s.setServerUnreadCount);
  const resolved = useNotificationsStore(selectUnreadCount);

  const query = useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: getUnreadCount,
    enabled: isAuthenticated,
    staleTime: 0,
  });

  useEffect(() => {
    if (query.data) {
      setServerUnreadCount(query.data.count);
    }
  }, [query.data, setServerUnreadCount]);

  return resolved;
}
