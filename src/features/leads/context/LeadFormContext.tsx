/**
 * LeadFormContext — single source of truth for the lead-detail edit form.
 *
 * Mirrors the contract of the web `LeadFormContext`
 * (`boh-lead-magnet/src/features/leads/context/LeadFormContext.tsx`) and
 * extends it with:
 *
 * - `setField` routes every requirement-form write through the pure
 *   dependency engine (`form/apply-dependencies.ts`) on a flat `FormValues`
 *   view, then maps the result back onto the `LeadDetail`-shaped `values`.
 *   It is the single write API — callers dispatch by flat `FieldKey`.
 * - Inline `isEditing` flag so Edit / Save / Cancel can live entirely
 *   inside the provider instead of being lifted into the screen.
 * - Per-field `errors` map populated by `useLeadDetailUpdate` after a Zod
 *   `safeParse` fails.
 *
 * Dirty tracking: a `Set<string>` of top-level keys on `LeadDetail` that have
 * been touched in this edit session. When a field is set back to its initial
 * value (`Object.is` equality) the entry is removed — `hasChanges` is just
 * `dirtyFields.size > 0`. Server-state re-seeds are gated on `!hasChanges`
 * so a background refetch never clobbers user input mid-edit.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { applyDependencies } from '../form/apply-dependencies';
import type { FieldKey } from '../form/form-keys';
import { formChangeToLeadPatch, leadToFormValues } from '../form/model-adapter';
import type { LeadDetail } from '../models/lead-detail';

export type LeadFormErrors = Partial<Record<string, string>>;

export interface LeadFormContextValue {
  /** Current working values for the lead. Seeded from `lead`, updated as the user edits. */
  readonly values: Partial<LeadDetail>;
  /**
   * Set any form field by its flat `FieldKey`, running it through the pure
   * dependency engine (reset / cascade-clear / derive) and mapping the result
   * back onto the `LeadDetail`-shaped `values`. Dirty state is recomputed
   * against the seed for every key the resulting patch touched.
   */
  setField: (key: FieldKey, value: unknown) => void;
  /** Set of top-level keys that diverge from the seed. */
  readonly dirtyFields: ReadonlySet<string>;
  /** True iff `dirtyFields.size > 0`. */
  readonly hasChanges: boolean;
  /** Reset working values + dirty + errors to a new seed (typically the latest server payload). */
  reset: (initial: LeadDetail) => void;
  /** Discard local edits and restore working values to the current seed. */
  discardChanges: () => void;
  /** True while the user is in edit mode. */
  readonly isEditing: boolean;
  setIsEditing: (next: boolean) => void;
  /** Field-keyed validation errors. */
  readonly errors: LeadFormErrors;
  /** Set or clear a single field's error message. Pass `undefined` to clear. */
  setError: (key: string, msg?: string) => void;
  /** Replace the full error map (used after a Zod safeParse). */
  setErrors: (next: LeadFormErrors) => void;
}

const LeadFormContext = createContext<LeadFormContextValue | null>(null);

export interface LeadFormProviderProps {
  readonly lead: LeadDetail;
  readonly children: ReactNode;
}

/**
 * Wrap the lead-detail screen in this provider. Children read working values
 * + dirty state via `useLeadFormContext`, and dispatch changes via `setField`
 * (flat `FieldKey`). Cascade rules for the property triple are handled
 * centrally by the pure engine so each card stays declarative.
 */
export function LeadFormProvider({ lead, children }: LeadFormProviderProps) {
  const [values, setValues] = useState<Partial<LeadDetail>>(() => ({ ...lead }));
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(() => new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [errorMap, setErrorMap] = useState<LeadFormErrors>({});

  // Track the seed so dirty checks compare against server state, not the
  // previous working value. Updated on `reset()` and on background refetches
  // that arrive while the form is pristine.
  const seedRef = useRef<LeadDetail>(lead);
  const leadIdRef = useRef<string>(lead.id);

  const hasChanges = dirtyFields.size > 0;

  // Re-seed when the server payload changes — but only when the form is
  // pristine, to avoid clobbering in-flight user edits. Switching to a
  // different lead always resets + exits edit mode (defense in depth: a
  // stale `isEditing=true` on a new lead would be a bug).
  useEffect(() => {
    if (leadIdRef.current !== lead.id) {
      leadIdRef.current = lead.id;
      seedRef.current = lead;
      setValues({ ...lead });
      setDirtyFields(new Set());
      setErrorMap({});
      setIsEditing(false);
      return;
    }
    if (!hasChanges) {
      seedRef.current = lead;
      setValues({ ...lead });
    }
  }, [lead, hasChanges]);

  const markDirty = useCallback(
    (next: Set<string>, key: string, nextValue: unknown): Set<string> => {
      const seedValue = (seedRef.current as unknown as Record<string, unknown>)[key];
      const out = new Set(next);
      if (Object.is(seedValue, nextValue)) {
        out.delete(key);
      } else {
        out.add(key);
      }
      return out;
    },
    [],
  );

  const setField = useCallback(
    (key: FieldKey, value: unknown): void => {
      setValues((prev) => {
        const fv = leadToFormValues(prev);
        const nextFv = applyDependencies(fv, key, value as never);

        let patch: Partial<LeadDetail> = {};
        (Object.keys(nextFv) as FieldKey[]).forEach((k) => {
          if (nextFv[k] !== fv[k]) {
            patch = { ...patch, ...formChangeToLeadPatch(k, nextFv[k]) };
          }
        });

        const merged = { ...prev, ...patch };

        // Recompute dirty set against the seed for every key the patch
        // touched so a cascade-driven clear correctly clears its dirty flag
        // if it brings the value back to the seed.
        setDirtyFields((prevDirty) => {
          let out = new Set(prevDirty);
          for (const pk of Object.keys(patch)) {
            out = markDirty(out, pk, (merged as Record<string, unknown>)[pk]);
          }
          return out;
        });
        return merged;
      });
    },
    [markDirty],
  );

  const reset = useCallback((initial: LeadDetail) => {
    seedRef.current = initial;
    leadIdRef.current = initial.id;
    setValues({ ...initial });
    setDirtyFields(new Set());
    setErrorMap({});
  }, []);

  const discardChanges = useCallback(() => {
    setValues({ ...seedRef.current });
    setDirtyFields(new Set());
    setErrorMap({});
  }, []);

  const setError = useCallback((key: string, msg?: string) => {
    setErrorMap((prev) => {
      if (msg === undefined) {
        if (!(key in prev)) {
          return prev;
        }
        const rest = { ...prev };
        delete rest[key];
        return rest;
      }
      return { ...prev, [key]: msg };
    });
  }, []);

  const setErrors = useCallback((next: LeadFormErrors) => {
    setErrorMap(next);
  }, []);

  const value = useMemo<LeadFormContextValue>(
    () => ({
      values,
      setField,
      dirtyFields,
      hasChanges,
      reset,
      discardChanges,
      isEditing,
      setIsEditing,
      errors: errorMap,
      setError,
      setErrors,
    }),
    [
      values,
      setField,
      dirtyFields,
      hasChanges,
      reset,
      discardChanges,
      isEditing,
      errorMap,
      setError,
      setErrors,
    ],
  );

  return <LeadFormContext.Provider value={value}>{children}</LeadFormContext.Provider>;
}

/**
 * Read the lead form context. Throws if called outside of `LeadFormProvider`.
 */
export function useLeadFormContext(): LeadFormContextValue {
  const ctx = useContext(LeadFormContext);
  if (!ctx) {
    throw new Error('useLeadFormContext must be used within a LeadFormProvider');
  }
  return ctx;
}
