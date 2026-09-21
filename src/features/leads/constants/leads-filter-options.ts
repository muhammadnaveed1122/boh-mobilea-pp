/**
 * Option lists for the leads filter sheet — the mobile mirror of web's
 * `BoardFilterBar` + `LeadsMoreFiltersDrawer` option sets.
 *
 * Web references:
 * - `boh-lead-magnet/src/features/leads-board/constants/financingOptions.ts`
 *   (priority / assignment / stage / call / portal-source)
 * - `boh-lead-magnet/src/features/leads/constants/leadSources.ts` (source)
 * - `boh-lead-magnet/src/features/leads-board/components/LeadsMoreFiltersDrawer.tsx`
 *   (rooms)
 *
 * Values are backend tokens — do not relabel them here without changing the
 * API contract.
 */

import type { SelectOption } from './lead-profile-fields';
import { Furnishing, PropertyType, View as PreferredView } from './lead-enums';

/** Assignment quick-filter. Maps to `isAssigned` (see `buildLeadsQuery`). */
export type AssignmentOption = 'assigned' | 'unassigned';

export const ASSIGNMENT_OPTIONS: readonly { value: AssignmentOption; label: string }[] = [
  { value: 'assigned', label: 'Assigned' },
  { value: 'unassigned', label: 'Unassigned' },
];

/** Rooms tokens the backend understands (`studio` = 0, `7plus` = >= 7). */
export const ROOM_OPTIONS: readonly SelectOption[] = [
  { value: 'studio', label: 'Studio' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: '6', label: '6' },
  { value: '7plus', label: '7+' },
];

export const PORTAL_SOURCE_OPTIONS: readonly SelectOption[] = [
  { value: 'property_finder', label: 'Property Finder' },
  { value: 'bayut', label: 'Bayut' },
  { value: 'dubizzle', label: 'Dubizzle' },
];

export const CALL_OUTCOME_OPTIONS: readonly SelectOption[] = [
  { value: 'connected', label: 'Connected' },
  { value: 'missed', label: 'Missed' },
  { value: 'with_recording', label: 'With recording' },
];

/**
 * Acquisition-channel sources — the leaves a lead can be CREATED with. Flat
 * list, ordered by web's category order (`SOURCE_CATEGORIES` in
 * `leadSources.ts` → `LEAD_SOURCE_OPTIONS`).
 */
const SOURCE_CREATION_OPTIONS: readonly SelectOption[] = [
  { value: 'client_referral', label: 'Client Referral' },
  { value: 'personal_referral', label: 'Personal Referral' },
  { value: 'friend', label: 'Friend' },
  { value: 'property_owner', label: 'Property Owner' },
  { value: 'property_finder', label: 'Property Finder' },
  { value: 'bayut', label: 'Bayut' },
  { value: 'dubizzle', label: 'Dubizzle' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'snapchat', label: 'Snapchat' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'public_website', label: 'Company Website' },
  { value: 'company_app', label: 'Company App' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'open_house', label: 'Open House' },
  { value: 'import', label: 'Import' },
  { value: 'pixxi_forms', label: 'Pixxi Forms' },
  { value: 'company_lead', label: 'Company Lead' },
];

/**
 * FILTER-ONLY sources — origins a lead can arrive from but that the manual
 * create flow never offers. Mirrors web `LEAD_SOURCE_FILTER_ONLY_OPTIONS`.
 * Each matches how the backend `source` predicate resolves the value
 * (channel OR externalSource OR leadType.name):
 *   - `manual`              → `channel = 'manual'`
 *   - `telesales`           → `externalSource = 'telesales'` (telesales handoffs)
 *   - `request_a_call_back` → `leadType.name = 'request_a_call_back'`
 *   - `meta_leads`          → `channel = 'meta_leads'` (Meta lead-gen ingestion)
 *   - `voicemail`           → `channel = 'voicemail'` (reception voicemail inbox)
 *   - `reception`           → `channel = 'reception'` (created from the dialer mid-call)
 */
const SOURCE_FILTER_ONLY_OPTIONS: readonly SelectOption[] = [
  { value: 'telesales', label: 'Telesales' },
  { value: 'request_a_call_back', label: 'Request a Callback' },
  { value: 'manual', label: 'Manual' },
  { value: 'meta_leads', label: 'Meta Leads' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'reception', label: 'Reception' },
];

/**
 * Unified source filter — matches a source leaf on `channel` OR
 * `externalSource`. Creation sources plus the filter-only origins above, the
 * same set web's `BoardFilterBar` offers (`LEAD_SOURCE_FILTER_OPTIONS`).
 */
export const SOURCE_OPTIONS: readonly SelectOption[] = [
  ...SOURCE_CREATION_OPTIONS,
  ...SOURCE_FILTER_ONLY_OPTIONS,
];

function titleCase(token: string): string {
  return token
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Property types from the shared enum. Web additionally merges admin-managed
 * custom types from Platform Settings; mobile has no settings client, so the
 * built-ins are what's offered here.
 */
export const PROPERTY_TYPE_OPTIONS: readonly SelectOption[] = Object.values(PropertyType).map(
  (value) => ({ value, label: titleCase(value) }),
);

export const FURNISHING_OPTIONS: readonly SelectOption[] = Object.values(Furnishing).map(
  (value) => ({ value, label: titleCase(value) }),
);

export const VIEW_OPTIONS: readonly SelectOption[] = Object.values(PreferredView).map((value) => ({
  value,
  label: titleCase(value),
}));

/**
 * Dial-code prefixes for the Country Code filter (matches phones starting with
 * any picked code). Web uses a full phone-picker dataset; this is the UAE
 * market's realistic set plus the common expat origins, which keeps the
 * bundle free of a 240-country table for a filter nobody scrolls past.
 */
export const DIAL_CODE_OPTIONS: readonly SelectOption[] = [
  { value: '+971', label: 'United Arab Emirates (+971)' },
  { value: '+966', label: 'Saudi Arabia (+966)' },
  { value: '+973', label: 'Bahrain (+973)' },
  { value: '+974', label: 'Qatar (+974)' },
  { value: '+965', label: 'Kuwait (+965)' },
  { value: '+968', label: 'Oman (+968)' },
  { value: '+20', label: 'Egypt (+20)' },
  { value: '+962', label: 'Jordan (+962)' },
  { value: '+961', label: 'Lebanon (+961)' },
  { value: '+963', label: 'Syria (+963)' },
  { value: '+964', label: 'Iraq (+964)' },
  { value: '+98', label: 'Iran (+98)' },
  { value: '+90', label: 'Turkey (+90)' },
  { value: '+92', label: 'Pakistan (+92)' },
  { value: '+91', label: 'India (+91)' },
  { value: '+880', label: 'Bangladesh (+880)' },
  { value: '+94', label: 'Sri Lanka (+94)' },
  { value: '+63', label: 'Philippines (+63)' },
  { value: '+44', label: 'United Kingdom (+44)' },
  { value: '+1', label: 'United States / Canada (+1)' },
  { value: '+33', label: 'France (+33)' },
  { value: '+49', label: 'Germany (+49)' },
  { value: '+39', label: 'Italy (+39)' },
  { value: '+7', label: 'Russia / Kazakhstan (+7)' },
  { value: '+86', label: 'China (+86)' },
  { value: '+27', label: 'South Africa (+27)' },
  { value: '+234', label: 'Nigeria (+234)' },
  { value: '+61', label: 'Australia (+61)' },
];
