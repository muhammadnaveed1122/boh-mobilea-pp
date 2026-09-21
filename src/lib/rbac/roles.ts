// Role codes — keep in sync with backend role seed.
// Used for routing-level gating (e.g., block end_user from mobile shell).

// Mirror backend seed (boh-lead-magnet-backend/prisma/seed/roles.ts).
// Only `super-admin` is seeded today; the rest are forward-looking codes
// the backend is expected to add (kept here as a single source of truth so
// screens can reference them without typos when the seeds expand).
export const ROLES = {
  SUPER_ADMIN: 'super-admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  AGENT: 'agent',
  DEVELOPER: 'developer',
  CUSTOMER: 'customer',
  END_USER: 'end-user',
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];

// User types — mirror backend `UserType` enum
// (boh-lead-magnet-backend/prisma/users.prisma). The backend stamps every
// self-service signup with `client`; everything else is an internal persona.
// Gating keys off userType FIRST: portal/tenant types → end-user shell
// (favourites/home/profile); any other type falls through to role + permission
// gating.
export const USER_TYPES = {
  ADMIN: 'admin',
  CLIENT: 'client',
  AGENT: 'agent',
  INTERNAL_USER: 'internal_user',
  OWNER: 'owner',
  TENANT: 'tenant',
} as const;

export type UserType = (typeof USER_TYPES)[keyof typeof USER_TYPES];

// Portal (customer-facing) account types — mirrors the backend's
// `src/common/utils/portal-user.util.ts`. `owner` is a SUPERSET of `client`:
// promotion client → owner is one-way and the account keeps every portal
// capability. NEVER compare `userType === 'client'` directly anywhere — an
// account promoted by the owners app would silently lose whatever that check
// gates and land on the staff dashboard with zero permissions (blank screen).
const PORTAL_USER_TYPES: ReadonlySet<string> = new Set([USER_TYPES.CLIENT, USER_TYPES.OWNER]);

export function isPortalUserType(userType?: string | null): boolean {
  if (userType === undefined || userType === null) return false;
  return PORTAL_USER_TYPES.has(userType.trim().toLowerCase());
}

// Tenants are deliberately NOT portal accounts (no favourites/ROI/listings
// capabilities), but they carry no roles or permissions either — so on this app
// they must still get the public end-user shell, not the staff dashboard.
export function isTenantUserType(userType?: string | null): boolean {
  if (userType === undefined || userType === null) return false;
  return userType.trim().toLowerCase() === USER_TYPES.TENANT;
}

// Roles that may NOT use the mobile shell. Default-allow: any role not in
// this set passes the (app)/_layout gate. Empty today — backend has no
// mobile-blocked persona yet. Add 'end-user' here once that role exists.
export const MOBILE_BLOCKED_ROLES: readonly string[] = [];
