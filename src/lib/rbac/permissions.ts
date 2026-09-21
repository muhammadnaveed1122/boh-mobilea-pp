// Mirror of backend permission catalog.
// Source of truth: boh-lead-magnet-backend/prisma/seed/core-permissions.ts
// This is a 1:1 mirror of every seeded permission code. Many are not yet wired
// to any mobile screen — they exist so the catalog stays in sync with backend.

export const PERMISSIONS = {
  // Users (admin only on mobile if used at all)
  USERS_CREATE: 'users:create',
  USERS_READ: 'users:read',
  USERS_UPDATE: 'users:update',

  // RBAC roles
  RBAC_ROLES_VIEW: 'rbac.roles:view',
  RBAC_ROLES_CREATE: 'rbac.roles:create',
  RBAC_ROLES_UPDATE: 'rbac.roles:update',
  RBAC_ROLES_ASSIGN_PERMISSIONS: 'rbac.roles:assign_permissions',
  RBAC_ROLES_ASSIGN_USERS: 'rbac.roles:assign_users',

  // Permissions catalog
  PERMISSIONS_READ: 'permissions:read',
  PERMISSIONS_CREATE: 'permissions:create',
  PERMISSIONS_UPDATE: 'permissions:update',

  // Leads
  LEADS_CREATE: 'leads:create',
  LEADS_READ: 'leads:read',
  LEADS_READ_ALL: 'leads:read_all',
  LEADS_UPDATE: 'leads:update',
  LEADS_UPDATE_ALL: 'leads:update_all',
  LEADS_ASSIGN: 'leads:assign',
  LEADS_VIEW_CONTACT: 'leads:view_contact',
  LEADS_CHAT: 'leads:chat',
  LEADS_DELETE: 'leads:delete',
  // Backend seeds a duplicate hyphen variant alongside leads:read_all. Mirrored
  // for completeness; prefer LEADS_READ_ALL (underscore) in app code.
  LEADS_READ_ALL_HYPHEN: 'leads:read-all',

  // Guest requests
  GUEST_REQUESTS_READ_ALL: 'guest-requests:read_all',
  GUEST_REQUESTS_UPDATE_ALL: 'guest-requests:update_all',

  // Developers
  DEVELOPERS_CREATE: 'developers:create',
  DEVELOPERS_READ: 'developers:read',
  DEVELOPERS_UPDATE: 'developers:update',

  // Clients
  CLIENTS_CREATE: 'users.clients:create',
  CLIENTS_READ: 'users.clients:read',
  CLIENTS_UPDATE: 'users.clients:update',

  // Internal team
  INTERNAL_TEAM_CREATE: 'users.internal-team:create',
  INTERNAL_TEAM_READ: 'users.internal-team:read',
  INTERNAL_TEAM_UPDATE: 'users.internal-team:update',

  // CMS Pages
  CMS_PAGES_CREATE: 'cms-pages:create',
  CMS_PAGES_READ: 'cms-pages:read',
  CMS_PAGES_UPDATE: 'cms-pages:update',
  CMS_PAGES_PUBLISH: 'cms-pages:publish',

  // Legal management
  LEGAL_READ: 'legal-management:read',
  LEGAL_UPDATE: 'legal-management:update',
  LEGAL_PUBLISH: 'legal-management:publish',

  // Projects
  PROJECTS_CREATE: 'projects:create',
  PROJECTS_READ: 'projects:read',
  PROJECTS_UPDATE: 'projects:update',
  PROJECTS_PUBLISH: 'projects:publish',
  PROJECTS_PUBLICPAGE: 'projects:publicpage',

  // Project public page
  PROJECT_PUBLIC_PAGE_READ: 'project-public-page:read',
  PROJECT_PUBLIC_PAGE_UPDATE: 'project-public-page:update',

  // Departments & designations
  DEPARTMENTS_CREATE: 'departments:create',
  DEPARTMENTS_READ: 'departments:read',
  DEPARTMENTS_UPDATE: 'departments:update',
  DESIGNATIONS_CREATE: 'designations:create',
  DESIGNATIONS_READ: 'designations:read',
  DESIGNATIONS_UPDATE: 'designations:update',

  // Policies (ABAC)
  POLICIES_CREATE: 'policies:create',
  POLICIES_READ: 'policies:read',
  POLICIES_UPDATE: 'policies:update',
  POLICIES_BIND: 'policies:bind',

  // Notifications
  NOTIFICATIONS_READ: 'notifications:read',

  // Listings
  LISTINGS_CREATE: 'listings:create',
  LISTINGS_READ: 'listings:read',
  LISTINGS_UPDATE: 'listings:update',
  LISTINGS_PUBLISH: 'listings:publish',

  // Opportunity listings
  OPPORTUNITY_LISTING_READ: 'opportunity-listing:read',
  OPPORTUNITY_LISTING_CREATE: 'opportunity-listing:create',
  OPPORTUNITY_LISTING_UPDATE: 'opportunity-listing:update',
  OPPORTUNITY_LISTING_PUBLISH: 'opportunity-listing:publish',
  OPPORTUNITY_LISTING_ARCHIVE: 'opportunity-listing:archive',
  OPPORTUNITY_LISTING_RESTORE: 'opportunity-listing:restore',

  // Approvals inbox — single permission gates viewing + acting.
  APPROVALS_ACT: 'approvals:act',

  // Opportunity
  OPPORTUNITY_READ: 'opportunity:read',
  OPPORTUNITY_CREATE: 'opportunity:create',
  OPPORTUNITY_UPDATE: 'opportunity:update',
  OPPORTUNITY_PUBLISH: 'opportunity:publish',

  // Calls
  CALLS_READ: 'calls:read',
  CALLS_CREATE: 'calls:create',
  CALLS_MANAGE: 'calls:manage',
  CALLS_MONITOR: 'calls:monitor',
  CALLS_LISTEN: 'calls:listen',
  CALLS_DOWNLOAD: 'calls:download',

  // Reception (receptionist dialer / transfer — Receptionist Module)
  RECEPTION_DIAL: 'reception:dial',
  RECEPTION_TRANSFER: 'reception:transfer',
  RECEPTION_ACCEPT: 'reception:accept',
  RECEPTION_VIEW_LOGS: 'reception:view-logs',

  // Chat
  // Backend split chat into per-channel resources (chat-whatsapp / chat-messenger).
  // Each channel exposes one combined read+write conversations code; whatsapp also
  // has start_conversation + manage_templates. Mobile has a single unified inbox
  // (no per-channel tabs) so chat surfaces gate on "any channel" via the CHAT_READ /
  // CHAT_WRITE aggregates exported below — read and write are the same combined code.
  CHAT_WHATSAPP_RW: 'chat-whatsapp:read_write_conversations',
  CHAT_WHATSAPP_START: 'chat-whatsapp:start_conversation',
  CHAT_WHATSAPP_MANAGE_TEMPLATES: 'chat-whatsapp:manage_templates',
  CHAT_MESSENGER_RW: 'chat-messenger:read_write_conversations',

  // Podcast CMS
  PODCAST_CMS_CREATE: 'podcast-cms:create',
  PODCAST_CMS_READ: 'podcast-cms:read',
  PODCAST_CMS_UPDATE: 'podcast-cms:update',
  PODCAST_CMS_PUBLISH: 'podcast-cms:publish',

  // Amenities
  AMENITIES_CREATE: 'amenities:create',

  // Areas
  AREAS_READ: 'areas:read',

  // Meet our team
  MEET_OUR_TEAM_CREATE: 'meet-our-team:create',
  MEET_OUR_TEAM_READ: 'meet-our-team:read',
  MEET_OUR_TEAM_UPDATE: 'meet-our-team:update',
  MEET_OUR_TEAM_PUBLISH: 'meet-our-team:publish',
  MEET_OUR_TEAM_DELETE: 'meet-our-team:delete',

  // Owners
  OWNERS_CREATE: 'owners:create',
  OWNERS_READ: 'owners:read',
  OWNERS_UPDATE: 'owners:update',
  OWNERS_ASSIGN: 'owners:assign',
  OWNERS_VIEW_CONTACT: 'owners:view_contact',

  // Speed to lead
  SPEED_TO_LEAD_READ: 'speed-to-lead:read',
  SPEED_TO_LEAD_MANAGE: 'speed-to-lead:manage',

  // Teams
  TEAMS_CREATE: 'teams:create',
  TEAMS_READ: 'teams:read',
  TEAMS_UPDATE: 'teams:update',
  TEAMS_DEACTIVATE: 'teams:deactivate',
  TEAMS_MANAGE_MEMBERS: 'teams:manage-members',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Aggregate chat gates. Mobile's unified inbox grants access if the user can
// read/write EITHER channel — mirrors the backend's @RequireAnyPermission on the
// unified conversation endpoints. read and write alias the same aggregate because
// each channel's code combines read + write (no read-only-vs-write split).
export const CHAT_READ = [PERMISSIONS.CHAT_WHATSAPP_RW, PERMISSIONS.CHAT_MESSENGER_RW] as const;
export const CHAT_WRITE = CHAT_READ;

// Agent phonebook + broadcast groups. WhatsApp-only — the backend's
// `agent-contacts` controller gates every route on the WhatsApp code alone, so
// this deliberately does NOT include the Messenger aggregate. Access also
// requires the caller to own a dedicated WhatsApp number, which is enforced
// server-side (403) and surfaced by `useContactsAvailable`.
export const CHAT_WHATSAPP_CONTACTS = [PERMISSIONS.CHAT_WHATSAPP_RW] as const;

// Dialer access gate. Mirror of web `CallServiceManager.canCall`: the click-to-dial
// user (calls:create) OR a receptionist (reception:dial / accept / transfer) can open
// the manual dialer. reception:view-logs is intentionally excluded — it gates call
// logs, not the dialer. Consumers still pair this with useHasCallingExtension() since
// a SIP extension is required to actually place a call on mobile.
export const DIALER_ACCESS = [
  PERMISSIONS.CALLS_CREATE,
  PERMISSIONS.RECEPTION_DIAL,
  PERMISSIONS.RECEPTION_ACCEPT,
  PERMISSIONS.RECEPTION_TRANSFER,
] as const;
