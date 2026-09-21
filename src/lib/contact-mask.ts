/**
 * Masks email like `d***x@mailinator.com` — first char of local + `***` + last
 * char of local + domain unchanged. Single-char locals fall back to `***`.
 */
export function maskEmail(email: string | null | undefined): string | null {
  if (email === null || email === undefined || email === '') return null;
  const atIdx = email.indexOf('@');
  if (atIdx <= 0) return email;
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx);
  if (local.length === 1) return `***${domain}`;
  const first = local[0];
  const last = local[local.length - 1];
  return `${first}***${last}${domain}`;
}

/**
 * Masks phone like `+1671******58` — head (everything except last 2 digits)
 * with body digits replaced by `*`, last 2 visible. Preserves leading `+` and
 * a country-code prefix (up to 4 leading chars after `+`).
 */
export function maskPhone(phone: string | null | undefined): string | null {
  if (phone === null || phone === undefined || phone === '') return null;
  if (phone.length <= 4) return phone;

  const hasPlus = phone.startsWith('+');
  const digitsOnly = phone.replace(/[^\d]/g, '');
  if (digitsOnly.length <= 4) return phone;

  const ccLen = Math.min(4, digitsOnly.length - 4);
  const cc = digitsOnly.slice(0, ccLen);
  const tail = digitsOnly.slice(-2);
  const stars = '*'.repeat(digitsOnly.length - ccLen - 2);
  return `${hasPlus ? '+' : ''}${cc}${stars}${tail}`;
}
