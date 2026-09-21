import { useCallback, useMemo, useState } from 'react';

import { useDebouncedValue } from '@/lib/use-debounced-value';

import { NOTIFICATION_CATEGORY_OPTIONS } from '../constants/categories';
import { useNotificationsStore } from '../store/notifications.store';
import type { Notification } from '../types';
import { useMarkAllRead, useMarkRead } from './use-mark-read';
import { useNotificationList } from './use-notification-list';
import { useUnreadCount } from './use-unread-count';

export type NotificationTab = 'all' | 'unread';

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Ported verbatim from the web getDateGroupLabel.
export function getDateGroupLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const notifDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - notifDate.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays >= 2 && diffDays < 7) return `${String(diffDays)} days ago`;
  if (diffDays >= 7 && diffDays < 14) return '1 week ago';
  if (diffDays >= 14 && diffDays < 21) return '2 weeks ago';
  if (diffDays >= 21 && diffDays < 28) return '3 weeks ago';
  if (diffDays >= 28 && diffDays < 60) return '1 month ago';
  return notifDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Screen-facing aggregator. Mirrors the web `useNotifications`: list query +
 * unread count + optimistic mark mutations + tab/search/category/date filters
 * + date grouping. Search is debounced 300ms.
 */
export function useNotifications() {
  const items = useNotificationsStore((s) => s.items);
  const unreadCount = useUnreadCount();
  const { isLoading, isFetchingMore, hasMore, loadMore } = useNotificationList();
  const markReadMutation = useMarkRead();
  const markAllReadMutation = useMarkAllRead();

  const [activeTab, setActiveTab] = useState<NotificationTab>('all');
  const [searchInput, setSearchInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const filteredNotifications = useMemo(() => {
    let result = [...items];

    if (activeTab === 'unread') {
      result = result.filter((n) => !n.isRead);
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q) ||
          n.category.toLowerCase().includes(q),
      );
    }
    if (categoryFilter) {
      result = result.filter((n) => n.category === categoryFilter);
    }
    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      result = result.filter((n) => isSameCalendarDay(new Date(n.createdAt), filterDate));
    }
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  }, [items, activeTab, debouncedSearch, categoryFilter, dateFilter]);

  const groupedByDate = useMemo(() => {
    const groups: { label: string; items: Notification[] }[] = [];
    let currentLabel = '';
    for (const n of filteredNotifications) {
      const label = getDateGroupLabel(new Date(n.createdAt));
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, items: [] });
      }
      groups[groups.length - 1]?.items.push(n);
    }
    return groups;
  }, [filteredNotifications]);

  const markAsRead = useCallback(
    (id: string) => {
      markReadMutation.mutate(id);
    },
    [markReadMutation],
  );

  const markAllAsRead = useCallback(() => {
    markAllReadMutation.mutate();
  }, [markAllReadMutation]);

  return {
    notifications: filteredNotifications,
    groupedByDate,
    activeTab,
    setActiveTab,
    searchInput,
    setSearchInput,
    categoryFilter,
    setCategoryFilter,
    dateFilter,
    setDateFilter,
    markAsRead,
    markAllAsRead,
    unreadCount,
    categoryOptions: NOTIFICATION_CATEGORY_OPTIONS,
    isLoading,
    isFetchingMore,
    hasMore,
    loadMore,
  };
}
