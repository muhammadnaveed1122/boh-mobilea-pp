import { useAuthStore } from '@/store/auth.store';
import { hasAllPermissions, hasAnyPermission, hasPermission } from './selectors';

export function useCan(code: string | readonly string[]): boolean {
  const user = useAuthStore((s) => s.user);
  if (Array.isArray(code)) return hasAnyPermission(user, code);
  return hasPermission(user, code as string);
}

export function useCanAll(codes: readonly string[]): boolean {
  const user = useAuthStore((s) => s.user);
  return hasAllPermissions(user, codes);
}
