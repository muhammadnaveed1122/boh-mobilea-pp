import { useAppForm } from '@/components/molecules/forms';
import { setPasswordSchema, type SetPasswordFormValues } from './set-password.schema';

export function useSetPasswordForm(onSubmit: (values: SetPasswordFormValues) => Promise<void>) {
  return useAppForm({
    defaultValues: { password: '', confirmPassword: '' } satisfies SetPasswordFormValues,
    validators: { onSubmit: setPasswordSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });
}
