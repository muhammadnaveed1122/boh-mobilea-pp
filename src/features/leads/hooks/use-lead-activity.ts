import { useInfiniteQuery } from '@tanstack/react-query';
import { getLeadActivities } from '../services';
import type { LeadActionType, LeadActivityPage, LeadActivityQuery } from '../models/lead-activity';

const PAGE_SIZE = 20;

export interface UseLeadActivityFilters {
  search?: string;
  action?: LeadActionType[];
  dateFrom?: string;
  dateTo?: string;
}

export function useLeadActivity(leadId: string | undefined, filters: UseLeadActivityFilters = {}) {
  const params: LeadActivityQuery = {
    limit: PAGE_SIZE,
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.action && filters.action.length > 0 ? { action: filters.action } : {}),
    ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
    ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
  };

  return useInfiniteQuery<LeadActivityPage, Error>({
    queryKey: ['lead-activity', leadId, params],
    queryFn: ({ pageParam }) => {
      if (!leadId) {
        throw new Error('Lead id is required');
      }
      return getLeadActivities(leadId, { ...params, page: pageParam as number });
    },
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    enabled: !!leadId,
    staleTime: 30_000,
  });
}
