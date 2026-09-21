// Shared TanStack Query keys for the notifications feature. The provider
// invalidates by the `all` prefix on socket events; screens key by page.

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (page: number) => ['notifications', 'list', page] as const,
  unread: () => ['notifications', 'unread-count'] as const,
};
