import { useQuery } from '@tanstack/react-query';
import { getLeadById } from '../services';
import type { LeadDetail } from '../models/lead-detail';

export function useLeadDetail(id: string | undefined) {
  return useQuery<LeadDetail, Error>({
    queryKey: ['lead', id],
    queryFn: () => {
      if (!id) {
        throw new Error('Lead id is required');
      }
      return getLeadById(id);
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}
