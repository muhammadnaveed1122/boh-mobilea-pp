import { useQuery } from '@tanstack/react-query';

import type { AreaOption } from '@/features/areas/components/AreaOptionSheet';

import { getDevelopers } from '../services';

/** Developers for the project-list Developer filter. Small set; cached 5 min. */
export function useDevelopers() {
  return useQuery<AreaOption[], Error>({
    queryKey: ['projects', 'developers'],
    queryFn: () => getDevelopers(),
    staleTime: 5 * 60_000,
  });
}
