/**
 * Gated debug logger for the call stack (SIP/CallKeep/FCM/socket diagnostics).
 *
 * These traces are invaluable while debugging call setup + teardown, but they
 * flood the Metro console during normal development. They are OFF by default
 * and switch on with `EXPO_PUBLIC_DEBUG_CALL_LOGS=1` in the env file.
 *
 * Real failures should keep using `console.error` / `console.warn` so they
 * remain visible regardless of this flag.
 */

const ENABLED = process.env.EXPO_PUBLIC_DEBUG_CALL_LOGS === '1';

export function dlog(...args: unknown[]): void {
  if (ENABLED) {
    console.log(...args);
  }
}

export const DEBUG_LOGS_ENABLED = ENABLED;
