import { useInfiniteQuery } from '@tanstack/react-query';

import { getAgents } from '../services';
import type { AgentPresence, PaginatedAgents } from '../types';

const PAGE_SIZE = 20;

export function useAgentsInfinite(presence: AgentPresence, search?: string) {
  return useInfiniteQuery<PaginatedAgents, Error>({
    queryKey: ['agents', 'list', presence, search],
    queryFn: ({ pageParam }) =>
      getAgents({
        presence,
        search,
        page: pageParam as number,
        limit: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}
