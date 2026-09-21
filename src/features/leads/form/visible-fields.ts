/**
 * Pure visibility selector. Returns the ordered list of `FieldKey`s to
 * render for the current purpose + values. `*Max` pair keys are excluded —
 * the `*Min` currencyPair field renders both inputs.
 */

import type { FieldKey, FormValues } from './form-keys';
import { PURPOSE_FIELDS, SHARED_FIELDS } from './field-registry';

const PAIR_MAX_KEYS: ReadonlySet<FieldKey> = new Set([
  'askingPriceMax',
  'askingRentMax',
  'budgetMax',
]);

const COMMERCIAL_HIDDEN: ReadonlySet<FieldKey> = new Set(['bedrooms', 'bathrooms']);

export function visibleFields(purpose: string | undefined, values: FormValues): FieldKey[] {
  if (!purpose) {
    return ['persona', 'purpose'];
  }

  const specific = PURPOSE_FIELDS[purpose] ?? [];
  const ordered: FieldKey[] = [...SHARED_FIELDS, ...specific];
  const isCommercial = values.leadPropertyUse === 'commercial';
  const isResidentialPlot =
    values.leadPropertyUse === 'residential' && values.propertyType === 'residential_plot';

  return ordered.filter((key) => {
    if (PAIR_MAX_KEYS.has(key)) {
      return false;
    }
    if (isCommercial && COMMERCIAL_HIDDEN.has(key)) {
      return false;
    }
    if (key === 'unitType' && isResidentialPlot) {
      return false;
    }
    return true;
  });
}
