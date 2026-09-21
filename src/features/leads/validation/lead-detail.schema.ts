/**
 * Lead Detail edit-mode validation schema.
 *
 * Editable subset of `LeadDetail` consumed by `useLeadDetailUpdate` (task 10).
 * All fields are optional — the lead detail screen sends ONLY dirty fields in
 * the PATCH payload, so the schema must accept any subset.
 *
 * The web codebase performs lead-detail validation inline inside
 * `useLeadDetailUpdate` (see `boh-lead-magnet/src/features/leads/hooks/useLeadDetailUpdate.ts`)
 * — there is no canonical Zod schema for the edit form on web. Mobile
 * consolidates the cross-field range checks here so they live next to the
 * type contract.
 */

import { z } from 'zod';

/**
 * Range check: when both min and max are set, max must be `>=` min. Skipped
 * when either side is missing.
 */
function checkRange(
  ctx: z.RefinementCtx,
  min: number | undefined,
  max: number | undefined,
  minKey: string,
  maxKey: string,
  label: string,
): void {
  if (min === undefined || max === undefined) {
    return;
  }
  if (max < min) {
    ctx.addIssue({
      code: 'custom',
      message: `${label} max must be greater than or equal to min`,
      path: [maxKey],
    });
    ctx.addIssue({
      code: 'custom',
      message: `${label} max must be greater than or equal to min`,
      path: [minKey],
    });
  }
}

/**
 * Optional number that allows `null` (for explicit clears in PATCH payloads).
 */
const optionalNumber = z.number().nullish();

/**
 * Optional non-empty string. Empty strings are coerced to `undefined` so they
 * don't accidentally clear the backend value.
 */
const optionalString = z
  .string()
  .nullish()
  .transform((v) => {
    if (v === null) {
      return null;
    }
    if (v === undefined) {
      return undefined;
    }
    return v;
  });

export const leadDetailSchema = z
  .object({
    // Shared top-section requirement fields (LeadRequirementsCard).
    interest: optionalString,
    interestType: z.union([z.array(z.string()), z.string()]).nullish(),
    stateId: optionalString,
    neighbourhoodId: optionalString,
    preferredCity: optionalString,
    notes: optionalString,
    additionalNotes: optionalString,

    // Property taxonomy fields (PropertyTaxonomyCard).
    leadPropertyUse: optionalString,
    propertyType: optionalString,
    unitType: optionalString,
    bedrooms: optionalNumber,
    bathrooms: optionalNumber,
    projectBuilding: optionalString,
    askingPriceMin: optionalNumber,
    askingPriceMax: optionalNumber,
    askingRentMin: optionalNumber,
    askingRentMax: optionalNumber,
    budgetMin: optionalNumber,
    budgetMax: optionalNumber,
    furnishing: optionalString,
    moveInTimeline: optionalString,
    leaseTerm: optionalString,
    chequePreference: optionalString,
    purchaseTimeline: optionalString,
    financingStatus: optionalString,
    view: optionalString,
    intendedUse: optionalString,
    dealBreaker: optionalString,
    niceToHaves: optionalString,
  })
  .superRefine((values, ctx) => {
    const askingPriceMin =
      typeof values.askingPriceMin === 'number' ? values.askingPriceMin : undefined;
    const askingPriceMax =
      typeof values.askingPriceMax === 'number' ? values.askingPriceMax : undefined;
    const askingRentMin =
      typeof values.askingRentMin === 'number' ? values.askingRentMin : undefined;
    const askingRentMax =
      typeof values.askingRentMax === 'number' ? values.askingRentMax : undefined;
    const budgetMin = typeof values.budgetMin === 'number' ? values.budgetMin : undefined;
    const budgetMax = typeof values.budgetMax === 'number' ? values.budgetMax : undefined;

    checkRange(
      ctx,
      askingPriceMin,
      askingPriceMax,
      'askingPriceMin',
      'askingPriceMax',
      'Asking price',
    );
    checkRange(ctx, askingRentMin, askingRentMax, 'askingRentMin', 'askingRentMax', 'Asking rent');
    checkRange(ctx, budgetMin, budgetMax, 'budgetMin', 'budgetMax', 'Budget');
  });

export type LeadDetailFormValues = z.infer<typeof leadDetailSchema>;
