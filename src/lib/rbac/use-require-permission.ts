import { useAuthStore } from '@/store/auth.store';
import { hasAnyPermission, hasPermission } from './selectors';

export type RequireState = 'loading' | 'allowed' | 'denied';

// Returns 'loading' until perms hydrate (avoid bouncing during cold-start
// flicker), then 'allowed' or 'denied'. Caller decides what to render.
export function useRequirePermission(code: string | readonly string[]): RequireState {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) return 'denied';
  if (!user) return 'loading';
  // hasAllAccess shortcuts inside the selectors.
  if (user.roles.length === 0 && user.permissions.length === 0 && !user.hasAllAccess) {
    return 'loading';
  }
  const allowed = Array.isArray(code)
    ? hasAnyPermission(user, code)
    : hasPermission(user, code as string);
  return allowed ? 'allowed' : 'denied';
}
