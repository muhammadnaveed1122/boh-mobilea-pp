/**
 * Single source of truth for the password strength policy. Shared by the Zod
 * schema (validation) and the live requirement checklist (UI) so they never
 * drift apart.
 */
export interface PasswordRule {
  key: string;
  label: string;
  test: (value: string) => boolean;
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  { key: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { key: 'uppercase', label: 'One uppercase letter (A–Z)', test: (v) => /[A-Z]/.test(v) },
  { key: 'lowercase', label: 'One lowercase letter (a–z)', test: (v) => /[a-z]/.test(v) },
  { key: 'number', label: 'One number (0–9)', test: (v) => /\d/.test(v) },
  { key: 'symbol', label: 'One symbol (!@#$…)', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export function isPasswordValid(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}
