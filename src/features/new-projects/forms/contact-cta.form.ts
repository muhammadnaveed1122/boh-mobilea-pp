import { useAppForm } from '@/components/molecules/forms';
import { contactCtaSchema, type ContactCtaFormValues } from './contact-cta.schema';

export function useContactCtaForm(onSubmit: (values: ContactCtaFormValues) => Promise<void>) {
  return useAppForm({
    defaultValues: { name: '', email: '', phone: '', notes: '' } satisfies ContactCtaFormValues,
    validators: { onSubmit: contactCtaSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });
}
