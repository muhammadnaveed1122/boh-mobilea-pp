import { useQuery } from '@tanstack/react-query';
import { getPortalOverview } from '../services';
import type { PortalOverviewQuery } from '../types';

export function usePortalOverview(params: PortalOverviewQuery = {}) {
  return useQuery({
    queryKey: ['leads', 'portal-overview', params],
    queryFn: () => getPortalOverview(params),
    staleTime: 30_000,
  });
}
