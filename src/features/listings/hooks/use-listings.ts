import { useInfiniteQuery } from '@tanstack/react-query';
import { getListings } from '../services';
import type { ListingsQuery, PaginatedListings } from '../types';

const PAGE_SIZE = 20;

export type ListingsParams = Omit<ListingsQuery, 'page' | 'limit'>;

export function useListingsInfinite(params: ListingsParams) {
  return useInfiniteQuery<PaginatedListings, Error>({
    queryKey: ['listings', 'all', params],
    queryFn: ({ pageParam }) =>
      getListings({
        ...params,
        page: pageParam as number,
        limit: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}
