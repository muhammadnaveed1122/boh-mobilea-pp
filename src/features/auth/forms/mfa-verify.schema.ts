import { z } from 'zod';

export const mfaVerifySchema = z.object({
  token: z.string().min(6, 'Enter the 6-digit code or a backup code').max(20, 'Code too long'),
});

export type MfaVerifyFormValues = z.infer<typeof mfaVerifySchema>;
