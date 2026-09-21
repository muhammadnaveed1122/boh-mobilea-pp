import { CHAT_READ, PERMISSIONS, useCan } from '@/lib/rbac';

import type { LeadDetail } from '../models/lead-detail';
import { useCanViewLeadContact } from './use-can-view-lead-contact';

type LeadPermissionsSubject = Readonly<Pick<LeadDetail, 'assignee'>>;

export interface LeadPermissions {
  canRead: boolean;
  canUpdate: boolean;
  canAssign: boolean;
  canViewContact: boolean;
  canCall: boolean;
  canChat: boolean;
}

/**
 * Aggregator hook for lead-detail RBAC gates. Keeps page / form / card
 * consumers free of inline `useCan` clutter and ensures a single source
 * of truth for which permission maps to which capability.
 */
export function useLeadPermissions(lead?: LeadPermissionsSubject): LeadPermissions {
  const canReadOwn = useCan(PERMISSIONS.LEADS_READ);
  const canReadAll = useCan(PERMISSIONS.LEADS_READ_ALL);
  const canUpdateOwn = useCan(PERMISSIONS.LEADS_UPDATE);
  const canUpdateAll = useCan(PERMISSIONS.LEADS_UPDATE_ALL);
  const canAssign = useCan(PERMISSIONS.LEADS_ASSIGN);
  const canCall = useCan([PERMISSIONS.CALLS_READ, PERMISSIONS.CALLS_CREATE]);
  // Lead chat opens /chat/lead/[leadId], which (like the backend by-lead
  // endpoints and POST /chat/send) requires read/write on either chat channel.
  // leads:chat is seeded but enforced by no backend guard, so it must NOT gate
  // this button — it would hide chat from users who can chat, and show a dead
  // button to users the chat route guard then bounces.
  const canChat = useCan(CHAT_READ);
  const canViewContact = useCanViewLeadContact(lead);

  return {
    canRead: canReadOwn || canReadAll,
    canUpdate: canUpdateOwn || canUpdateAll,
    canAssign,
    canViewContact,
    canCall,
    canChat,
  };
}
