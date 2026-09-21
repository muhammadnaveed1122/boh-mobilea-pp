import { useAppForm } from '@/components/molecules/forms';
import { changePasswordSchema, type ChangePasswordFormValues } from './change-password.schema';

export function useChangePasswordForm(
  onSubmit: (values: ChangePasswordFormValues) => Promise<void>,
) {
  return useAppForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    } satisfies ChangePasswordFormValues,
    validators: { onSubmit: changePasswordSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });
}
