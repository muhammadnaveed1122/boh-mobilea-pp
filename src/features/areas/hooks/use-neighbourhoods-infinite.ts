import { useInfiniteQuery } from '@tanstack/react-query';

import { getNeighbourhoodsPage } from '../services';
import type { AreasPage } from '../models/area';

const PAGE_LIMIT = 100;

export interface AreasFilters {
  readonly search?: string;
  readonly stateId?: string;
  readonly propertyType?: string;
}

/**
 * Paginated neighbourhoods for the Areas grid. Replaces the web
 * IntersectionObserver infinite scroll with TanStack `useInfiniteQuery`; the
 * screen's FlatList `onEndReached` drives `fetchNextPage`. Filter values live
 * in the query key so changing any filter refetches from page 1.
 */
export function useNeighbourhoodsInfinite(filters: AreasFilters, options?: { enabled?: boolean }) {
  const { search, stateId, propertyType } = filters;
  return useInfiniteQuery<AreasPage, Error>({
    queryKey: [
      'areas',
      'neighbourhoods',
      { search: search ?? '', stateId: stateId ?? '', propertyType: propertyType ?? '' },
    ],
    queryFn: ({ pageParam }) =>
      getNeighbourhoodsPage({
        page: pageParam as number,
        limit: PAGE_LIMIT,
        search,
        stateId,
        propertyType,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages ? lastPage.meta.page + 1 : undefined,
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  });
}
