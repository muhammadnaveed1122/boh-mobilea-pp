import { z } from 'zod';

/**
 * Listing "Request Call back" form. Deliberately lean — name + phone are all that's needed to
 * return a call; the preferred date/time window is optional. Mirrors web `listingCallbackSchema`.
 */
export const listingCallbackSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Enter a valid phone number'),
  /** `yyyy-MM-dd` in the caller's local time, or '' when unset. */
  preferredDate: z.string().optional(),
  /** One of `LISTING_CALLBACK_TIME_SLOTS` values (e.g. `10:00-13:00`), or undefined when unset. */
  preferredTime: z.string().optional(),
});

export type ListingCallbackFormValues = z.infer<typeof listingCallbackSchema>;

export const LISTING_CALLBACK_DEFAULTS: ListingCallbackFormValues = {
  name: '',
  phone: '',
  preferredDate: '',
  preferredTime: undefined,
};
