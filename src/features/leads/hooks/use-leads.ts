import { useInfiniteQuery } from '@tanstack/react-query';
import { getLeads } from '../services';
import { useLeadsFilterStore } from '../store/filter.store';
import type { PaginatedLeads } from '../types';

const PAGE_SIZE = 20;

export function useLeadsInfinite() {
  const filter = useLeadsFilterStore((s) => s.filter);
  const debouncedSearch = useLeadsFilterStore((s) => s.debouncedSearch);
  const interest = useLeadsFilterStore((s) => s.interest);
  const interestType = useLeadsFilterStore((s) => s.interestType);
  const priority = useLeadsFilterStore((s) => s.priority);

  const status = filter === 'All' ? undefined : filter;
  const search = debouncedSearch.length > 0 ? debouncedSearch : undefined;

  const params = {
    status,
    search,
    interest: interest ?? undefined,
    interestType: interestType ?? undefined,
    priority: priority ?? undefined,
  };

  return useInfiniteQuery<PaginatedLeads, Error>({
    queryKey: ['leads', params],
    queryFn: ({ pageParam }) =>
      getLeads({
        ...params,
        page: pageParam as number,
        limit: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}
