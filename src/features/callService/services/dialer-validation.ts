/**
 * Dialer validation — port of web
 * `boh-lead-magnet/src/features/callService/utils/dialerValidation.ts`.
 */

import { DIALER_VALIDATION } from '../constants';

export function validatePhoneNumber(phoneNumber: string): boolean {
  if (!phoneNumber) return false;
  if (phoneNumber.length < DIALER_VALIDATION.MIN_LENGTH) return false;
  if (phoneNumber.length > DIALER_VALIDATION.MAX_LENGTH) return false;
  return DIALER_VALIDATION.ALLOWED_CHARS.test(phoneNumber);
}

/**
 * Strip any character not allowed by the dialer (spaces, dashes, parens, …)
 * and truncate to the max length.
 */
export function sanitizePhoneNumberForDialer(input: string): string {
  if (!input) return '';
  const cleaned = input.replace(/[^\d+*#]/g, '');
  return cleaned.slice(0, DIALER_VALIDATION.MAX_LENGTH);
}
