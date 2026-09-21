import { useQueries } from '@tanstack/react-query';

import { resolveAmenityLabel, sortAmenities } from '@/lib/amenities';

import { getListingById } from '../services';
import { compareKey } from '../store/compare.store';
import type { UnifiedListingRow } from '../types';

/**
 * Hydrate amenities for the compared listings. Only secondary listings expose a
 * mobile detail endpoint, so one query runs per secondary id (via `useQueries`,
 * dynamic-length safe). Primary listings are absent from the result map and the
 * grid renders `—` for them. Query key matches `useListingDetail` for cache reuse.
 */
export function useListingCompareAmenities(rows: UnifiedListingRow[]): {
  amenitiesByKey: Record<string, string[]>;
  isLoading: boolean;
} {
  const secondary = rows.filter((r) => r.kind === 'secondary');

  const results = useQueries({
    queries: secondary.map((r) => ({
      queryKey: ['listing', r.id],
      queryFn: () => getListingById(r.id),
      staleTime: 60_000,
    })),
  });

  const amenitiesByKey: Record<string, string[]> = {};
  secondary.forEach((r, i) => {
    const detail = results[i]?.data;
    if (!detail) return;
    amenitiesByKey[compareKey(r)] = sortAmenities(detail.amenities ?? []).map((a) =>
      resolveAmenityLabel({ customTitle: a.customTitle, name: a.amenity?.name }),
    );
  });

  const isLoading = results.some((r) => r.isLoading);
  return { amenitiesByKey, isLoading };
}
