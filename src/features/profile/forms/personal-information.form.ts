import { useAppForm } from '@/components/molecules/forms';
import {
  personalInformationSchema,
  type PersonalInformationFormValues,
} from './personal-information.schema';

export function usePersonalInformationForm(
  defaultValues: PersonalInformationFormValues,
  onSubmit: (values: PersonalInformationFormValues) => Promise<void>,
) {
  return useAppForm({
    defaultValues,
    validators: { onSubmit: personalInformationSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });
}
