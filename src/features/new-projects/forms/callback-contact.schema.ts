import { z } from 'zod';
import {
  INTEREST_VALUES,
  I_WANT_TO_OTHER,
  I_WANT_TO_VALUES,
  PROPERTY_TYPE_VALUES,
} from '../constants/contact-options';

/**
 * Callback ("Request a call back") form schema — mirrors the web
 * baseContactFormSchema (contactFormSchema.ts). Selection fields use empty
 * string as the "unselected" state so TanStack defaultValues stay simple.
 */
export const callbackContactSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.email({ message: 'Enter a valid email address' }),
    phone: z.string().min(7, 'Enter a valid phone number'),
    interest: z.string().refine((v) => INTEREST_VALUES.includes(v), 'Please select an option'),
    propertyType: z
      .string()
      .refine((v) => v === '' || PROPERTY_TYPE_VALUES.includes(v), 'Please select an option'),
    iWantTo: z.string().refine((v) => I_WANT_TO_VALUES.includes(v), 'Please select an option'),
    interestReason: z.string().max(500, 'Message must be 500 characters or fewer'),
  })
  .refine(
    (data) =>
      data.iWantTo !== I_WANT_TO_OTHER ||
      (!!data.interestReason && data.interestReason.trim().length > 0),
    { message: 'Message is required', path: ['interestReason'] },
  );

export type CallbackContactFormValues = z.infer<typeof callbackContactSchema>;
