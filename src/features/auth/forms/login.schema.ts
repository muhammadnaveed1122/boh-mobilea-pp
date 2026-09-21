import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email({ message: 'Enter a valid email address' }),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  keepLoggedIn: z.boolean(),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
