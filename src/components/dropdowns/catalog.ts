/**
 * Dropdown catalog — the single source of truth for every dropdown's
 * options/labels across the app. Static dropdowns use an options array;
 * dependent dropdowns use a pure resolver over a typed context.
 *
 * Values reference `lead-enums` so backend casing stays canonical here.
 */

import {
  ChequePreference,
  FinancingStatus,
  Furnishing,
  IntendedUse,
  InterestType,
  LeadPropertyUse,
  LeaseTerm,
  MoveInTimeline,
  Persona,
  PropertyType,
  PurchaseTimeline,
  UnitType,
  View,
} from '@/features/leads/constants/lead-enums';

import type { DropdownOption, DropdownSpec } from './types';

const opt = (value: string, label: string): DropdownOption => ({ value, label });

// --- Persona / Purpose -----------------------------------------------------

const PERSONA_OPTIONS: readonly DropdownOption[] = [
  opt(Persona.LANDLORD, 'Landlord'),
  opt(Persona.BUYER, 'Buyer'),
  opt(Persona.SELLER, 'Seller'),
  opt(Persona.TENANT, 'Tenant'),
];

const PURPOSE_LABELS: Readonly<Record<string, string>> = {
  [InterestType.SELL_MY_PROPERTY]: 'Sell My Property',
  [InterestType.RENT_OUT_MY_PROPERTY]: 'Rent Out My Property',
  [InterestType.FIND_A_PROPERTY_TO_BUY]: 'Find a Property to Buy',
  [InterestType.FIND_A_PROPERTY_TO_RENT]: 'Find a Property to Rent',
  [InterestType.GET_VALUATION]: 'Get Valuation',
  [InterestType.OTHER]: 'Other',
};

/** Persona → allowed purposes (spec §3). */
export const PURPOSES_BY_PERSONA: Readonly<Record<string, readonly InterestType[]>> = {
  [Persona.LANDLORD]: [
    InterestType.SELL_MY_PROPERTY,
    InterestType.RENT_OUT_MY_PROPERTY,
    InterestType.GET_VALUATION,
    InterestType.OTHER,
  ],
  [Persona.BUYER]: [
    InterestType.FIND_A_PROPERTY_TO_BUY,
    InterestType.GET_VALUATION,
    InterestType.OTHER,
  ],
  [Persona.SELLER]: [InterestType.SELL_MY_PROPERTY, InterestType.GET_VALUATION, InterestType.OTHER],
  [Persona.TENANT]: [InterestType.FIND_A_PROPERTY_TO_RENT, InterestType.OTHER],
};

// --- Property Use / Type / Unit Type ---------------------------------------

const PROPERTY_TYPE_LABELS: Readonly<Record<string, string>> = {
  [PropertyType.APARTMENT]: 'Apartment',
  [PropertyType.VILLA]: 'Villa',
  [PropertyType.TOWNHOUSE]: 'Townhouse',
  [PropertyType.RESIDENTIAL_PLOT]: 'Residential Plot',
  [PropertyType.OFFICE]: 'Office',
  [PropertyType.RETAIL]: 'Retail',
  [PropertyType.WAREHOUSE]: 'Warehouse',
  [PropertyType.COMMERCIAL_PLOT]: 'Commercial Plot',
};

const RESIDENTIAL_TYPES: readonly PropertyType[] = [
  PropertyType.APARTMENT,
  PropertyType.VILLA,
  PropertyType.TOWNHOUSE,
  PropertyType.RESIDENTIAL_PLOT,
];
const COMMERCIAL_TYPES: readonly PropertyType[] = [
  PropertyType.OFFICE,
  PropertyType.RETAIL,
  PropertyType.WAREHOUSE,
  PropertyType.COMMERCIAL_PLOT,
];

const UNIT_TYPE_LABELS: Readonly<Record<string, string>> = {
  [UnitType.STUDIO]: 'Studio',
  [UnitType.ONE_BR]: '1 BR',
  [UnitType.TWO_BR]: '2 BR',
  [UnitType.THREE_BR]: '3 BR',
  [UnitType.FOUR_BR]: '4 BR',
  [UnitType.FIVE_BR]: '5 BR',
  [UnitType.SIX_BR_PLUS]: '6+ BR',
  [UnitType.SHELL_AND_CORE]: 'Shell & Core',
  [UnitType.FITTED]: 'Fitted',
  [UnitType.FURNISHED]: 'Furnished',
  [UnitType.FULL_FLOOR]: 'Full Floor',
  [UnitType.RETAIL_UNIT]: 'Retail Unit',
  [UnitType.FNB_UNIT]: 'F&B Unit',
  [UnitType.KIOSK]: 'Kiosk',
  [UnitType.WAREHOUSE]: 'Warehouse',
  [UnitType.COMMERCIAL_PLOT]: 'Commercial Plot',
};

