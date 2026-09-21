import { useInfiniteQuery } from '@tanstack/react-query';

import type { AreaListingsPage } from '@/features/areas/models/area-detail';

import { getProjectsPage, type ProjectListFilters } from '../services';

/**
 * Paginated top-level project list. Filter values live in the query key so
 * changing any filter refetches from page 1; the screen's FlatList
 * `onEndReached` drives `fetchNextPage`.
 */
export function useProjectsInfinite(filters: ProjectListFilters, options?: { enabled?: boolean }) {
  const { search, status, availability, stateId, developerId } = filters;
  return useInfiniteQuery<AreaListingsPage, Error>({
    queryKey: [
      'projects',
      'list',
      {
        search: search ?? '',
        status: status ?? '',
        availability: availability ?? '',
        stateId: stateId ?? '',
        developerId: developerId ?? '',
      },
    ],
    queryFn: ({ pageParam }) => getProjectsPage(filters, pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  });
}
