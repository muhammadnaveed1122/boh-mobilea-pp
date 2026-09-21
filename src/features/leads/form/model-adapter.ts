/**
 * Adapter between the flat form model and the `LeadDetail` payload shape.
 *
 *  - persona  ↔ lead.interest
 *  - purpose  ↔ lead.interestType[0]  (array on the wire; primary on form)
 *  - City/Area ids come from stateId/neighbourhoodId, falling back to the
 *    `state`/`neighbourhood` objects the backend returns on read; their
 *    display names are sourced from those same nested objects
 *  - notes falls back to `additionalNotes` (legacy payload key)
 *  - all other keys are 1:1
 */

import type { LeadDetail } from '@/features/leads/models/lead-detail';

import { normalizeSpokenLanguages } from '../constants/lead-profile-fields';

import type { FieldKey, FormValues } from './form-keys';

export function leadToFormValues(lead: Partial<LeadDetail>): FormValues {
  const interestType = Array.isArray(lead.interestType)
    ? lead.interestType[0]
    : (lead.interestType as string | undefined);

  return {
    persona: lead.interest as string | undefined,
    purpose: interestType,
    stateId: lead.stateId ?? lead.state?.id,
    stateName: lead.state?.name,
    neighbourhoodId: lead.neighbourhoodId ?? lead.neighbourhood?.id,
    neighbourhoodName: lead.neighbourhood?.name,
    notes: lead.notes ?? lead.additionalNotes,
    leadPropertyUse: lead.leadPropertyUse as string | undefined,
    propertyType: lead.propertyType as string | undefined,
    unitType: lead.unitType as string | undefined,
    bedrooms: lead.bedrooms ?? undefined,
    bathrooms: lead.bathrooms ?? undefined,
    projectBuilding: lead.projectBuilding as string | undefined,
    askingPriceMin: lead.askingPriceMin ?? undefined,
    askingPriceMax: lead.askingPriceMax ?? undefined,
    askingRentMin: lead.askingRentMin ?? undefined,
    askingRentMax: lead.askingRentMax ?? undefined,
    budgetMin: lead.budgetMin ?? undefined,
    budgetMax: lead.budgetMax ?? undefined,
    furnishing: lead.furnishing as string | undefined,
    moveInTimeline: lead.moveInTimeline as string | undefined,
    leaseTerm: lead.leaseTerm as string | undefined,
    chequePreference: lead.chequePreference as string | undefined,
    purchaseTimeline: lead.purchaseTimeline as string | undefined,
    financingStatus: lead.financingStatus as string | undefined,
    view: lead.view as string | undefined,
    intendedUse: lead.intendedUse as string | undefined,
    dealBreaker: lead.dealBreaker as string | undefined,
    niceToHaves: lead.niceToHaves as string | undefined,
    secondaryPhone: lead.secondaryPhone ?? undefined,
    nationality: lead.nationality ?? undefined,
    gender: lead.gender ?? undefined,
    buyerType: lead.buyerType ?? undefined,
    paymentMethod: lead.paymentMethod ?? undefined,
    spokenLanguages: normalizeSpokenLanguages(lead.spokenLanguages),
  };
}

/** Map a single form field change to its `LeadDetail` patch fragment. */
export function formChangeToLeadPatch(
  key: FieldKey,
  value: FormValues[FieldKey],
): Partial<LeadDetail> {
  if (key === 'persona') {
    return { interest: value as LeadDetail['interest'] };
  }
  if (key === 'purpose') {
    return {
      interestType: (value === undefined
        ? undefined
        : [value as string]) as LeadDetail['interestType'],
    };
  }
  // The backend lead-update DTO has no `notes` column — free-text notes are
  // persisted as `additionalNotes`. Read side resolves `notes ?? additionalNotes`.
  if (key === 'notes') {
    return { additionalNotes: value as LeadDetail['additionalNotes'] };
  }
  return { [key]: value } as Partial<LeadDetail>;
}
