// Maps a notification to an in-app expo-router destination. Ported from the
// web resolveRedirectUrl, then translated from web paths
// (/my-account/leads/:id ...) to mobile routes (/(app)/leads/[id] ...).
//
// Returns an href string, or null when there is no sensible in-app target —
// the caller then falls back to the notification center.

import type { Notification } from '../types';

// Backend redirectUrls are WEB routes (FRONTEND_ROUTES), e.g.
//   /my-account/manage-leads/:id, /my-account/project-management/:id,
//   /my-account/all-listings/:id. Translate to expo-router paths. Note: NO
//   `(app)` group prefix — the app navigates with `/leads/:id` style (the
//   group segment is not part of the URL).
const ID = '([^/?#]+)';

const RULES: { test: RegExp; to: (m: RegExpMatchArray) => string }[] = [
  // Resume/revise a listing in the wizard (submit-for-review OUTCOME: changes
  // requested / approved). Web `resumeListingInWizard` →
  //   /my-account/listings/create?listingId=<id>&type=primary|secondary
  // Mobile opens the same editor at /listings/edit/<id>?kind=<type>, where the
  // reviewer banner + resubmit live. Must precede the /all-listings rules.
  {
    test: /\/listings\/create\?listingId=([^&#]+)&type=(primary|secondary)/i,
    to: (m) => `/listings/edit/${m[1]}?kind=${m[2]}`,
  },
  // Opportunity / secondary-listing events (assigned, published, stage change, review
  // outcome). Web views these under the lead: /manage-leads/:leadId/property/:oppId.
  // Mobile has no secondary read-view, so open the secondary wizard (review banner +
  // edit/resubmit/approve actions live there). MUST precede the generic /manage-leads/:id
  // rule below, else that rule wins and drops the opportunity id.
  {
    test: new RegExp(`/manage-leads/${ID}/property/${ID}`, 'i'),
    to: (m) => `/listings/edit/${m[2]}?kind=secondary`,
  },
  { test: new RegExp(`/manage-leads/${ID}`, 'i'), to: (m) => `/leads/${m[1]}` },
  // Project detail. `/projects/[id]` is a mock-data screen (features/projects/data);
  // the API-backed detail lives at `/project-management/[id]`.
  {
    test: new RegExp(`/project-management/${ID}`, 'i'),
    to: (m) => `/project-management/${m[1]}`,
  },
  // Listing DETAIL — must precede the all-listings LIST rule below, else the
  // list rule swallows the id and drops the user on the list, not the listing.
  { test: new RegExp(`/all-listings/${ID}`, 'i'), to: (m) => `/listings/${m[1]}` },
  { test: /\/all-listings(\/|\?|#|$)/i, to: () => '/listings' },
  { test: /\/manage-leads(\/|\?|#|$)/i, to: () => '/leads' },
  { test: /\/project-management(\/|\?|#|$)/i, to: () => '/project-management' },
  // Legacy/short forms, just in case a payload uses them.
  { test: new RegExp(`/leads/${ID}`, 'i'), to: (m) => `/leads/${m[1]}` },
  { test: new RegExp(`/projects/${ID}`, 'i'), to: (m) => `/project-management/${m[1]}` },
];

const CATEGORY_FALLBACK: Partial<Record<Notification['category'], string>> = {
  leads: '/leads',
  projects: '/project-management',
  listings: '/listings',
  chat: '/chat',
};

/**
 * Core resolver: a redirect URL string + optional category fallback + optional
 * conversationId → in-app route. Shared by socket notifications (full payload)
 * and OS-push taps (only `data` available). A chat conversationId wins: every
 * channel (WhatsApp/SMS/Messenger/email) opens the same `/chat/[id]` thread.
 */
export function resolveRedirectFromData(
  redirectUrl: unknown,
  category?: unknown,
  conversationId?: unknown,
  resourceId?: unknown,
  resourceKind?: unknown,
): string | null {
  if (typeof conversationId === 'string' && conversationId !== '') {
    return `/chat/${conversationId}`;
  }
  // Approver submit-for-review notice. Its redirectUrl (/my-account/approvals/…)
  // carries only the requestId — no resourceId — and mobile has no approvals
  // inbox. The backend rides the listing's resourceId + kind in the notification
  // data so we can open the wizard editor, where reviewers act via the banner.
  if (typeof resourceId === 'string' && resourceId !== '') {
    const kind = resourceKind === 'secondary' ? 'secondary' : 'primary';
    return `/listings/edit/${resourceId}?kind=${kind}`;
  }
  if (typeof redirectUrl === 'string' && redirectUrl !== '') {
    for (const rule of RULES) {
      const m = rule.test.exec(redirectUrl);
      if (m) return rule.to(m);
    }
  }
  if (typeof category === 'string') {
    return CATEGORY_FALLBACK[category as Notification['category']] ?? null;
  }
  return null;
}

export function resolveRedirect(notification: Notification): string | null {
  return resolveRedirectFromData(
    notification.data?.redirectUrl,
    notification.category,
    notification.data?.conversationId,
    notification.data?.resourceId,
    notification.data?.resourceKind,
  );
}
