import { useInfiniteQuery } from '@tanstack/react-query';
import { getPrimaryListings } from '../services.primary';
import type { PrimaryListingsQuery, PrimaryPaginatedListings } from '../types';

const PAGE_SIZE = 20;

export type PrimaryListingsParams = Omit<PrimaryListingsQuery, 'page' | 'limit'>;

export function usePrimaryListingsInfinite(params: PrimaryListingsParams) {
  return useInfiniteQuery<PrimaryPaginatedListings, Error>({
    queryKey: ['listings', 'primary', params],
    queryFn: ({ pageParam }) =>
      getPrimaryListings({ ...params, page: pageParam as number, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}
