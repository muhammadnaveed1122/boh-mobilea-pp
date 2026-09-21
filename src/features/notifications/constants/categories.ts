// Category options + labels — ported verbatim from the web app
// (boh-lead-magnet/src/features/notifications/constants/notificationCategories.ts).

import type { NotificationCategory } from '../types';

export const NOTIFICATION_CATEGORY_OPTIONS: {
  value: NotificationCategory | '';
  label: string;
}[] = [
  { value: '', label: 'All' },
  { value: 'leads', label: 'Leads' },
  { value: 'meetings', label: 'Meetings' },
  { value: 'submissions', label: 'Submissions' },
  { value: 'projects', label: 'Projects' },
  { value: 'listings', label: 'Listings' },
  { value: 'developers', label: 'Developers' },
  { value: 'offers', label: 'Offers' },
  { value: 'users-agents', label: 'Users & Agents' },
  { value: 'roles', label: 'Roles' },
  { value: 'system-auth', label: 'System Auth' },
  { value: 'chat', label: 'Chat' },
];

export type NotificationCategoryValue = (typeof NOTIFICATION_CATEGORY_OPTIONS)[number]['value'];

export const NOTIFICATION_CATEGORY_LABEL: Record<NotificationCategory, string> = {
  leads: 'Leads',
  meetings: 'Meetings',
  submissions: 'Submissions',
  projects: 'Projects',
  listings: 'Listings',
  developers: 'Developers',
  offers: 'Offers',
  'users-agents': 'Users & Agents',
  roles: 'Roles',
  'system-auth': 'System Auth',
  chat: 'Chat',
};
