// src/features/favorites/hooks/use-favorite-snapshot.ts
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRole } from '@/lib/rbac';
import { useAuthStore } from '@/store/auth.store';
import { getAllFavorites } from '../services';
import type { ClientFavoriteAllResponse } from '../types';
import { favoritesKeys } from './keys';

// Capped for snapshot performance. A user with more than SNAPSHOT_LIMIT
// favourites will see the overflow as un-favourited on cards (the dedicated
// Favourites page paginates fully and is unaffected).
const SNAPSHOT_LIMIT = 100;

export interface FavoriteSnapshot {
  projectIds: Set<string>;
  listingIds: Set<string>;
}

export function useFavoriteSnapshot(): {
  snapshot: FavoriteSnapshot;
  isLoading: boolean;
  enabled: boolean;
} {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { isPortalUser, isCustomer } = useRole();
  const enabled = isAuthenticated && (isPortalUser || isCustomer);

  const { data, isLoading } = useQuery<ClientFavoriteAllResponse>({
    queryKey: favoritesKeys.snapshot(),
    queryFn: () => getAllFavorites(1, SNAPSHOT_LIMIT),
    enabled,
  });

  const snapshot = useMemo<FavoriteSnapshot>(
    () => ({
      projectIds: new Set((data?.projects.items ?? []).map((p) => p.projectId)),
      listingIds: new Set((data?.listings.items ?? []).map((l) => l.listing.id)),
    }),
    [data],
  );

  return { snapshot, isLoading, enabled };
}
