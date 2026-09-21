import { useQuery } from '@tanstack/react-query';
import { getListingStages } from '../services.primary';
import type { ListingStage, StageScope } from '../types';

/** Ordered pipeline stages for the current {domain, purpose, lifecycle} scope. */
export function useListingStages(scope: StageScope) {
  const query = useQuery<ListingStage[]>({
    queryKey: ['listing-stages', scope],
    queryFn: () => getListingStages(scope),
    staleTime: 5 * 60 * 1000,
  });
  return { data: query.data ?? [], isLoading: query.isLoading };
}
