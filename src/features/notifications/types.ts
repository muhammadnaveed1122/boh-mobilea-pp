// Notification domain types — ported verbatim from the web app
// (boh-lead-magnet/src/features/notifications/models/notification.ts).
// MUST stay 1:1 with the backend payload + web model. Do not drift.

export type NotificationCategory =
  | 'leads'
  | 'meetings'
  | 'submissions'
  | 'projects'
  | 'listings'
  | 'developers'
  | 'offers'
  | 'users-agents'
  | 'roles'
  | 'system-auth'
  | 'chat';

export interface NotificationData {
  redirectUrl?: string;
  actorName?: string;
  actorAvatarUrl?: string;
  conversationId?: string;
  [key: string]: unknown;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: NotificationCategory;
  title: string;
  body: string;
  data: NotificationData | null;
  silent: boolean;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface PaginatedNotifications {
  items: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface NotificationQueryParams {
  page?: number;
  limit?: number;
  isRead?: boolean;
  category?: NotificationCategory;
}

export type DevicePlatform = 'ios' | 'android';
