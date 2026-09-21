import { z } from 'zod';

export const mfaEnableSchema = z.object({
  token: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'),
});

export type MfaEnableFormValues = z.infer<typeof mfaEnableSchema>;
