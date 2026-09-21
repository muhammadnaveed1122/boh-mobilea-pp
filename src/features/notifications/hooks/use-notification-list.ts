import { useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth.store';

import { getNotifications } from '../services';
import { notificationKeys } from './keys';
import { useNotificationsStore } from '../store/notifications.store';

export const NOTIFICATIONS_PAGE_SIZE = 20;

/**
 * Drives the paginated list query off the store's `page` and merges results
 * into the store (replace on page 1, append otherwise) — mirrors the web
 * NotificationsProvider page accumulation.
 */
export function useNotificationList() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const page = useNotificationsStore((s) => s.page);
  const items = useNotificationsStore((s) => s.items);
  const totalCount = useNotificationsStore((s) => s.totalCount);
  const setPage = useNotificationsStore((s) => s.setPage);
  const replacePage1 = useNotificationsStore((s) => s.replacePage1);
  const appendPage = useNotificationsStore((s) => s.appendPage);

  const query = useQuery({
    queryKey: notificationKeys.list(page),
    queryFn: () => getNotifications({ page, limit: NOTIFICATIONS_PAGE_SIZE }),
    enabled: isAuthenticated,
    staleTime: 0,
  });

  useEffect(() => {
    if (!query.data) return;
    const payload = { items: query.data.items, total: query.data.total };
    if (page === 1) {
      replacePage1(payload);
    } else {
      appendPage(payload);
    }
  }, [query.data, page, replacePage1, appendPage]);

  const hasMore = items.length < totalCount;

  const loadMore = useCallback(() => {
    if (hasMore && !query.isFetching) {
      setPage(page + 1);
    }
  }, [hasMore, query.isFetching, page, setPage]);

  return {
    isLoading: query.isLoading && page === 1,
    isFetchingMore: query.isFetching && page > 1,
    hasMore,
    loadMore,
    refetch: query.refetch,
  };
}
