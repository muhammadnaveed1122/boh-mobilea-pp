import { useAppForm } from '@/components/molecules/forms';
import { verifySignupOtpSchema, type VerifySignupOtpFormValues } from './verify-signup-otp.schema';

export function useVerifySignupOtpForm(
  onSubmit: (values: VerifySignupOtpFormValues) => Promise<void>,
) {
  return useAppForm({
    defaultValues: { code: '' } satisfies VerifySignupOtpFormValues,
    validators: { onSubmit: verifySignupOtpSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });
}
