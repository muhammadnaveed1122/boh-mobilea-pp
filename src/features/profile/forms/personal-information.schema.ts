import { z } from 'zod';

const pickedImageSchema = z.object({
  uri: z.string().min(1),
  name: z.string().min(1),
  mimeType: z.enum(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml']),
});

export const personalInformationSchema = z.object({
  phone: z.string().trim().min(7, 'Enter a valid phone number'),
  profilePicture: z.union([z.null(), pickedImageSchema]),
});

export type PersonalInformationFormValues = z.infer<typeof personalInformationSchema>;
