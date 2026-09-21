import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getLeadFunnelStats } from '../services';
import type { LeadFunnelStats } from '../types';

const FUNNEL_STATS_KEY = ['leads', 'funnel-stats'] as const;

export function useFunnelStats() {
  return useQuery<LeadFunnelStats, Error>({
    queryKey: FUNNEL_STATS_KEY,
    queryFn: getLeadFunnelStats,
  });
}

export function useInvalidateFunnelStats(): () => void {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: FUNNEL_STATS_KEY }).catch(() => {
      /* swallow */
    });
  };
}
