import { useQuery } from '@tanstack/react-query';
import { getBuyListingDetail, getOpportunityDetail } from '../services';
import type { PropertyDetail, PropertyDetailTarget } from '../types';

function fetchDetail(target: PropertyDetailTarget): Promise<PropertyDetail> {
  return target.kind === 'opportunity'
    ? getOpportunityDetail(target.slug)
    : getBuyListingDetail(target.projectSlug, target.listingSlug);
}

function detailKey(target: PropertyDetailTarget): string {
  return target.kind === 'opportunity'
    ? `opp:${target.slug}`
    : `buy:${target.projectSlug}/${target.listingSlug}`;
}

export function usePropertyDetail(target: PropertyDetailTarget | undefined) {
  return useQuery<PropertyDetail, Error>({
    queryKey: ['properties', 'detail', target ? detailKey(target) : null],
    queryFn: () => fetchDetail(target as PropertyDetailTarget),
    enabled: target !== undefined,
    staleTime: 60_000,
  });
}
