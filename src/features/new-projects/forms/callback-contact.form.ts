import { useAppForm } from '@/components/molecules/forms';
import { callbackContactSchema, type CallbackContactFormValues } from './callback-contact.schema';

export function useCallbackContactForm(
  onSubmit: (values: CallbackContactFormValues) => Promise<void>,
) {
  return useAppForm({
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      interest: '',
      propertyType: '',
      iWantTo: '',
      interestReason: '',
    } satisfies CallbackContactFormValues,
    validators: { onSubmit: callbackContactSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });
}
