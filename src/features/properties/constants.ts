// Company contact for property Call / WhatsApp actions.
// Ported from web GET_IN_TOUCH (boh-lead-magnet src/features/contact/constants).
export const PROPERTY_CALL_TEL = '+9718002255745';
/** How the company line is spelled on the Call button (web `PHONE_NUMBERS[0].display`). */
export const PROPERTY_CALL_DISPLAY = '+971 800 CALL RHK';
export const PROPERTY_WHATSAPP_NUMBER = '+9718002255745';
export const PROPERTY_EMAIL = 'info@rhkproperties.com';

/**
 * Selectable callback windows for the listing "Request Call back" form. Values are `HH:mm-HH:mm`
 * (24h, caller-local) so the backend gets an unambiguous range on `callPreference`; labels are the
 * 12h form. Ported verbatim from web `LISTING_CALLBACK_TIME_SLOTS`.
 */
export const LISTING_CALLBACK_TIME_SLOTS = [
  { value: '09:00-10:00', label: '09:00 AM - 10:00 AM' },
  { value: '10:00-13:00', label: '10:00 AM - 01:00 PM' },
  { value: '13:00-16:00', label: '01:00 PM - 04:00 PM' },
  { value: '16:00-19:00', label: '04:00 PM - 07:00 PM' },
  { value: '19:00-21:00', label: '07:00 PM - 09:00 PM' },
] as const;

/** How many days ahead a caller may schedule a callback. */
export const LISTING_CALLBACK_MAX_DAYS_AHEAD = 30;

/** Label for a chosen slot, used on the confirmation screen. */
export function listingCallbackTimeLabel(value: string): string {
  return LISTING_CALLBACK_TIME_SLOTS.find((slot) => slot.value === value)?.label ?? value;
}

/** Lazy-reveal chunk size on the Buy list (mirrors web "Show More" of 10). */
export const LIST_PAGE_SIZE = 10;

/** Upper bound fetched from each source (mirrors web buy-with-us limit=100). */
export const FEED_FETCH_LIMIT = 100;
