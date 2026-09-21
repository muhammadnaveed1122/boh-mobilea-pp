import { useQuery } from '@tanstack/react-query';

import { getMasterAmenities } from '../services';

export function useMasterAmenities() {
  return useQuery({
    queryKey: ['master-amenities'],
    queryFn: getMasterAmenities,
    staleTime: 300_000,
  });
}
