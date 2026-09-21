import { z } from 'zod';

export const verifySignupOtpSchema = z.object({
  code: z
    .string()
    .regex(/^\d{6}$/, 'Enter the 6-digit code')
    .length(6, 'Enter the 6-digit code'),
});

export type VerifySignupOtpFormValues = z.infer<typeof verifySignupOtpSchema>;
