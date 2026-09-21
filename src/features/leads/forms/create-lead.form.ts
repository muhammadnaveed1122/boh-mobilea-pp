import { useAppForm } from '@/components/molecules/forms';
import {
  CREATE_LEAD_DEFAULTS,
  createLeadSchema,
  type CreateLeadFormValues,
} from './create-lead.schema';

interface UseCreateLeadFormOptions {
  onSubmit: (values: CreateLeadFormValues) => Promise<void>;
  defaults?: Partial<CreateLeadFormValues>;
}

export function useCreateLeadForm({ onSubmit, defaults }: UseCreateLeadFormOptions) {
  return useAppForm({
    defaultValues: { ...CREATE_LEAD_DEFAULTS, ...defaults },
    validators: { onSubmit: createLeadSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });
}
