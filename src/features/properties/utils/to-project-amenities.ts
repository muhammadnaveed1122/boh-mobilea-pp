import type { ProjectAmenitiesSection } from '@/features/new-projects/types';
import { normalizeAmenityMedia } from '@/lib/amenities';
import type { PropertyDetail } from '../types';

/**
 * Map the buy/opportunity `PropertyDetail.amenities` shape onto the richer
 * project `ProjectAmenitiesSection` so the project `AmenitiesSection` carousel
 * can be reused. Fields absent on the buy side get safe defaults; the project
 * component falls back to default slider images when an item has no media.
 */
export function toProjectAmenities(
  amenities: PropertyDetail['amenities'],
): ProjectAmenitiesSection | null {
  const items = amenities?.items ?? [];
  if (items.length === 0) return null;

  return {
    title: amenities?.title ?? null,
    tagline: amenities?.tagline ?? null,
    selectedCount: items.length,
    totalCount: items.length,
    items: items.map((item, idx) => ({
      id: item.id,
      amenityId: item.id,
      name: item.name,
      slug: item.slug,
      icon: item.icon ?? null,
      description: item.description ?? '',
      isCustom: false,
      isVisible: true,
      sortOrder: idx,
      media: normalizeAmenityMedia(item.media ?? []).map((m, mIdx) => ({
        id: `${item.id}-m${String(mIdx)}`,
        mediaUrl: m.mediaUrl,
        mediaType: m.mediaType,
        altText: m.altText,
        sortOrder: mIdx,
      })),
    })),
  };
}
