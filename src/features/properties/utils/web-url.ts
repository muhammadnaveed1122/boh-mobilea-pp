import { CONFIG } from '@/lib/config';
import type { PropertyDetailTarget } from '../types';

/**
 * Absolute public web URL for a listing. Used as the share link, the "Property Link" line in the
 * WhatsApp enquiry, and `channelMeta.page` on a callback lead — all three must agree, so they all
 * come through here. Returns undefined when no web origin is configured.
 */
export function listingWebUrl(target: PropertyDetailTarget): string | undefined {
  const base = CONFIG.WEB_BASE_URL;
  if (!base) return undefined;
  return target.kind === 'opportunity'
    ? `${base}/buy-with-us/${target.slug}`
    : `${base}/new-projects/${target.projectSlug}/${target.listingSlug}`;
}
