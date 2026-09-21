import { useQuery } from '@tanstack/react-query';

import { getStates } from '../services';
import type { LocationItem } from '../models/location';

/**
 * States (emirates) for the City select. Mirrors web, which fetches these
 * from the locations API instead of using a static list.
 */
export function useStates(params?: { search?: string; enabled?: boolean }) {
  return useQuery<LocationItem[], Error>({
    queryKey: ['locations', 'states', params?.search ?? ''],
    queryFn: () => getStates({ search: params?.search }),
    enabled: params?.enabled ?? true,
    staleTime: 5 * 60_000,
  });
}
