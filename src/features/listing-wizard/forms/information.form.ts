import { useAppForm } from '@/components/molecules/forms/hook';

import {
  INFORMATION_DEFAULTS,
  type InformationValues,
  informationSchema,
} from './information.schema';

/**
 * `onValidSubmit` runs only after the schema passes — `form.handleSubmit()` validates first
 * (marking fields touched + surfacing errors) and invokes onSubmit solely for a valid payload.
 * So the create endpoints are never hit with an invalid form.
 */
export function useInformationForm(
  onValidSubmit: (values: InformationValues) => Promise<void>,
  defaultValues: InformationValues = INFORMATION_DEFAULTS,
) {
  return useAppForm({
    defaultValues,
    validators: { onSubmit: informationSchema },
    onSubmit: async ({ value }) => {
      await onValidSubmit(value);
    },
  });
}

export type InformationForm = ReturnType<typeof useInformationForm>;
