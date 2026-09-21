import { useInfiniteQuery } from '@tanstack/react-query';
import { getPublicProjects } from '../services';
import type { PublicProjectsFilters, PublicProjectsListResponse } from '../types';

const PAGE_SIZE = 10;

export function usePublicProjects(filters: PublicProjectsFilters) {
  return useInfiniteQuery<PublicProjectsListResponse, Error>({
    queryKey: ['public-projects', filters],
    queryFn: ({ pageParam }) =>
      getPublicProjects({ ...filters, page: pageParam as number, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}
