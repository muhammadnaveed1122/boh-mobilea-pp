import { useQuery } from '@tanstack/react-query';

import { getAreaPropertyTypes } from '../services';
import type { AreaPropertyTypeOption } from '../models/area';

/** Property-type options for the Areas filter (admin-managed list). */
export function useAreaPropertyTypes() {
  return useQuery<AreaPropertyTypeOption[], Error>({
    queryKey: ['areas', 'property-types'],
    queryFn: () => getAreaPropertyTypes(),
    staleTime: 5 * 60_000,
  });
}
