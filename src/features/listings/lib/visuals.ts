/**
 * Shared visual constants for the Listings feature.
 *
 * Intentionally hardcoded (not theme-driven) so the navy "property portal"
 * hero treatment stays constant across light/dark — the photo/gradient heroes
 * are always dark-on-light-text, mirroring `lead-detail/HeroHeaderCard`.
 */
import type { ListingStatus, TrakheesiPermitStatus } from '../types';

/** Deep-navy brand gradient (rgb 16 24 39 = #101827): tint → primary → shade. */
export const HERO_GRADIENT: readonly [string, string, string] = ['#26324F', '#101827', '#080C16'];

/** Bottom scrim laid over hero photos so overlaid text stays legible. */
export const HERO_SCRIM: readonly [string, string, string] = [
  'rgba(8,12,22,0)',
  'rgba(8,12,22,0.35)',
  'rgba(8,12,22,0.92)',
];

/** Accent dot per status, for frosted chips sitting on dark heroes. */
export const STATUS_DOT: Record<ListingStatus, string> = {
  draft: '#9CA3AF',
  in_review: '#60A5FA',
  re_review: '#60A5FA',
  changes_requested: '#FACC15',
  approved: '#4ADE80',
  active: '#34D399',
  inactive: '#9CA3AF',
  archived: '#6B7280',
};

export const TRAKHEESI_DOT: Record<TrakheesiPermitStatus, string> = {
  not_applied: '#9CA3AF',
  applied: '#60A5FA',
  approved: '#34D399',
  expired: '#F87171',
};
