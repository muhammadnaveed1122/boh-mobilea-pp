/**
 * Mobile LeadActivity models — mirrors web
 * `boh-lead-magnet/src/features/leads/models/activity.ts`.
 *
 * Backend endpoint: `GET /api/v1/leads/:id/activities` (paginated).
 */

/**
 * All activity types emitted by the backend `LeadAction` enum. Kept in full
 * parity with web `boh-lead-magnet/.../models/activity.ts` `LeadActionType` so
 * the mobile timeline renders every event the web app does (no silent
 * "unknown activity" gaps).
 */
export type LeadActionType =
  | 'created'
  | 'updated'
  | 'assigned'
  | 'status_changed'
  | 'viewed'
  | 'notes_added'
  | 'priority_changed'
  | 'qualification_updated'
  | 'listing_linked'
  | 'listing_unlinked'
  | 'project_linked'
  | 'project_unlinked'
  | 'agent_reassigned'
  | 'agent_unassigned'
  | 'sms_sent'
  | 'whatsapp_sent'
  | 'whatsapp_received'
  | 'email_sent'
  | 'identity_document_uploaded'
  | 'identity_verified'
  | 'identity_note_added'
  | 'identity_verification_link_generated'
  | 'identity_verification_link_shared'
  | 'identity_verified_external'
  | 'call_logged'
  | 'ownership_document_uploaded'
  | 'ownership_verified'
  | 'ownership_rejected'
  | 'contract_a_dld_redirect'
  | 'contract_a_uploaded'
  | 'contract_a_replaced'
  | 'noc_uploaded'
  | 'noc_replaced'
  | 'general_document_uploaded'
  | 'general_document_replaced'
  | 'property_finder_imported'
  | 'property_finder_merged';

export interface LeadActivityMetadata {
  source?: string;
  performer_name?: string;
  old_status?: string;
  new_status?: string;
  old_priority?: string;
  new_priority?: string;
  assignee_name?: string;
  previous_assignee_name?: string;
  summary?: string;
  listing_name?: string;
  project_name?: string;
  message_preview?: string;
  /** Messaging: message kind (text/image/video/...) and who sent it. */
  message_type?: string;
  sender_role?: string;
  note?: string;
  /** Call-logged event fields. */
  liveNotes?: string;
  outcome?: string;
  startedAt?: string;
  endedAt?: string;
  duration?: number;
  /** PropertyFinder import/merge fields. */
  pfLeadId?: string;
  pfChannel?: string;
  pfCreatedAt?: string;
  [key: string]: unknown;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  action: LeadActionType;
  performedById: string | null;
  performedByName: string | null;
  performedByRole?: string | null;
  ipAddress: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  metadata: LeadActivityMetadata | null;
  createdAt: string;
}

export interface LeadActivityQuery {
  page?: number;
  limit?: number;
  search?: string;
  action?: LeadActionType[];
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Backend returns `{ items, meta: { page, limit, total, totalPages } }` for the
 * activities endpoint (see web `getLeadActivities` transformResponse). Mobile's
 * axios interceptor unwraps the outer `{ success, data }` envelope, so we
 * receive this raw payload here.
 */
export interface LeadActivityPage {
  items: LeadActivity[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
