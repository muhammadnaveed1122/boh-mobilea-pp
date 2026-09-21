import { useMemo } from 'react';
import { useAuthStore } from '@/store/auth.store';
import type { Role } from '@/types/auth.types';
import { isPortalUserType, isTenantUserType, ROLES } from './roles';
import { getPrimaryRoleCode, hasAnyRole, hasRole } from './selectors';

export interface UseRoleResult {
  roles: Role[];
  primaryRole: string | null;
  userType: string | null;
  /**
   * Portal (customer-facing) account: `client` OR `owner`. Backend stamps
   * self-service signups as `client`; the owners app promotes them to `owner`,
   * which is a superset. Always use this — never `userType === 'client'`.
   */
  isPortalUser: boolean;
  /** Tenant of an owner-registered property. Not a portal account. */
  isTenant: boolean;
  /**
   * Anyone who belongs on the public end-user shell (home listings /
   * favourites / profile) instead of the staff dashboard: portal accounts,
   * tenants, the legacy `customer` role, and — as a backstop — any signed-in
   * account with no roles, no permissions and no all-access flag. Such an
   * account cannot render a single staff widget or tab, so the staff shell
   * would show an empty screen with a lone Home tab.
   */
  isEndUserShell: boolean;
  hasAllAccess: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isAgent: boolean;
  isDeveloper: boolean;
  isCustomer: boolean;
  isEndUser: boolean;
  has: (code: string) => boolean;
  hasAny: (codes: readonly string[]) => boolean;
}

export function useRole(): UseRoleResult {
  const user = useAuthStore((s) => s.user);

  return useMemo<UseRoleResult>(() => {
    const roles = user?.roles ?? [];
    const isPortalUser = isPortalUserType(user?.userType);
    const isTenant = isTenantUserType(user?.userType);
    const isCustomer = hasRole(user, ROLES.CUSTOMER);
    // Backstop for accounts the userType checks above don't classify (e.g. an
    // Apple/Google sign-in adopted onto a staff-typed row that was never given
    // a role): nothing in the staff shell can render for them.
    const hasNoStaffAccess =
      user !== null &&
      !user.hasAllAccess &&
      roles.length === 0 &&
      (user.permissions?.length ?? 0) === 0;
    return {
      roles,
      primaryRole: getPrimaryRoleCode(user),
      userType: user?.userType ?? null,
      isPortalUser,
      isTenant,
      isEndUserShell: isPortalUser || isTenant || isCustomer || hasNoStaffAccess,
      hasAllAccess: !!user?.hasAllAccess,
      isSuperAdmin: hasRole(user, ROLES.SUPER_ADMIN),
      isAdmin: hasRole(user, ROLES.ADMIN) || hasRole(user, ROLES.SUPER_ADMIN),
      isManager: hasRole(user, ROLES.MANAGER),
      isAgent: hasRole(user, ROLES.AGENT),
      isDeveloper: hasRole(user, ROLES.DEVELOPER),
      isCustomer,
      isEndUser: hasRole(user, ROLES.END_USER),
      has: (code) => hasRole(user, code),
      hasAny: (codes) => hasAnyRole(user, codes),
    };
  }, [user]);
}
