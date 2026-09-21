import { useAppForm } from '@/components/molecules/forms';
import { mfaEnableSchema, type MfaEnableFormValues } from './mfa-enable.schema';

export function useMfaEnableForm(onSubmit: (values: MfaEnableFormValues) => Promise<void>) {
  return useAppForm({
    defaultValues: { token: '' } as MfaEnableFormValues,
    validators: { onSubmit: mfaEnableSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });
}
