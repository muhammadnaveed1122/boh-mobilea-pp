/**
 * `channelMeta.entryPointId` values sent with lead creation. When the entry point
 * is more specific than the raw lead type name, it drives the Source label.
 *
 * Mirrors web `boh-lead-magnet/src/features/leads/constants/channelEntryPoints.ts`
 * — keep the ids/labels in sync with that file.
 */

/** Current id for Client Dashboard → property "Tell Me More". */
export const CLIENT_PORTAL_PROJECT_DETAIL_TELL_ME_MORE_ENTRY_POINT = 'project_detail_tell_me_more';

/** Earlier frontend id — still recognized for source labels on existing leads. */
export const LEGACY_FAVORITES_PORTAL_TELL_ME_MORE_ENTRY_POINT = 'favorites.portal.tell_me_more';

const CLIENT_PORTAL_TELL_ME_MORE_ENTRY_POINTS = new Set([
  CLIENT_PORTAL_PROJECT_DETAIL_TELL_ME_MORE_ENTRY_POINT,
  LEGACY_FAVORITES_PORTAL_TELL_ME_MORE_ENTRY_POINT,
]);

function isClientPortalTellMeMoreEntryPoint(entryPointId: string | undefined): boolean {
  return entryPointId !== undefined && CLIENT_PORTAL_TELL_ME_MORE_ENTRY_POINTS.has(entryPointId);
}

export const BUY_DETAIL_CTA_ENTRY_POINT = 'buy_detail_cta';
export const PROJECT_DETAIL_CTA_ENTRY_POINT = 'project_detail_cta';

/** Sell Property page — Valuation Form section. */
export const SELL_VALUATION_FORM_ENTRY_POINT = 'sell.valuation_form';

const CLIENT_PORTAL_TELL_ME_MORE_SOURCE_LABEL = 'Client portal inquiry';

/** Source label when the entry point is more specific than the lead type. */
export const LEAD_SOURCE_LABEL_BY_ENTRY_POINT: Record<string, string> = {
  [CLIENT_PORTAL_PROJECT_DETAIL_TELL_ME_MORE_ENTRY_POINT]: CLIENT_PORTAL_TELL_ME_MORE_SOURCE_LABEL,
  [LEGACY_FAVORITES_PORTAL_TELL_ME_MORE_ENTRY_POINT]: CLIENT_PORTAL_TELL_ME_MORE_SOURCE_LABEL,
  [BUY_DETAIL_CTA_ENTRY_POINT]: 'Buy Detail',
  [PROJECT_DETAIL_CTA_ENTRY_POINT]: 'Project Detail',
  [SELL_VALUATION_FORM_ENTRY_POINT]: 'Website · Sell Property Page · Valuation Form',
};

/** Lead types created from favorites "Tell me more"; show entry-point label until type is changed in CRM. */
const LEAD_TYPES_FAVORITES_PORTAL_INQUIRY = new Set(['brochure_download', 'request_a_call_back']);

function normalizeLeadTypeKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/gu, '_');
}

/**
 * Entry-point-specific Source label when the `channelMeta.entryPointId` is more
 * specific than the raw lead type name. Returns null when no mapping applies.
 */
export function entryPointSourceLabel(
  leadTypeName: string,
  entryPointId: string | undefined,
): string | null {
  if (entryPointId === SELL_VALUATION_FORM_ENTRY_POINT) {
    return LEAD_SOURCE_LABEL_BY_ENTRY_POINT[SELL_VALUATION_FORM_ENTRY_POINT];
  }

  const normalized = normalizeLeadTypeKey(leadTypeName);
  if (
    isClientPortalTellMeMoreEntryPoint(entryPointId) &&
    LEAD_TYPES_FAVORITES_PORTAL_INQUIRY.has(normalized)
  ) {
    return LEAD_SOURCE_LABEL_BY_ENTRY_POINT[CLIENT_PORTAL_PROJECT_DETAIL_TELL_ME_MORE_ENTRY_POINT];
  }

  if (entryPointId !== undefined && Object.hasOwn(LEAD_SOURCE_LABEL_BY_ENTRY_POINT, entryPointId)) {
    return LEAD_SOURCE_LABEL_BY_ENTRY_POINT[entryPointId];
  }

  return null;
}
