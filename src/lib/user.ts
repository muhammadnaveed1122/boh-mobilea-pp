import type { User } from '@/types/auth.types';

/** Best available human name: full name, then first+last, then email. */
export function getDisplayName(user: User | null): string {
  if (!user) return 'Agent Name';
  const fullName = user.profile?.fullName?.trim();
  if (fullName) return fullName;
  const first = user.profile?.firstName?.trim() ?? '';
  const last = user.profile?.lastName?.trim() ?? '';
  const combined = `${first} ${last}`.trim();
  if (combined) return combined;
  return user.email ?? 'Agent Name';
}

/** Up-to-2-letter uppercase initials from a display name. */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
