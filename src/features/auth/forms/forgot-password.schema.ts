import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  email: z.email({ message: 'Enter a valid email address' }),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
