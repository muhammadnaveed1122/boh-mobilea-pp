import { useAppForm } from '@/components/molecules/forms';
import { signupSchema, type SignupFormValues } from './signup.schema';

export function useSignupForm(onSubmit: (values: SignupFormValues) => Promise<void>) {
  return useAppForm({
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      dateOfBirth: '',
      termsAccepted: false as boolean,
    } satisfies SignupFormValues,
    validators: { onSubmit: signupSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });
}
