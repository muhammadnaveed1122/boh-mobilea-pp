import { useQuery } from '@tanstack/react-query';

import { getLeadFunnel } from '../services';
import type { FunnelPeriod, LeadFunnel } from '../types';

export function useLeadFunnel(period: FunnelPeriod) {
  return useQuery<LeadFunnel>({
    queryKey: ['dashboard', 'lead-funnel', period],
    queryFn: () => getLeadFunnel(period),
    staleTime: 60_000,
  });
}
