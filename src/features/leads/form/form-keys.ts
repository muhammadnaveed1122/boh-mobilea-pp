/**
 * Flat, form-facing field model. `FormValues` is the working shape the
 * registry/engine/components operate on; the model adapter maps it to/from
 * `LeadDetail`.
 */

/**
 * Requirement-section field keys — the ones wired into the dependency engine
 * and `FIELD_REGISTRY`. Cascade/derive/reset rules only apply to these.
 */
export type RequirementFieldKey =
  | 'persona'
  | 'purpose'
  | 'stateId'
  | 'neighbourhoodId'
  | 'notes'
  | 'leadPropertyUse'
  | 'propertyType'
  | 'unitType'
  | 'bedrooms'
  | 'bathrooms'
  | 'projectBuilding'
  | 'askingPriceMin'
  | 'askingPriceMax'
  | 'askingRentMin'
  | 'askingRentMax'
  | 'budgetMin'
  | 'budgetMax'
  | 'furnishing'
  | 'moveInTimeline'
  | 'leaseTerm'
  | 'chequePreference'
  | 'purchaseTimeline'
  | 'financingStatus'
  | 'view'
  | 'intendedUse'
  | 'dealBreaker'
  | 'niceToHaves';

/**
 * Profile-enrichment field keys (Lead Details Profile card). They ride the same
 * shared form + PATCH path but have no registry entry / dependency graph.
 */
export type ProfileFieldKey =
  | 'secondaryPhone'
  | 'nationality'
  | 'gender'
  | 'buyerType'
  | 'paymentMethod'
  | 'spokenLanguages';

export type FieldKey = RequirementFieldKey | ProfileFieldKey;

export interface FormValues {
  persona?: string;
  purpose?: string;
  stateId?: string;
  stateName?: string;
  neighbourhoodId?: string;
  neighbourhoodName?: string;
  notes?: string;
  leadPropertyUse?: string;
  propertyType?: string;
  unitType?: string;
  bedrooms?: number;
  bathrooms?: number;
  projectBuilding?: string;
  askingPriceMin?: number;
  askingPriceMax?: number;
  askingRentMin?: number;
  askingRentMax?: number;
  budgetMin?: number;
  budgetMax?: number;
  furnishing?: string;
  moveInTimeline?: string;
  leaseTerm?: string;
  chequePreference?: string;
  purchaseTimeline?: string;
  financingStatus?: string;
  view?: string;
  intendedUse?: string;
  dealBreaker?: string;
  niceToHaves?: string;
  secondaryPhone?: string;
  nationality?: string;
  gender?: string;
  buyerType?: string;
  paymentMethod?: string;
  spokenLanguages?: string[];
}
