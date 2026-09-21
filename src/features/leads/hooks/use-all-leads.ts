import { useInfiniteQuery } from '@tanstack/react-query';
import { getLeads } from '../services';
import type { LeadsQuery, PaginatedLeads } from '../types';

const PAGE_SIZE = 20;

export type AllLeadsParams = Omit<LeadsQuery, 'page' | 'limit'>;

export function useAllLeadsInfinite(params: AllLeadsParams) {
  return useInfiniteQuery<PaginatedLeads, Error>({
    queryKey: ['leads', 'all', params],
    queryFn: ({ pageParam }) =>
      getLeads({
        ...params,
        page: pageParam as number,
        limit: PAGE_SIZE,
        sortBy: params.sortBy ?? 'updatedAt',
        sortOrder: params.sortOrder ?? 'desc',
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}
