import { useAppForm } from '@/components/molecules/forms';
import { loginSchema, type LoginFormValues } from './login.schema';

export function useLoginForm(onSubmit: (values: LoginFormValues) => Promise<void>) {
  return useAppForm({
    defaultValues: { email: '', password: '', keepLoggedIn: false } as LoginFormValues,
    validators: { onSubmit: loginSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });
}