const RESIDENTIAL_UNIT_TYPES: readonly UnitType[] = [
  UnitType.STUDIO,
  UnitType.ONE_BR,
  UnitType.TWO_BR,
  UnitType.THREE_BR,
  UnitType.FOUR_BR,
  UnitType.FIVE_BR,
  UnitType.SIX_BR_PLUS,
];

const COMMERCIAL_UNIT_TYPES_BY_TYPE: Readonly<Partial<Record<PropertyType, readonly UnitType[]>>> =
  {
    [PropertyType.OFFICE]: [
      UnitType.SHELL_AND_CORE,
      UnitType.FITTED,
      UnitType.FURNISHED,
      UnitType.FULL_FLOOR,
    ],
    [PropertyType.RETAIL]: [UnitType.RETAIL_UNIT, UnitType.FNB_UNIT, UnitType.KIOSK],
    [PropertyType.WAREHOUSE]: [UnitType.WAREHOUSE],
    [PropertyType.COMMERCIAL_PLOT]: [UnitType.COMMERCIAL_PLOT],
  };

// --- Context types ---------------------------------------------------------

export interface PersonaCtx {
  readonly persona: string | undefined;
}
export interface PropertyTypeCtx {
  readonly propertyUse: string | undefined;
}
export interface UnitTypeCtx {
  readonly propertyUse: string | undefined;
  readonly propertyType: string | undefined;
}

const toOptions = (values: readonly string[], labels: Record<string, string>) =>
  values.map((v) => opt(v, labels[v] ?? v));

// --- Catalog ---------------------------------------------------------------

