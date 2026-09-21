import type { ImageSourcePropType } from 'react-native';

/** File-name prefixes under `assets/images/amenities/` → ordered images (supports multiple slides per amenity). */
const AMENITY_IMAGES_BY_PREFIX: Record<string, readonly ImageSourcePropType[]> = {
  'electricity-backup': [
    require('../../../assets/images/amenities/electricity-backup-1.jpg'),
    require('../../../assets/images/amenities/electricity-backup-2.jpg'),
    require('../../../assets/images/amenities/electricity-backup-3.jpg'),
  ],
  'gym-and-health': [require('../../../assets/images/amenities/gym-and-health-1.jpg')],
  'swimming-pool': [require('../../../assets/images/amenities/swimming-pool-1.jpg')],
  'cleaning-services': [require('../../../assets/images/amenities/cleaning-services-1.jpg')],
  'broadband-internet': [require('../../../assets/images/amenities/broadband-internet-1.jpg')],
  'maintenance-staff': [require('../../../assets/images/amenities/maintenance-staff-1.jpg')],
  'security-staff': [require('../../../assets/images/amenities/security-staff-1.jpg')],
  'cctv-security': [require('../../../assets/images/amenities/cctv-security-1.jpg')],
  'laundry-facility': [require('../../../assets/images/amenities/laundry-facility-1.jpg')],
  'satellite-or-cable-tv': [
    require('../../../assets/images/amenities/satellite-or-cable-tv-1.jpg'),
  ],
  'pets-allowed': [require('../../../assets/images/amenities/pets-allowed-1.jpg')],
  floors: [require('../../../assets/images/amenities/floors-1.jpg')],
};

/**
 * Maps API slugs, icon keys, or slugified labels to the image file prefix above.
 * Add entries when new images follow `{prefix}-1.jpg` in the amenities folder.
 */
const AMENITY_LOOKUP_TO_PREFIX: Record<string, keyof typeof AMENITY_IMAGES_BY_PREFIX> = {
  'electricity-backup': 'electricity-backup',
  electricity: 'electricity-backup',
  lightning: 'electricity-backup',
  'gym-and-health': 'gym-and-health',
  'gym-or-health-club': 'gym-and-health',
  'gym-health-club': 'gym-and-health',
  gym: 'gym-and-health',
  barbell: 'gym-and-health',
  'health-club': 'gym-and-health',
  'swimming-pool': 'swimming-pool',
  swimming: 'swimming-pool',
  'cleaning-services': 'cleaning-services',
  cleaning: 'cleaning-services',
  broom: 'cleaning-services',
  'broadband-internet': 'broadband-internet',
  broadband: 'broadband-internet',
  'wifi-high': 'broadband-internet',
  wifi: 'broadband-internet',
  'maintenance-staff': 'maintenance-staff',
  maintenance: 'maintenance-staff',
  wrench: 'maintenance-staff',
  'security-staff': 'security-staff',
  security: 'security-staff',
  'shield-check': 'security-staff',
  'cctv-security': 'cctv-security',
  cctv: 'cctv-security',
  camera: 'cctv-security',
  'laundry-facility': 'laundry-facility',
  laundry: 'laundry-facility',
  'washing-machine': 'laundry-facility',
  'satellite-or-cable-tv': 'satellite-or-cable-tv',
  'satellite-cable-tv': 'satellite-or-cable-tv',
  'satellite-tv': 'satellite-or-cable-tv',
  television: 'satellite-or-cable-tv',
  tv: 'satellite-or-cable-tv',
  'pets-allowed': 'pets-allowed',
  pets: 'pets-allowed',
  dog: 'pets-allowed',
  floors: 'floors',
  'floor-8': 'floors',
  floor: 'floors',
  buildings: 'floors',
};

const FALLBACK_AMENITY_IMAGES: readonly ImageSourcePropType[] = [
  require('../../../assets/images/amenities/electricity-backup-1.jpg'),
];

export interface AmenityDefaultImageLookup {
  label?: string;
  icon?: string | null;
  /** Public project API amenity slug when available */
  slug?: string | null;
}

/** Normalize free text into a dash-separated, lowercase slug. */
export function slugifyAmenity(value: string): string {
  const dashed = value
    .trim()
    .toLowerCase()
    .replaceAll(/['’]/g, '')
    .replaceAll(/[^a-z0-9]+/g, '-');
  let start = 0;
  let end = dashed.length;
  while (start < end && dashed[start] === '-') start += 1;
  while (end > start && dashed[end - 1] === '-') end -= 1;
  return dashed.slice(start, end);
}

/**
 * Resolve an amenity's slug/icon/label to the canonical image-prefix key
 * (the same alias table backs `icons.ts`'s icon resolution).
 */
export function resolveAmenityPrefix(input: AmenityDefaultImageLookup): string | null {
  const candidates = [input.slug, input.icon, input.label ? slugifyAmenity(input.label) : null]
    .filter((v): v is string => Boolean(v && v.trim().length > 0))
    .map((v) => slugifyAmenity(v));

  for (const key of candidates) {
    const mapped = AMENITY_LOOKUP_TO_PREFIX[key];
    if (mapped) {
      return mapped;
    }
    if (Object.hasOwn(AMENITY_IMAGES_BY_PREFIX, key)) {
      return key;
    }
  }

  return null;
}

/** Local default slider images for an amenity when the API returns no media. */
export function resolveAmenityImages(
  input: AmenityDefaultImageLookup,
): readonly ImageSourcePropType[] {
  const prefix = resolveAmenityPrefix(input);
  if (prefix) {
    const images = AMENITY_IMAGES_BY_PREFIX[prefix];
    if (images.length > 0) {
      return images;
    }
  }
  return FALLBACK_AMENITY_IMAGES;
}

/** @deprecated Temporary alias — prefer `resolveAmenityImages`. */
export const getDefaultAmenitySliderImages = resolveAmenityImages;
