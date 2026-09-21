/**
 * Option lists for the Lead Details Profile card (secondary phone, nationality,
 * gender, buyer type, payment method, spoken languages).
 *
 * Enums mirror the backend (`Gender`, `LeadBuyerType`, `LeadPaymentMethod`).
 * Nationality values are ISO 3166-1 alpha-2 codes. Ported from web
 * (boh-lead-magnet) so mobile and web share the same value set.
 */

import { LeadBuyerType, LeadGender, LeadPaymentMethod } from './lead-enums';

export interface SelectOption {
  value: string;
  label: string;
}

export const GENDER_OPTIONS: readonly SelectOption[] = [
  { value: LeadGender.MALE, label: 'Male' },
  { value: LeadGender.FEMALE, label: 'Female' },
  { value: LeadGender.OTHER, label: 'Other' },
];

export const BUYER_TYPE_OPTIONS: readonly SelectOption[] = [
  { value: LeadBuyerType.HOME_BUYER, label: 'Home Buyer' },
  { value: LeadBuyerType.INVESTOR, label: 'Investor' },
];

export const PAYMENT_METHOD_OPTIONS: readonly SelectOption[] = [
  { value: LeadPaymentMethod.CASH, label: 'Cash' },
  { value: LeadPaymentMethod.MORTGAGE, label: 'Mortgage' },
];

/** Common spoken languages for the multi-select. */
export const SPOKEN_LANGUAGE_OPTIONS: readonly SelectOption[] = [
  'English',
  'Arabic',
  'Hindi',
  'Urdu',
  'French',
  'Spanish',
  'Russian',
  'Mandarin',
  'German',
  'Italian',
  'Portuguese',
  'Tagalog',
  'Bengali',
  'Persian',
  'Turkish',
  'Malayalam',
  'Tamil',
  'Punjabi',
].map((lang) => ({ value: lang, label: lang }));

/**
 * Canonical nationality option list — ISO 3166-1 alpha-2 code → country name.
 * Curated for the UAE real-estate market; extend as needed. Values are alpha-2
 * codes (the backend `nationality` column format).
 */
const COUNTRY_BY_CODE: Readonly<Record<string, string>> = {
  AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',
  QA: 'Qatar',
  KW: 'Kuwait',
  BH: 'Bahrain',
  OM: 'Oman',
  IN: 'India',
  PK: 'Pakistan',
  BD: 'Bangladesh',
  LK: 'Sri Lanka',
  PH: 'Philippines',
  EG: 'Egypt',
  JO: 'Jordan',
  LB: 'Lebanon',
  SY: 'Syria',
  IQ: 'Iraq',
  GB: 'United Kingdom',
  US: 'United States',
  CA: 'Canada',
  FR: 'France',
  DE: 'Germany',
  IT: 'Italy',
  ES: 'Spain',
  NL: 'Netherlands',
  RU: 'Russia',
  CN: 'China',
  JP: 'Japan',
  KR: 'South Korea',
  AU: 'Australia',
  ZA: 'South Africa',
  NG: 'Nigeria',
  KE: 'Kenya',
  TR: 'Turkey',
  IR: 'Iran',
  AF: 'Afghanistan',
  NP: 'Nepal',
  ID: 'Indonesia',
  MY: 'Malaysia',
  SG: 'Singapore',
  TH: 'Thailand',
  BR: 'Brazil',
  MA: 'Morocco',
  DZ: 'Algeria',
  TN: 'Tunisia',
  SD: 'Sudan',
  YE: 'Yemen',
  PS: 'Palestine',
};

/** Nationality options (ISO alpha-2 value, country-name label), sorted by label. */
export const NATIONALITY_OPTIONS: readonly SelectOption[] = Object.entries(COUNTRY_BY_CODE)
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => a.label.localeCompare(b.label));

/** ISO alpha-2 nationality code → display name (read-only views). */
export const NATIONALITY_LABEL_BY_CODE = new Map(
  NATIONALITY_OPTIONS.map((o) => [o.value, o.label]),
);

const SPOKEN_LANGUAGE_BY_LOWER = new Map(
  SPOKEN_LANGUAGE_OPTIONS.map((o) => [o.value.toLowerCase(), o.value]),
);

/**
 * Normalise stored spoken-language values to the canonical casing the
 * multi-select expects (exact-match options). A lead may store them lowercase
 * ('english') — map to the canonical value ('English') and drop unknowns.
 * Returns `[]` for non-array input.
 */
export function normalizeSpokenLanguages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((lang) => SPOKEN_LANGUAGE_BY_LOWER.get(lang.toLowerCase().trim()))
    .filter((lang): lang is string => lang !== undefined);
}
