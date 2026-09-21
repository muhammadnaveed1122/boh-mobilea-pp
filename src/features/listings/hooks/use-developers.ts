import { useQuery } from '@tanstack/react-query';
import { getDevelopers } from '../services.primary';
import type { ListingDeveloperOption } from '../types';

export function useDeveloperOptions() {
  const query = useQuery<ListingDeveloperOption[]>({
    queryKey: ['listing-developers'],
    queryFn: () => getDevelopers(),
    staleTime: 5 * 60 * 1000,
  });
  return { data: query.data ?? [], isLoading: query.isLoading };
}
