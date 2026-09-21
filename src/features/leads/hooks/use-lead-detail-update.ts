/**
 * useLeadDetailUpdate — orchestrates the Save + Cancel actions for the lead
 * detail edit form. Mirrors `useLeadDetailUpdate` on web
 * (`boh-lead-magnet/src/features/leads/hooks/useLeadDetailUpdate.ts`).
 *
 * Must be used inside a `LeadFormProvider`.
 *
 * Flow:
 *
 * 1. `save()` validates `ctx.values` via `leadDetailSchema`. On failure it
 *    writes per-field error messages into the context and surfaces a single
 *    "Please fix errors" alert.
 * 2. On success it extracts ONLY the dirty fields from `ctx.values` and
 *    PATCHes via `useUpdateLead`. The server-returned `LeadDetail` becomes
 *    the new seed for the form, and the form exits edit mode.
 * 3. `cancel()` discards changes. If the form is dirty it first asks for
 *    confirmation via `Alert.alert`.
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';

import { useLeadFormContext, type LeadFormErrors } from '../context/LeadFormContext';
import type { LeadDetail, UpdateLeadPayload } from '../models/lead-detail';
import { leadDetailSchema } from '../validation/lead-detail.schema';
import { useUpdateLead } from './use-update-lead';

export type { LeadDetailFormValues } from '../validation/lead-detail.schema';

export interface UseLeadDetailUpdateReturn {
  /** Validate + PATCH the dirty fields. No-op while a save is in flight. */
  save: () => Promise<void>;
  /** Discard local changes and exit edit mode (with confirm when dirty). */
  cancel: () => void;
  readonly isSaving: boolean;
  readonly hasChanges: boolean;
  readonly isEditing: boolean;
}

/**
 * Build the PATCH payload by deep-picking only the dirty top-level keys from
 * the working values. `undefined` is sent as `null` so the backend can
 * distinguish "leave alone" from "clear this field" (matches web semantics).
 */
function pickDirty(
  values: Partial<LeadDetail>,
  dirtyFields: ReadonlySet<string>,
): Partial<UpdateLeadPayload> {
  const source = values as Record<string, unknown>;
  const out: Partial<UpdateLeadPayload> = {};
  const target = out as Record<string, unknown>;
  for (const key of dirtyFields) {
    const v = source[key];
    target[key] = v === undefined ? null : v;
  }
  return out;
}

/**
 * Flatten Zod issue paths into a `field -> message` map. Only the first
 * issue per path wins, matching the inline-error UX where each field shows
 * one message at a time.
 */
function buildErrorMap(
  issues: readonly { path: PropertyKey[]; message: string }[],
): LeadFormErrors {
  const map: LeadFormErrors = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key !== 'string' || key in map) {
      continue;
    }
    map[key] = issue.message;
  }
  return map;
}

/**
 * Extract a user-facing error message from a mutation failure. Mobile uses
 * the shared axios interceptor which surfaces backend errors as `Error`
 * instances with the server message, so a simple `err.message` is enough.
 */
function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

export function useLeadDetailUpdate(leadId: string): UseLeadDetailUpdateReturn {
  const ctx = useLeadFormContext();
  const mutation = useUpdateLead(leadId);

  const save = useCallback(async () => {
    if (mutation.isPending) {
      return;
    }

    const parsed = leadDetailSchema.safeParse(ctx.values);
    if (!parsed.success) {
      ctx.setErrors(buildErrorMap(parsed.error.issues));
      Alert.alert('Please fix errors', 'Some fields need attention before saving.');
      return;
    }
    ctx.setErrors({});

    const payload = pickDirty(ctx.values, ctx.dirtyFields);
    // Nothing to send — exit edit mode silently.
    if (Object.keys(payload).length === 0) {
      ctx.setIsEditing(false);
      return;
    }

    try {
      const result = await mutation.mutateAsync(payload);
      ctx.reset(result);
      ctx.setIsEditing(false);
      Alert.alert('Lead updated', 'Your changes have been saved.');
    } catch (err) {
      Alert.alert('Save failed', getErrorMessage(err, 'Failed to update lead.'));
    }
  }, [ctx, mutation]);

  const performReset = useCallback(() => {
    ctx.discardChanges();
    ctx.setIsEditing(false);
  }, [ctx]);

  const cancel = useCallback(() => {
    if (!ctx.hasChanges) {
      performReset();
      return;
    }
    Alert.alert(
      'Discard changes?',
      'You have unsaved changes. Are you sure you want to discard them?',
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: performReset },
      ],
    );
  }, [ctx.hasChanges, performReset]);

  return {
    save,
    cancel,
    isSaving: mutation.isPending,
    hasChanges: ctx.hasChanges,
    isEditing: ctx.isEditing,
  };
}
