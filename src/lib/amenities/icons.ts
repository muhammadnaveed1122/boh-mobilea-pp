import type { IconName } from '@/components/atoms/Icon';

import { resolveAmenityPrefix, slugifyAmenity } from './images';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const lucideIcons = require('lucide-react-native/icons') as Record<string, unknown>;

/** Canonical amenity image-prefix → Lucide icon key. Keys mirror AMENITY_IMAGES_BY_PREFIX. */
const PREFIX_TO_ICON: Record<string, IconName> = {
  'electricity-backup': 'Zap',
  'gym-and-health': 'Dumbbell',
  'swimming-pool': 'WavesLadder',
  'cleaning-services': 'Sparkles',
  'broadband-internet': 'Wifi',
  'maintenance-staff': 'Wrench',
  'security-staff': 'ShieldCheck',
  'cctv-security': 'Cctv',
  'laundry-facility': 'WashingMachine',
  'satellite-or-cable-tv': 'Tv',
  'pets-allowed': 'Dog',
  floors: 'Building2',
};

const FALLBACK_AMENITY_ICON: IconName = 'Check';

function isLucideIconName(value: string): value is IconName {
  return value !== '' && value in lucideIcons;
}

/**
 * Resolve an amenity to a Lucide IconName:
 * 1) a raw `icon` that is already a valid Lucide key passes through (current listings behaviour);
 * 2) else the slug/icon/label is aliased to a canonical prefix → mapped icon;
 * 3) else `Check`.
 */
export function resolveAmenityIcon(input: {
  icon?: string | null;
  slug?: string | null;
  label?: string;
}): IconName {
  const raw = input.icon ?? '';
  if (isLucideIconName(raw)) return raw;
  const prefix = resolveAmenityPrefix({
    slug: input.slug ?? undefined,
    icon: input.icon ?? undefined,
    label: input.label,
  });
  if (prefix !== null && prefix in PREFIX_TO_ICON) return PREFIX_TO_ICON[prefix];
  // Last chance: slugified label/icon that happens to be a Lucide key.
  const slugged = slugifyAmenity(input.slug ?? input.icon ?? input.label ?? '');
  return isLucideIconName(slugged) ? (slugged as IconName) : FALLBACK_AMENITY_ICON;
}
