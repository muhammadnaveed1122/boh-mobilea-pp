import { useAppForm } from '@/components/molecules/forms';
import { mfaTotpPromptSchema, type MfaTotpPromptFormValues } from './mfa-totp-prompt.schema';

export function useMfaTotpPromptForm(onSubmit: (values: MfaTotpPromptFormValues) => Promise<void>) {
  return useAppForm({
    defaultValues: { token: '' } as MfaTotpPromptFormValues,
    validators: { onSubmit: mfaTotpPromptSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });
}
