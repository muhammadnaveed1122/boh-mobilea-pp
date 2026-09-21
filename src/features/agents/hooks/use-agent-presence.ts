import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { subscribeSocket } from '@/lib/socket';

/**
 * Presence churn is bursty — every mobile client drops its socket on
 * backgrounding and re-connects on foreground, so a real roster emits
 * `presence:changed` in clusters. Coalesce them into one trailing refetch.
 */
const INVALIDATE_DEBOUNCE_MS = 1_000;

/** Re-fetch the presence-derived views. The event carries no state we trust — always refetch. */
function invalidatePresenceViews(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['agents', 'list'] }).catch(() => {});
  queryClient.invalidateQueries({ queryKey: ['dashboard', 'overview'] }).catch(() => {});
}

/**
 * Listens for the super-admin-only `presence:changed` socket event and
 * invalidates the agents list + dashboard overview so counts/lists refresh.
 * Treat the event purely as an invalidation hint — never patch counts
 * locally from its payload, always re-fetch from the server.
 *
 * Subscribes through `subscribeSocket` rather than `getSocket()`: this hook
 * runs on the home tab, which mounts in the same commit as the
 * `NotificationsProvider` that calls `connectSocket`. React flushes child
 * effects before parent effects, so on a cold start the socket does not exist
 * yet — the registry attaches the listener as soon as it does, and re-attaches
 * it to the new `Socket` object built on token rotation.
 */
export function useAgentPresence(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onChange = (): void => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = null;
        invalidatePresenceViews(queryClient);
      }, INVALIDATE_DEBOUNCE_MS);
    };

    const unsubscribe = subscribeSocket('presence:changed', onChange);

    return () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      unsubscribe();
    };
  }, [queryClient]);
}
