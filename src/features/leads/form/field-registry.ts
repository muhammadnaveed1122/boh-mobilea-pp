/**
 * Lead-form field registry. Wires each `FieldKey` to a catalog dropdown
 * (`specId`), its renderer `kind`, and its declared dependency/reset/derive
 * rules. This is the ONLY place lead-specific wiring lives — option data is
 * in the catalog, cascade logic is in the engine.
 */

import {
  dropdownCatalog,
  resolveOptions,
  type DropdownCatalog,
  type DropdownOption,
} from '@/components/dropdowns';
import { InterestType } from '@/features/leads/constants/lead-enums';

import type { FieldKey, FormValues, RequirementFieldKey } from './form-keys';

export type FieldKind = 'select' | 'number' | 'currencyPair' | 'text' | 'textarea';

export interface FieldDef {
  readonly key: FieldKey;
  readonly kind: FieldKind;
  /** Catalog spec id (select only). */
  readonly specId?: string;
  /** Re-resolve my options + clear my value if invalid when these change. */
  readonly dependsOn?: readonly FieldKey[];
  /** When I change, clear these fields. */
  readonly resetOnChange?: readonly FieldKey[];
  /** Build the catalog ctx object from current values (select only). */
  readonly ctxFrom?: (v: FormValues) => unknown;
  /** Auto-computed value (e.g. bedrooms from unit type). */
  readonly derived?: (v: FormValues) => number | undefined;
  /** Always read-only (e.g. derived bedrooms). */
  readonly readOnly?: boolean;
  /** For currencyPair: the paired max key (rendered together). */
  readonly pairMax?: FieldKey;
  /** Options come from the network, not the catalog. */
  readonly apiFed?: true;
}

export const SHARED_FIELDS: readonly FieldKey[] = [
  'persona',
  'purpose',
  'stateId',
  'neighbourhoodId',
  'notes',
];

/** Purpose → ordered purpose-specific fields (spec §5). */
export const PURPOSE_FIELDS: Readonly<Record<string, readonly FieldKey[]>> = {
  [InterestType.SELL_MY_PROPERTY]: [
    'leadPropertyUse',
    'propertyType',
    'unitType',
    'bedrooms',
    'bathrooms',
    'projectBuilding',
    'askingPriceMin',
    'askingPriceMax',
  ],
  [InterestType.RENT_OUT_MY_PROPERTY]: [
    'leadPropertyUse',
    'propertyType',
    'unitType',
    'bedrooms',
    'askingRentMin',
    'askingRentMax',
    'furnishing',
    'moveInTimeline',
    'leaseTerm',
    'chequePreference',
  ],
  [InterestType.FIND_A_PROPERTY_TO_RENT]: [
    'budgetMin',
    'budgetMax',
    'leadPropertyUse',
    'propertyType',
    'unitType',
    'bedrooms',
    'furnishing',
    'moveInTimeline',
    'leaseTerm',
    'chequePreference',
    'dealBreaker',
    'niceToHaves',
  ],
  [InterestType.FIND_A_PROPERTY_TO_BUY]: [
    'leadPropertyUse',
    'propertyType',
    'unitType',
    'bedrooms',
    'budgetMin',
    'budgetMax',
    'purchaseTimeline',
    'financingStatus',
    'furnishing',
    'view',
    'intendedUse',
    'dealBreaker',
    'niceToHaves',
  ],
  [InterestType.GET_VALUATION]: [],
  [InterestType.OTHER]: [],
};

/** Every purpose-specific field key, deduped — used for reset rules. */
const ALL_PURPOSE_FIELDS: readonly FieldKey[] = Array.from(
  new Set(Object.values(PURPOSE_FIELDS).flat()),
);

const BEDROOMS_BY_UNIT: Readonly<Record<string, number>> = {
  studio: 0,
  one_br: 1,
  two_br: 2,
  three_br: 3,
  four_br: 4,
  five_br: 5,
  six_br_plus: 6,
};

export function bedroomsFromUnitType(unitType: string | undefined): number | undefined {
  if (!unitType) {
    return undefined;
  }
  return BEDROOMS_BY_UNIT[unitType];
}

