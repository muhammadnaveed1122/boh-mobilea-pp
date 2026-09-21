import { useQuery } from '@tanstack/react-query';
import { getActiveListingsCount } from '../services';

const ACTIVE_LISTINGS_COUNT_KEY = ['listings', 'active-count'] as const;

export function useActiveListingsCount() {
  return useQuery<number, Error>({
    queryKey: ACTIVE_LISTINGS_COUNT_KEY,
    queryFn: getActiveListingsCount,
  });
}
