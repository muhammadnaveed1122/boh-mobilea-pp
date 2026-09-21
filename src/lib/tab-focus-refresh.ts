import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

// Tab screens stay mounted in the Tabs navigator, so `refetchOnMount` never
// fires on tab switches. These hooks restore freshness: when a tab regains
// focus, refetch its queries IF stale (staleTime default 30s). The first
// focus (initial lazy mount) is skipped — the query just fetched.

type RefetchableQuery = Readonly<{ isStale: boolean; refetch: () => unknown }>;

function useTabRefocus(onRefocus: () => void) {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      onRefocus();
    }, [onRefocus]),
  );
}

/** Pass the full query results (not destructured) of the screen's main queries. */
export function useRefetchOnTabFocus(queries: readonly RefetchableQuery[]) {
  const ref = useRef(queries);
  ref.current = queries;
  useTabRefocus(
    useCallback(() => {
      for (const q of ref.current) {
        if (q.isStale) q.refetch();
      }
    }, []),
  );
}

/**
 * For screens whose queries live in child components (e.g. Home stat tiles):
 * invalidate stale active queries by key prefix on tab re-focus.
 */
export function useInvalidateOnTabFocus(keys: readonly QueryKey[]) {
  const queryClient = useQueryClient();
  const ref = useRef(keys);
  ref.current = keys;
  useTabRefocus(
    useCallback(() => {
      for (const key of ref.current) {
        queryClient
          .invalidateQueries({ queryKey: key, stale: true, refetchType: 'active' })
          .catch(() => {});
      }
    }, [queryClient]),
  );
}
