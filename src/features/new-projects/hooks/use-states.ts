import { useQuery } from '@tanstack/react-query';
import { getStates } from '../services';
import type { StateOption } from '../types';

export function useStates() {
  return useQuery<StateOption[], Error>({
    queryKey: ['locations', 'states'],
    queryFn: getStates,
    staleTime: 60 * 60 * 1000,
  });
}
