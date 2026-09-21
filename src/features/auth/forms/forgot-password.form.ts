import { useAppForm } from '@/components/molecules/forms';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from './forgot-password.schema';

export function useForgotPasswordForm(
  onSubmit: (values: ForgotPasswordFormValues) => Promise<void>,
) {
  return useAppForm({
    defaultValues: { email: '' } satisfies ForgotPasswordFormValues,
    validators: { onSubmit: forgotPasswordSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });
}
