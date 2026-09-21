import { z } from 'zod';

function isValidDob(s: string): boolean {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const min = new Date('1900-01-01');
  if (d > now || d < min) return false;
  // Must be at least 18 years old.
  const eighteen = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
  return d <= eighteen;
}

export const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.email({ message: 'Enter a valid email address' }),
  phone: z.string().min(7, 'Enter a valid phone number'),
  dateOfBirth: z
    .string()
    .min(1, 'Date of birth is required')
    .refine(isValidDob, 'You must be at least 18 years old'),
  termsAccepted: z
    .boolean()
    .refine((v) => v === true, 'You must agree to the Terms & Conditions and Privacy Policy'),
});

export type SignupFormValues = z.infer<typeof signupSchema>;
