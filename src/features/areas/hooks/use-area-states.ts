import { useQuery } from '@tanstack/react-query';

import { getAreaStates } from '../services';
import type { AreaState } from '../models/area';

/** Cities (emirates) for the Areas City filter. Small set; fetched once. */
export function useAreaStates() {
  return useQuery<AreaState[], Error>({
    queryKey: ['areas', 'states'],
    queryFn: () => getAreaStates(),
    staleTime: 5 * 60_000,
  });
}
