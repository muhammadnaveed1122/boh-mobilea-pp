import { CONFIG } from '@/lib/config';
import { useRole } from '@/lib/rbac';
import { useAuthStore } from '@/store/auth.store';

/**
 * True when the current user should see the super-admin dashboard: the `super-admin`
 * role, or any role whose ID is listed in `EXPO_PUBLIC_DASHBOARD_ROLE_IDS` (the CEO
 * "Full Access" role, in production).
 *
 * Matches on role ID, not code. A role's `code` is chosen at creation time and role
 * creation only needs the grantable `rbac.roles:create` permission, so a code can be
 * forged; the database assigns the `id` and no DTO exposes it.
 *
 * NOT a security boundary — this only decides which dashboard renders. The backend's
 * DashboardAccessGuard enforces the same allowlist on every dashboard endpoint, so a
 * user who slipped past this would simply get a 403 and an empty screen.
 */
export function useDashboardAccess(): boolean {
  const { isSuperAdmin } = useRole();
  const roles = useAuthStore((s) => s.user?.roles);

  if (isSuperAdmin) {
    return true;
  }

  const allowed = CONFIG.DASHBOARD_ROLE_IDS;
  if (allowed.length === 0 || roles === undefined) {
    return false;
  }

  return roles.some((role) => allowed.includes(role.id));
}
