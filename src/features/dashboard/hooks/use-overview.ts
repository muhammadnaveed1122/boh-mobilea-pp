import { useQuery } from '@tanstack/react-query';

import { getOverview } from '../services';
import type { DashboardOverview } from '../types';

export function useOverview() {
  return useQuery<DashboardOverview>({
    queryKey: ['dashboard', 'overview'],
    queryFn: getOverview,
    staleTime: 60_000,
  });
}
