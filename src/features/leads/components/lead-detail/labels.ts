/**
 * Display label maps for lead enums. Mirrors web `INTEREST_LABELS`,
 * `INTEREST_TYPE_LABELS`, `LEAD_TYPE_LABELS` etc. from
 * `boh-lead-magnet/src/features/leads/models/lead.ts`.
 */

import type { BadgeProps } from '@/components/atoms/Badge';
import type { IconName } from '@/components/atoms/Icon';

import { entryPointSourceLabel } from '../../constants/channel-entry-points';
import {
  InterestType,
  LeadSource,
  LeadStatus,
  Persona,
  PropertyType,
} from '../../constants/lead-enums';

export const PERSONA_LABELS: Record<Persona, string> = {
  [Persona.LANDLORD]: 'Landlord',
  [Persona.BUYER]: 'Buyer',
  [Persona.SELLER]: 'Seller',
  [Persona.TENANT]: 'Tenant',
  [Persona.PODCAST_GUEST]: 'Podcast Guest',
};

export const PURPOSE_LABELS: Record<InterestType, string> = {
  [InterestType.SELL_MY_PROPERTY]: 'Sell My Property',
  [InterestType.RENT_OUT_MY_PROPERTY]: 'Rent Out My Property',
  [InterestType.FIND_A_PROPERTY_TO_RENT]: 'Find A Property To Rent',
  [InterestType.FIND_A_PROPERTY_TO_BUY]: 'Find A Property To Buy',
  [InterestType.GET_VALUATION]: 'Get Valuation',
  [InterestType.BUYING_SELLING_AND_TRANSACTION]: 'Buying Selling And Transaction',
  [InterestType.OTHER]: 'Other',
};

export const STATUS_LABELS: Record<LeadStatus, string> = {
  [LeadStatus.NEW]: 'New',
  [LeadStatus.CONTACTED]: 'Contacted',
  [LeadStatus.QUALIFIED]: 'Qualified',
  [LeadStatus.VIEWING_SCHEDULED]: 'Viewing Scheduled',
  [LeadStatus.WORKING_DEAL]: 'Working Deal',
  [LeadStatus.FUTURE_PROSPECT]: 'Future Prospect',
  [LeadStatus.DID_NOT_RESPOND]: 'Did Not Respond',
  [LeadStatus.UNQUALIFIED]: 'Unqualified',
  [LeadStatus.CLOSED_DEAL]: 'Closed Deal',
  [LeadStatus.LOST_DEAL]: 'Lost Deal',
  [LeadStatus.RE_OPENED]: 'Re-opened',
};

export const SOURCE_LABELS: Record<LeadSource, string> = {
  [LeadSource.REQUEST_CONSULTATION]: 'Request Consultation',
  [LeadSource.REQUEST_A_CALL_BACK]: 'Request A Call Back',
  [LeadSource.SCHEDULE_A_MEETING]: 'Schedule A Meeting',
  [LeadSource.REQUEST_A_CALL]: 'Request A Call',
  [LeadSource.ABOUT_US]: 'About Us',
  [LeadSource.MANUAL]: 'Manual',
  [LeadSource.SERVICES]: 'Services',
  [LeadSource.GUIDE]: 'Guide',
  [LeadSource.BROCHURE_DOWNLOAD]: 'Brochure Download',
  [LeadSource.TOP_AREAS]: 'Top Areas',
  [LeadSource.PODCAST_GUEST]: 'Podcast Guest',
};

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  [PropertyType.APARTMENT]: 'Apartment',
  [PropertyType.VILLA]: 'Villa',
  [PropertyType.TOWNHOUSE]: 'Townhouse',
  [PropertyType.RESIDENTIAL_PLOT]: 'Residential Plot',
  [PropertyType.OFFICE]: 'Office',
  [PropertyType.RETAIL]: 'Retail',
  [PropertyType.WAREHOUSE]: 'Warehouse',
  [PropertyType.COMMERCIAL_PLOT]: 'Commercial Plot',
};

