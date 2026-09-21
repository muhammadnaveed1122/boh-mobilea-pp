import { useQuery } from '@tanstack/react-query';

import { getLeadCreators } from '../services';
import type { LeadCreator } from '../types';

/**
 * Users who can create leads — the option set behind the "Created By" filter.
 * Rarely changes, so it is cached for the session rather than refetched each
 * time the filter sheet opens.
 */
export function useLeadCreators(enabled = true) {
  return useQuery<LeadCreator[], Error>({
    queryKey: ['users', 'lead-creators'],
    queryFn: getLeadCreators,
    enabled,
    staleTime: 10 * 60_000,
  });
}
