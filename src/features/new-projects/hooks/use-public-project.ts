import { useQuery } from '@tanstack/react-query';
import { getPublicProjectBySlug } from '../services';
import type { PublicProjectDetail } from '../types';

export function usePublicProject(slug: string | undefined) {
  return useQuery<PublicProjectDetail, Error>({
    queryKey: ['public-project', slug],
    queryFn: () => getPublicProjectBySlug(slug as string),
    enabled: typeof slug === 'string' && slug.length > 0,
  });
}
