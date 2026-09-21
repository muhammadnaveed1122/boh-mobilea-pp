import { isAxiosError } from 'axios';

import { ApiError } from '@/lib/api-error';

/**
 * Backend sentinel returned when a WhatsApp send needs an approved template:
 * the 24h customer-service window is closed (or was never opened, which is
 * always the case for a brand-new number), so free text would be rejected by
 * Meta. Thrown as a `BadRequestException` whose message is this literal, so it
 * arrives on `ApiError.message` rather than `.code`.
 */
export const SELECT_TEMPLATE_FIRST = 'SELECT_TEMPLATE_FIRST';

/** True when a send failed only because it needs a template. */
export function isSelectTemplateFirst(error: unknown): boolean {
  return error instanceof ApiError && error.message === SELECT_TEMPLATE_FIRST;
}

/**
 * Pull the backend's own message out of a failure so QA sees the real cause
 * (Meta template rejections and validation errors both arrive this way)
 * instead of a generic "request failed".
 */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  // The axios interceptor normalizes envelope failures into ApiError, so this
  // is the common path; the axios branch below only catches unwrapped errors.
  if (error instanceof ApiError) return error.message;
  if (isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    const msg = data?.message;
    if (Array.isArray(msg)) return msg.join('\n');
    if (typeof msg === 'string' && msg.length > 0) return msg;
    return error.message;
  }
  return error instanceof Error ? error.message : fallback;
}
