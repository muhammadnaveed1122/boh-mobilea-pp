/**
 * Pure dependency engine. Given the current values, the changed key, and its
 * new value, returns the next values with all cascade/reset/derive rules
 * applied. No React, no side effects.
 *
 * Order per change:
 *  1. write the new value
 *  2. apply `resetOnChange` (hard-clear listed keys)
 *  3. special rule: leadPropertyUse → commercial hard-clears bedrooms/bathrooms
 *  4. cascade: for each field that `dependsOn` the changed key, if its value
 *     is no longer in its resolved options, clear it — then recurse
 *  5. recompute every `derived` field
 */

import { FIELD_REGISTRY, resolveFieldOptions } from './field-registry';
import type { FieldKey, FormValues, RequirementFieldKey } from './form-keys';

const ALL_KEYS = Object.keys(FIELD_REGISTRY) as RequirementFieldKey[];

const DERIVED_KEYS: readonly RequirementFieldKey[] = ALL_KEYS.filter(
  (k) => typeof FIELD_REGISTRY[k].derived === 'function',
);

function dependentsOf(key: FieldKey): RequirementFieldKey[] {
  return ALL_KEYS.filter((k) => FIELD_REGISTRY[k].dependsOn?.includes(key));
}

function recomputeDerived(values: FormValues): FormValues {
  let next = values;
  for (const key of DERIVED_KEYS) {
    const derived = FIELD_REGISTRY[key].derived!(next);
    if (next[key] !== derived) {
      next = { ...next, [key]: derived };
    }
  }
  return next;
}

function cascadeClear(values: FormValues, changedKey: FieldKey): FormValues {
  let next = values;
  for (const depKey of dependentsOf(changedKey)) {
    const def = FIELD_REGISTRY[depKey];
    const current = next[depKey];
    // Derived fields are recomputed separately; API-fed fields can't be
    // validated here (options come from the network).
    if (current === undefined || def.derived || def.apiFed) {
      continue;
    }
    const valid = resolveFieldOptions(def, next);
    if (!valid.some((o) => o.value === current)) {
      next = { ...next, [depKey]: undefined };
      next = cascadeClear(next, depKey);
    }
  }
  return next;
}

export function applyDependencies(
  values: FormValues,
  changedKey: FieldKey,
  nextValue: FormValues[FieldKey],
): FormValues {
  // Profile-enrichment fields (secondaryPhone, nationality, gender, …) live
  // outside the requirement dependency graph — no registry entry, no cascade.
  if (!(changedKey in FIELD_REGISTRY)) {
    return { ...values, [changedKey]: nextValue };
  }
  const requirementKey = changedKey as RequirementFieldKey;
  const def = FIELD_REGISTRY[requirementKey];
  let next: FormValues = { ...values, [changedKey]: nextValue };

  for (const k of def.resetOnChange ?? []) {
    if (next[k] !== undefined) {
      next = { ...next, [k]: undefined };
    }
  }

  // Spec §7.3: bedrooms/bathrooms are hidden for commercial — clear stale
  // values so they aren't silently persisted.
  if (changedKey === 'leadPropertyUse' && nextValue === 'commercial') {
    next = { ...next, bedrooms: undefined, bathrooms: undefined };
  }

  next = cascadeClear(next, changedKey);
  next = recomputeDerived(next);

  return next;
}
