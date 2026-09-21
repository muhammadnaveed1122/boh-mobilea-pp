import { useAppForm } from '@/components/molecules/forms';
import { mfaVerifySchema, type MfaVerifyFormValues } from './mfa-verify.schema';

export function useMfaVerifyForm(onSubmit: (values: MfaVerifyFormValues) => Promise<void>) {
  return useAppForm({
    defaultValues: { token: '' } as MfaVerifyFormValues,
    validators: { onSubmit: mfaVerifySchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });
}
