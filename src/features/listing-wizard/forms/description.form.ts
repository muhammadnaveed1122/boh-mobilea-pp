import { useAppForm } from '@/components/molecules/forms/hook';

import {
  DESCRIPTION_DEFAULTS,
  type DescriptionValues,
  descriptionSchema,
} from './description.schema';

/**
 * `onValidSubmit` runs only after the schema passes — `form.handleSubmit()` validates first
 * (marking fields touched + surfacing errors) and invokes onSubmit solely for a valid payload.
 */
export function useDescriptionForm(
  onValidSubmit: (values: DescriptionValues) => Promise<void>,
  defaultValues: DescriptionValues = DESCRIPTION_DEFAULTS,
) {
  return useAppForm({
    defaultValues,
    validators: { onSubmit: descriptionSchema },
    onSubmit: async ({ value }) => {
      await onValidSubmit(value);
    },
  });
}

export type DescriptionForm = ReturnType<typeof useDescriptionForm>;