export const dropdownCatalog = {
  persona: {
    id: 'persona',
    label: 'Persona',
    placeholder: 'Select Persona',
    options: PERSONA_OPTIONS,
  } satisfies DropdownSpec,

  purpose: {
    id: 'purpose',
    label: 'Purpose',
    placeholder: ({ persona }: PersonaCtx) => (persona ? 'Select Purpose' : 'Select Persona first'),
    options: ({ persona }: PersonaCtx) =>
      persona
        ? (PURPOSES_BY_PERSONA[persona] ?? []).map((v) => opt(v, PURPOSE_LABELS[v] ?? v))
        : [],
  } satisfies DropdownSpec<PersonaCtx>,

  propertyUse: {
    id: 'propertyUse',
    label: 'Property Use',
    placeholder: 'Select Property Use',
    options: [
      opt(LeadPropertyUse.RESIDENTIAL, 'Residential'),
      opt(LeadPropertyUse.COMMERCIAL, 'Commercial'),
    ],
  } satisfies DropdownSpec,

  propertyType: {
    id: 'propertyType',
    label: 'Property Type',
    placeholder: ({ propertyUse }: PropertyTypeCtx) =>
      propertyUse ? 'Select Property Type' : 'Select Property Use first',
    options: ({ propertyUse }: PropertyTypeCtx) => {
      if (propertyUse === LeadPropertyUse.RESIDENTIAL) {
        return toOptions(RESIDENTIAL_TYPES, PROPERTY_TYPE_LABELS);
      }
      if (propertyUse === LeadPropertyUse.COMMERCIAL) {
        return toOptions(COMMERCIAL_TYPES, PROPERTY_TYPE_LABELS);
      }
      return [];
    },
  } satisfies DropdownSpec<PropertyTypeCtx>,

  unitType: {
    id: 'unitType',
    label: 'Unit Type',
    placeholder: ({ propertyType }: UnitTypeCtx) =>
      propertyType ? 'Select Unit Type' : 'Select Property Type first',
    options: ({ propertyUse, propertyType }: UnitTypeCtx) => {
      if (propertyUse === LeadPropertyUse.RESIDENTIAL) {
        if (propertyType === PropertyType.RESIDENTIAL_PLOT) {
          return [];
        }
        return toOptions(RESIDENTIAL_UNIT_TYPES, UNIT_TYPE_LABELS);
      }
      if (propertyUse === LeadPropertyUse.COMMERCIAL) {
        const set = COMMERCIAL_UNIT_TYPES_BY_TYPE[propertyType as PropertyType] ?? [];
        return toOptions(set, UNIT_TYPE_LABELS);
      }
      return [];
    },
  } satisfies DropdownSpec<UnitTypeCtx>,

  furnishing: {
    id: 'furnishing',
    label: 'Furnishing',
    placeholder: 'Select Furnishing',
    options: [
      opt(Furnishing.UNFURNISHED, 'Unfurnished'),
      opt(Furnishing.SEMI_FURNISHED, 'Semi-Furnished'),
      opt(Furnishing.FURNISHED, 'Furnished'),
    ],
  } satisfies DropdownSpec,

  moveInTimeline: {
    id: 'moveInTimeline',
    label: 'Move-in Timeline',
    placeholder: 'Select Move-in Timeline',
    options: [
      opt(MoveInTimeline.IMMEDIATE, 'Immediate'),
      opt(MoveInTimeline.WITHIN_2_WEEKS, 'Within 2 weeks'),
      opt(MoveInTimeline.WITHIN_1_MONTH, 'Within 1 month'),
      opt(MoveInTimeline.WITHIN_2_3_MONTHS, 'Within 2–3 months'),
      opt(MoveInTimeline.FLEXIBLE, 'Flexible'),
    ],
  } satisfies DropdownSpec,

  leaseTerm: {
    id: 'leaseTerm',
    label: 'Lease Term',
    placeholder: 'Select Lease Term',
    options: [
      opt(LeaseTerm.SIX_MONTHS, '6 months'),
      opt(LeaseTerm.TWELVE_MONTHS, '12 months'),
      opt(LeaseTerm.FLEXIBLE, 'Flexible'),
    ],
  } satisfies DropdownSpec,

  chequePreference: {
    id: 'chequePreference',
    label: 'Cheque Preference',
    placeholder: 'Select Cheque Preference',
    options: [
      opt(ChequePreference.ONE_CHEQUE, '1 cheque'),
      opt(ChequePreference.TWO_CHEQUES, '2 cheques'),
      opt(ChequePreference.FOUR_CHEQUES, '4 cheques'),
      opt(ChequePreference.SIX_CHEQUES, '6 cheques'),
      opt(ChequePreference.TWELVE_CHEQUES, '12 cheques'),
      opt(ChequePreference.FLEXIBLE, 'Flexible'),
    ],
  } satisfies DropdownSpec,

  purchaseTimeline: {
    id: 'purchaseTimeline',
    label: 'Purchase Timeline',
    placeholder: 'Select Purchase Timeline',
    options: [
      opt(PurchaseTimeline.IMMEDIATE, 'Immediate'),
      opt(PurchaseTimeline.WITHIN_3_MONTHS, 'Within 3 months'),
      opt(PurchaseTimeline.WITHIN_6_MONTHS, 'Within 6 months'),
      opt(PurchaseTimeline.WITHIN_12_MONTHS, 'Within 12 months'),
      opt(PurchaseTimeline.FLEXIBLE, 'Flexible'),
    ],
  } satisfies DropdownSpec,

  financingStatus: {
    id: 'financingStatus',
    label: 'Financing Status',
    placeholder: 'Select Financing Status',
    options: [
      opt(FinancingStatus.CASH_BUYER, 'Cash Buyer'),
      opt(FinancingStatus.PRE_APPROVED_MORTGAGE, 'Pre-Approved Mortgage'),
      opt(FinancingStatus.MORTGAGE_IN_PROCESS, 'Mortgage in Process'),
      opt(FinancingStatus.NEEDS_MORTGAGE_ASSISTANCE, 'Needs Mortgage Assistance'),
      opt(FinancingStatus.EXPLORING, 'Not Sure / Exploring'),
      opt(FinancingStatus.NOT_CONFIRMED, 'Financing Not Confirmed'),
    ],
  } satisfies DropdownSpec,

  view: {
    id: 'view',
    label: 'View',
    placeholder: 'Select View',
    options: [
      opt(View.SEA_VIEW, 'Sea View'),
      opt(View.CITY_VIEW, 'City View'),
      opt(View.GARDEN_VIEW, 'Garden View'),
      opt(View.POOL_VIEW, 'Pool View'),
      opt(View.CANAL_VIEW, 'Canal View'),
      opt(View.GOLF_VIEW, 'Golf View'),
      opt(View.LANDMARK_VIEW, 'Landmark View'),
      opt(View.COMMUNITY_VIEW, 'Community View'),
      opt(View.PARK_VIEW, 'Park View'),
      opt(View.MARINA_VIEW, 'Marina View'),
      opt(View.BOULEVARD_VIEW, 'Boulevard View'),
      opt(View.OTHER, 'Other'),
    ],
  } satisfies DropdownSpec,

  intendedUse: {
    id: 'intendedUse',
    label: 'Intended Use',
    placeholder: 'Select Intended Use',
    options: [
      opt(IntendedUse.PERSONAL_RESIDENCE, 'Personal Residence'),
      opt(IntendedUse.INVESTMENT, 'Investment'),
      opt(IntendedUse.HOLIDAY_HOME, 'Holiday Home'),
      opt(IntendedUse.BUSINESS_USE, 'Business Use'),
      opt(IntendedUse.RESALE, 'Resale'),
      opt(IntendedUse.OTHER, 'Other'),
    ],
  } satisfies DropdownSpec,
} as const;

export type DropdownCatalog = typeof dropdownCatalog;
