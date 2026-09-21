/** Amenity display-name precedence: custom title → catalog name → fallback. */
export function resolveAmenityLabel(input: {
  customTitle?: string | null;
  name?: string | null;
  fallback?: string;
}): string {
  const custom = input.customTitle?.trim();
  if (custom) return custom;
  const name = input.name?.trim();
  if (name) return name;
  return input.fallback ?? 'Amenity';
}

/** Stable sort by `sortOrder ?? 0` (ascending). */
export function sortAmenities<T extends { sortOrder?: number | null }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/** Keep only amenities not explicitly hidden (`isVisible !== false`). */
export function filterVisibleAmenities<T extends { isVisible?: boolean | null }>(
  items: readonly T[],
): T[] {
  return items.filter((a) => a.isVisible !== false);
}

export interface CanonicalAmenityMedia {
  id: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  altText: string | null;
  sortOrder: number;
}

/** Normalize a raw media array to http(s) items only, mapping video vs image. */
export function normalizeAmenityMedia(raw: readonly unknown[]): CanonicalAmenityMedia[] {
  const out: CanonicalAmenityMedia[] = [];
  raw.forEach((item, index) => {
    const m = (item ?? {}) as Record<string, unknown>;
    const url =
      typeof m.mediaUrl === 'string' ? m.mediaUrl : typeof m.url === 'string' ? m.url : '';
    if (!/^https?:\/\//i.test(url)) return;
    const type = m.mediaType === 'video' || m.type === 'video' ? 'video' : 'image';
    out.push({
      id: typeof m.id === 'string' ? m.id : `amenity-media-${String(index)}`,
      mediaUrl: url,
      mediaType: type,
      altText: typeof m.altText === 'string' ? m.altText : null,
      sortOrder: typeof m.sortOrder === 'number' ? m.sortOrder : 0,
    });
  });
  return out;
}
