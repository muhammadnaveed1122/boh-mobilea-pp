/**
 * Compute initials (max 2 chars, uppercase) from a full name.
 * App-wide helper — used by avatars, lead cards, hero headers, etc.
 */
export function initials(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .split(' ')
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
