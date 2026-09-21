import type { User } from '@/types/auth.types';

export function hasPermission(user: User | null, code: string): boolean {
  if (!user) return false;
  if (user.hasAllAccess) return true;
  return user.permissions.some((p) => p.code === code);
}

export function hasAnyPermission(user: User | null, codes: readonly string[]): boolean {
  if (!user) return false;
  if (user.hasAllAccess) return true;
  if (codes.length === 0) return false;
  return codes.some((c) => user.permissions.some((p) => p.code === c));
}

export function hasAllPermissions(user: User | null, codes: readonly string[]): boolean {
  if (!user) return false;
  if (user.hasAllAccess) return true;
  if (codes.length === 0) return false;
  return codes.every((c) => user.permissions.some((p) => p.code === c));
}

export function hasRole(user: User | null, code: string): boolean {
  if (!user) return false;
  return user.roles.some((r) => r.code === code);
}

export function hasAnyRole(user: User | null, codes: readonly string[]): boolean {
  if (!user) return false;
  return user.roles.some((r) => codes.includes(r.code));
}

export function getPrimaryRoleCode(user: User | null): string | null {
  if (!user || user.roles.length === 0) return null;
  const allAccess = user.roles.find((r) => r.isAllAccess);
  return (allAccess ?? user.roles[0])?.code ?? null;
}
