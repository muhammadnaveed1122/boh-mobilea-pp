import { useCallStore } from '@/features/callService/store/call.store';
import { useNotificationsStore } from '@/features/notifications/store/notifications.store';
import { useAuthPromptStore } from '@/store/auth-prompt.store';
import { clearPendingLink } from './pending-link';
import { getQueryClient } from './query-client';

// Wipe all user-scoped cached state so the next login starts fresh:
// - TanStack Query: drop every cached/inflight query (server data).
// - Notifications store: clear merged list + banner queue + unread count.
// - Auth-prompt store: close any open gate.
// - Pending deep link: a link parked for the OUTGOING user must never replay
//   for whoever signs in next.
//
// Deliberately does NOT reset the onboarding store — "has seen onboarding"
// is device-level, not per-user, and must survive sign-out.
export function resetSessionData(): void {
  getQueryClient().clear();
  useNotificationsStore.getState().resetNotifications();
  useCallStore.getState().resetCallService();
  useAuthPromptStore.setState({ isOpen: false });
  clearPendingLink();
}
