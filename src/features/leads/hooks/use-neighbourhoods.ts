import { useQuery } from '@tanstack/react-query';

import { getNeighbourhoods } from '../services';
import type { LocationItem } from '../models/location';

/**
 * Neighbourhoods for the Area select, scoped to the selected state. Mirrors
 * web's `GET /locations/neighbourhoods?stateId=…`. Disabled until a state is
 * chosen so Area never lists across all emirates.
 */
export function useNeighbourhoods(
  stateId: string | undefined,
  params?: { search?: string; enabled?: boolean },
) {
  return useQuery<LocationItem[], Error>({
    queryKey: ['locations', 'neighbourhoods', stateId ?? '', params?.search ?? ''],
    queryFn: () => getNeighbourhoods({ stateId, search: params?.search }),
    enabled: Boolean(stateId) && (params?.enabled ?? true),
    staleTime: 5 * 60_000,
  });
}
