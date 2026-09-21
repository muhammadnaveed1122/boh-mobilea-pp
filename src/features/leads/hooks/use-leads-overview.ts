import { useQuery } from '@tanstack/react-query';
import { getLeadsOverview } from '../services';
import type { OverviewQuery } from '../types';

export function useLeadsOverview(params: OverviewQuery = {}) {
  return useQuery({
    queryKey: ['leads', 'overview', params],
    queryFn: () => getLeadsOverview(params),
    staleTime: 30_000,
  });
}
