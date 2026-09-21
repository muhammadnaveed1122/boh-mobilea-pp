import { useQuery } from '@tanstack/react-query';
import { getPublicListings, type PublicListingsResponse } from '../services';

export function usePublicListings(projectId: string | undefined) {
  return useQuery<PublicListingsResponse, Error>({
    queryKey: ['public-listings', projectId],
    queryFn: () => getPublicListings(projectId as string),
    enabled: typeof projectId === 'string' && projectId.length > 0,
  });
}
