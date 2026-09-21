import { z } from 'zod';
import { isPasswordValid } from './password-policy';

export const setPasswordSchema = z
  .object({
    password: z
      .string()
      .refine(isPasswordValid, 'Password does not meet all the requirements below'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type SetPasswordFormValues = z.infer<typeof setPasswordSchema>;