// Keyed by `RequirementFieldKey` only — profile-enrichment fields ride the
// shared form but have no dependency graph, so they have no registry entry.
export const FIELD_REGISTRY: Readonly<Record<RequirementFieldKey, FieldDef>> = {
  persona: {
    key: 'persona',
    kind: 'select',
    specId: 'persona',
    resetOnChange: ['purpose', ...ALL_PURPOSE_FIELDS],
  },
  purpose: {
    key: 'purpose',
    kind: 'select',
    specId: 'purpose',
    dependsOn: ['persona'],
    ctxFrom: (v) => ({ persona: v.persona }),
    resetOnChange: [...ALL_PURPOSE_FIELDS],
  },
  stateId: {
    key: 'stateId',
    kind: 'select',
    specId: 'state',
    apiFed: true,
    resetOnChange: ['neighbourhoodId'],
  },
  neighbourhoodId: {
    key: 'neighbourhoodId',
    kind: 'select',
    specId: 'neighbourhood',
    apiFed: true,
    dependsOn: ['stateId'],
  },
  notes: { key: 'notes', kind: 'textarea' },

  leadPropertyUse: {
    key: 'leadPropertyUse',
    kind: 'select',
    specId: 'propertyUse',
  },
  propertyType: {
    key: 'propertyType',
    kind: 'select',
    specId: 'propertyType',
    dependsOn: ['leadPropertyUse'],
    ctxFrom: (v) => ({ propertyUse: v.leadPropertyUse }),
  },
  unitType: {
    key: 'unitType',
    kind: 'select',
    specId: 'unitType',
    dependsOn: ['leadPropertyUse', 'propertyType'],
    ctxFrom: (v) => ({ propertyUse: v.leadPropertyUse, propertyType: v.propertyType }),
  },
  bedrooms: {
    key: 'bedrooms',
    kind: 'number',
    dependsOn: ['unitType'],
    derived: (v) => bedroomsFromUnitType(v.unitType),
    readOnly: true,
  },
  bathrooms: { key: 'bathrooms', kind: 'number' },
  projectBuilding: { key: 'projectBuilding', kind: 'text' },

  askingPriceMin: { key: 'askingPriceMin', kind: 'currencyPair', pairMax: 'askingPriceMax' },
  askingPriceMax: { key: 'askingPriceMax', kind: 'number' },
  askingRentMin: { key: 'askingRentMin', kind: 'currencyPair', pairMax: 'askingRentMax' },
  askingRentMax: { key: 'askingRentMax', kind: 'number' },
  budgetMin: { key: 'budgetMin', kind: 'currencyPair', pairMax: 'budgetMax' },
  budgetMax: { key: 'budgetMax', kind: 'number' },

  furnishing: { key: 'furnishing', kind: 'select', specId: 'furnishing' },
  moveInTimeline: { key: 'moveInTimeline', kind: 'select', specId: 'moveInTimeline' },
  leaseTerm: { key: 'leaseTerm', kind: 'select', specId: 'leaseTerm' },
  chequePreference: { key: 'chequePreference', kind: 'select', specId: 'chequePreference' },
  purchaseTimeline: { key: 'purchaseTimeline', kind: 'select', specId: 'purchaseTimeline' },
  financingStatus: { key: 'financingStatus', kind: 'select', specId: 'financingStatus' },
  view: { key: 'view', kind: 'select', specId: 'view' },
  intendedUse: { key: 'intendedUse', kind: 'select', specId: 'intendedUse' },
  dealBreaker: { key: 'dealBreaker', kind: 'textarea' },
  niceToHaves: { key: 'niceToHaves', kind: 'textarea' },
};

/**
 * Single boundary between a registry field and its catalog dropdown spec.
 *
 *  - `apiFed` fields ⇒ `[]` (City/Area options come from the locations API,
 *    fed in by the caller via `DependentSelect`'s `options` override).
 *  - catalog-backed selects ⇒ resolved from `dropdownCatalog[specId]`,
 *    applying the field's declared `ctxFrom`. A `specId` that is missing
 *    from the catalog is a wiring typo: we `console.error` and return `[]`
 *    so it surfaces loudly instead of silently degrading to an empty field.
 *  - non-select fields ⇒ `[]`.
 */
export function resolveFieldOptions(def: FieldDef, values: FormValues): readonly DropdownOption[] {
  if (def.apiFed) {
    return [];
  }
  if (def.kind !== 'select') {
    return [];
  }
  const spec = def.specId ? dropdownCatalog[def.specId as keyof DropdownCatalog] : undefined;
  if (!spec) {
    console.error(
      `[field-registry] No catalog spec for non-apiFed select "${def.key}" (specId="${def.specId}"). Check the registry/catalog wiring.`,
    );
    return [];
  }
  const ctx = def.ctxFrom ? def.ctxFrom(values) : undefined;
  return resolveOptions(spec as never, ctx);
}
