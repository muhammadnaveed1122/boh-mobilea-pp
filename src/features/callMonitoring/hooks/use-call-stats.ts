import { useQuery } from '@tanstack/react-query';
import type { CallStats } from '../models/call-stats';
import type { SourceTabKey } from '../constants';
import { getCallStats } from '../services';

interface StatsRange {
  from?: string;
  to?: string;
}

/** Stats with no source filter — drives tab counts; stays cached across tab switches. */
export function useGlobalCallStats(range: StatsRange) {
  return useQuery<CallStats, Error>({
    queryKey: ['call-stats', 'global', range],
    queryFn: () => getCallStats({ from: range.from || undefined, to: range.to || undefined }),
  });
}

/** Source-scoped stats for the KPI cards; disabled on the "All" tab. */
export function useScopedCallStats(range: StatsRange, source: SourceTabKey) {
  return useQuery<CallStats, Error>({
    queryKey: ['call-stats', 'scoped', range, source],
    queryFn: () =>
      getCallStats({ from: range.from || undefined, to: range.to || undefined, source }),
    enabled: source !== '',
  });
}
