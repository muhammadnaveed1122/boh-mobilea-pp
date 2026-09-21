/**
 * Dialer constants — ported from web
 * `boh-lead-magnet/src/features/callService/constants/dialer.ts`.
 */

/** Numpad layout — digit + phone-keypad letters */
export const NUMPAD_BUTTONS = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
] as const;

export const DIALER_VALIDATION = {
  MIN_LENGTH: 3,
  MAX_LENGTH: 15,
  ALLOWED_CHARS: /^[0-9+*#]+$/,
} as const;

export const DIALER_LABELS = {
  TITLE: 'Destination Number',
  PLACEHOLDER: 'Enter phone number',
  CALL_BUTTON: 'Call',
  CLOSE_BUTTON: 'Close',
  BACKSPACE_LABEL: 'Backspace',
} as const;
