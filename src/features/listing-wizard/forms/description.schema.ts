import { z } from 'zod';

/** Description step — hero Title + Description (both feed the Property Finder push). */
export const descriptionSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().trim().min(1, 'Description is required'),
});

export type DescriptionValues = z.infer<typeof descriptionSchema>;

export const DESCRIPTION_DEFAULTS: DescriptionValues = {
  title: '',
  description: '',
};
