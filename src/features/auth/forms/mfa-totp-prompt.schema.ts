import { z } from 'zod';

export const mfaTotpPromptSchema = z.object({
  token: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'),
});

export type MfaTotpPromptFormValues = z.infer<typeof mfaTotpPromptSchema>;
