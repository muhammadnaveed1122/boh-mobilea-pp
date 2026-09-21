import { z } from 'zod';

export const contactCtaSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.email({ message: 'Enter a valid email address' }),
  phone: z.string().min(7, 'Enter a valid phone number'),
  notes: z.string(),
});

export type ContactCtaFormValues = z.infer<typeof contactCtaSchema>;