/** Title-case fallback for unknown backend strings. */
function titleCase(value: string): string {
  return value
    .split(/[_\s]+/u)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function personaLabel(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if ((Object.values(Persona) as string[]).includes(value)) {
    return PERSONA_LABELS[value as Persona];
  }
  return titleCase(value);
}

export function purposeLabel(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if ((Object.values(InterestType) as string[]).includes(value)) {
    return PURPOSE_LABELS[value as InterestType];
  }
  return titleCase(value);
}

export function statusLabel(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  if ((Object.values(LeadStatus) as string[]).includes(value)) {
    return STATUS_LABELS[value as LeadStatus];
  }
  return titleCase(value);
}

export function sourceLabel(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if ((Object.values(LeadSource) as string[]).includes(value)) {
    return SOURCE_LABELS[value as LeadSource];
  }
  return titleCase(value);
}

/**
 * Human-readable Source for a lead. Mirrors web `getLeadSourceDisplayLabel`
 * (`boh-lead-magnet/src/features/leads/utils/leadsTableFormatters.ts`): honors
 * `externalSource` (PropertyFinder / Telesales) and `channelMeta.entryPointId`
 * before falling back to the lead type label. Returns null when nothing resolves.
 */
export function leadSourceDisplay(
  lead: Readonly<{
    channel?: string | null;
    externalSource?: string | null;
    channelMeta?: { entryPointId?: string } | null;
    leadType?: { name?: string | null } | null;
  }>,
): string | null {
  if (lead.externalSource === 'property_finder') {
    return 'PropertyFinder';
  }
  if (lead.externalSource === 'telesales') {
    return 'Telesales';
  }
  // Meta lead-gen ingestion tags leads with channel='meta_leads' while leadType
  // stays 'manual' (auto-assign parity), so the source has to come off the
  // channel or every Meta lead reads "Manual". 'meta_leadgen' is the legacy
  // channel value kept for older ingested leads.
  if (lead.channel === 'meta_leads' || lead.channel === 'meta_leadgen') {
    return 'Meta';
  }
  const name = lead.leadType?.name;
  if (!name) {
    return null;
  }
  return (
    entryPointSourceLabel(name, lead.channelMeta?.entryPointId ?? undefined) ?? sourceLabel(name)
  );
}

export function propertyTypeLabel(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if ((Object.values(PropertyType) as string[]).includes(value)) {
    return PROPERTY_TYPE_LABELS[value as PropertyType];
  }
  return titleCase(value);
}

/**
 * Generic title-case label for any backend snake_case / lowercase value.
 * Returns null for empty input. Use for channel / propertyUse / priority etc.
 */
export function genericLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return titleCase(value);
}

/**
 * Lucide icon per lead acquisition channel (`lead.channel`). Channel is a
 * freeform backend string (no enum), so keys mirror the known normalized
 * values; unknown channels fall back to a globe.
 */
export const CHANNEL_ICON: Record<string, IconName> = {
  public_website: 'Globe',
  valuation_form: 'Calculator',
  client_portal: 'Building2',
  portal: 'Building2',
  manual: 'UserPlus',
  referral: 'Share2',
  whatsapp: 'MessageCircle',
  email: 'Mail',
  google_ads: 'Megaphone',
  // Meta lead-gen ('meta_leadgen' is the legacy value), voicemail inbox and
  // dialer-created reception leads — without these they all fall back to Globe.
  // Lucide ships no brand glyphs, so Meta gets the ad-targeting icon.
  meta_leads: 'Target',
  meta_leadgen: 'Target',
  voicemail: 'Voicemail',
  reception: 'Headset',
  telesales: 'PhoneOutgoing',
};

/** Icon for a channel string; defaults to Globe for unknown/empty values. */
export function channelIcon(value: string | null | undefined): IconName {
  if (!value) return 'Globe';
  return CHANNEL_ICON[value.toLowerCase()] ?? 'Globe';
}

/** Map priority enum value to display label + token classes. */
export const PRIORITY_LABELS: Record<string, string> = {
  hot: 'Hot',
  warm: 'Warm',
  cold: 'Cold',
};

export interface PriorityTokens {
  bgClass: string;
  fgClass: string;
  label: string;
  /** Tinted Badge variant equivalent of the bg/fg pair. */
  variant: NonNullable<BadgeProps['variant']>;
}

export const PRIORITY_TOKENS: Record<string, PriorityTokens> = {
  hot: {
    bgClass: 'bg-destructive-soft',
    fgClass: 'text-destructive',
    label: 'Hot',
    variant: 'destructiveSoft',
  },
  warm: {
    bgClass: 'bg-warning-soft',
    fgClass: 'text-warning',
    label: 'Warm',
    variant: 'warningSoft',
  },
  cold: { bgClass: 'bg-info-soft', fgClass: 'text-info', label: 'Cold', variant: 'infoSoft' },
};

export function priorityTokens(value: string | null | undefined): PriorityTokens | null {
  if (!value) return null;
  return PRIORITY_TOKENS[value.toLowerCase()] ?? null;
}
