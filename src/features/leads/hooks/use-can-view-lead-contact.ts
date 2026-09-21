import { PERMISSIONS } from '@/lib/rbac/permissions';
import { useCan } from '@/lib/rbac/use-can';

import type { LeadDetail } from '../models/lead-detail';

type LeadContactSubject = Readonly<Pick<LeadDetail, 'assignee'>>;

/**
 * Returns true when the current user is allowed to see unmasked lead contact
 * details (email / phone). Mirrors the web app 1:1 — gated by the dedicated
 * `leads:view_contact` permission; all-access users pass automatically via
 * `useCan`.
 *
 * `lead` is accepted but unused for parity with the broader RBAC API; future
 * rules (e.g. assignee unmask) can be wired here without changing call sites.
 */
export function useCanViewLeadContact(_lead?: LeadContactSubject): boolean {
  return useCan(PERMISSIONS.LEADS_VIEW_CONTACT);
}
