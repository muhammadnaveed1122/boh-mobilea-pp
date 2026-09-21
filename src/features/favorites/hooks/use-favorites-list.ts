// src/features/favorites/hooks/use-favorites-list.ts
import { useInfiniteQuery, type UseInfiniteQueryResult } from '@tanstack/react-query';
import { useRole } from '@/lib/rbac';
import { useAuthStore } from '@/store/auth.store';
import { getFavoriteListings, getFavoriteProjects } from '../services';
import type { PaginatedClientFavoriteListings, PaginatedClientFavoriteProjects } from '../types';
import { favoritesKeys } from './keys';

const PAGE_SIZE = 10;

export function useFavoriteProjectsList(): UseInfiniteQueryResult<
  { pages: PaginatedClientFavoriteProjects[] },
  Error
> {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { isPortalUser, isCustomer } = useRole();
  return useInfiniteQuery<PaginatedClientFavoriteProjects, Error>({
    queryKey: favoritesKeys.list('project'),
    queryFn: ({ pageParam }) => getFavoriteProjects(pageParam as number, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled: isAuthenticated && (isPortalUser || isCustomer),
  }) as UseInfiniteQueryResult<{ pages: PaginatedClientFavoriteProjects[] }, Error>;
}

export function useFavoriteListingsList(): UseInfiniteQueryResult<
  { pages: PaginatedClientFavoriteListings[] },
  Error
> {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { isPortalUser, isCustomer } = useRole();
  return useInfiniteQuery<PaginatedClientFavoriteListings, Error>({
    queryKey: favoritesKeys.list('listing'),
    queryFn: ({ pageParam }) => getFavoriteListings(pageParam as number, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled: isAuthenticated && (isPortalUser || isCustomer),
  }) as UseInfiniteQueryResult<{ pages: PaginatedClientFavoriteListings[] }, Error>;
}
