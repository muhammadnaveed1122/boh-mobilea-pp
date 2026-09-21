import { useInfiniteQuery } from '@tanstack/react-query';
import { getLeads } from '../services';
import type { BrowseConfig, BrowseState, PaginatedLeads } from '../types';
import { buildBrowseQuery } from '../components/browse/browseQuery';

const PAGE_SIZE = 20;

export function useBrowseLeads(config: BrowseConfig, state: BrowseState, debouncedSearch: string) {
  const query = buildBrowseQuery(config, state, debouncedSearch);
  return useInfiniteQuery<PaginatedLeads, Error>({
    queryKey: ['leads', 'browse', query],
    queryFn: ({ pageParam }) =>
      getLeads({
        ...query,
        page: pageParam as number,
        limit: PAGE_SIZE,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}
