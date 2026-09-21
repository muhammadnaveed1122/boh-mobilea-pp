// Zustand store — translation of the web app's two Redux slices
// (notificationsSlice + notificationBannersSlice) into one store. Action
// semantics are ported verbatim (dedupe-by-id, totalCount bookkeeping).
//
// Server state (the paginated list) lives in TanStack Query; this store holds
// the merged/optimistic view + the in-app banner queue + the last server-side
// unread count (used as a fallback when the list isn't loaded — mirrors the
// web NotificationsProvider `resolvedUnreadCount`).

import { create } from 'zustand';

import type { Notification } from '../types';

export interface NotificationBannerItem {
  id: string;
  notification: Notification;
  exiting: boolean;
}

interface NotificationsState {
  items: Notification[];
  totalCount: number;
  page: number;
  serverUnreadCount: number;
  banners: NotificationBannerItem[];

  setPage: (page: number) => void;
  setServerUnreadCount: (count: number) => void;
  replacePage1: (payload: { items: Notification[]; total: number }) => void;
  appendPage: (payload: { items: Notification[]; total: number }) => void;
  prependNotification: (n: Notification) => void;
  markOneRead: (id: string) => void;
  markAllRead: () => void;
  resetNotifications: () => void;

  addBanner: (n: Notification) => void;
  startExitBanner: (id: string) => void;
  removeBanner: (id: string) => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  items: [],
  totalCount: 0,
  page: 1,
  serverUnreadCount: 0,
  banners: [],

  setPage: (page) => set({ page }),
  setServerUnreadCount: (serverUnreadCount) => set({ serverUnreadCount }),

  replacePage1: ({ items, total }) => set({ items, totalCount: total }),

  appendPage: ({ items, total }) =>
    set((s) => {
      const existing = new Set(s.items.map((n) => n.id));
      const merged = [...s.items, ...items.filter((n) => !existing.has(n.id))];
      return { items: merged, totalCount: total };
    }),

  prependNotification: (n) =>
    set((s) => {
      if (s.items.some((x) => x.id === n.id)) return s;
      return { items: [n, ...s.items], totalCount: s.totalCount + 1 };
    }),

  markOneRead: (id) =>
    set((s) => ({
      items: s.items.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    })),

  markAllRead: () => set((s) => ({ items: s.items.map((n) => ({ ...n, isRead: true })) })),

  resetNotifications: () =>
    set({ items: [], totalCount: 0, page: 1, serverUnreadCount: 0, banners: [] }),

  addBanner: (n) =>
    set((s) => ({
      banners: [...s.banners, { id: n.id, notification: n, exiting: false }],
    })),

  startExitBanner: (id) =>
    set((s) => ({
      banners: s.banners.map((b) => (b.id === id ? { ...b, exiting: true } : b)),
    })),

  removeBanner: (id) => set((s) => ({ banners: s.banners.filter((b) => b.id !== id) })),
}));

/**
 * Resolved unread count — mirrors web: derive from loaded items, fall back to
 * the server count when the list hasn't been fetched yet.
 */
export function selectUnreadCount(s: NotificationsState): number {
  if (s.items.length === 0) return s.serverUnreadCount;
  return s.items.filter((n) => !n.isRead).length;
}
