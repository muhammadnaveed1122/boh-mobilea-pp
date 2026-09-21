/** Approval-request domain types (mirror the backend DTOs the web app consumes). */

export type ApprovalRequestStatus = 'pending' | 'approved' | 'changes_requested';
export type ApprovalStepStatus = 'upcoming' | 'pending' | 'approved' | 'changes_requested';
export type ApprovalDecision = 'approved' | 'changes_requested';
export type ApprovalEventType =
  | 'submitted'
  | 'approved'
  | 'changes_requested'
  | 'resubmitted'
  | 'acknowledged';

/** URL queue segments (kebab) — map 1:1 to backend categories. */
export type ApprovalQueueSlug =
  | 'transactions'
  | 'commission'
  | 'portals'
  | 'listings-status'
  | 'listings-update';

export interface ApprovalStepApprover {
  id: string;
  kind: string;
  userId: string | null;
  roleId: string | null;
  label: string | null;
  decision: ApprovalDecision | null;
  note: string | null;
}

export interface ApprovalStep {
  id: string;
  position: number;
  mode: string;
  status: ApprovalStepStatus;
  isCurrent: boolean;
  approvers: ApprovalStepApprover[];
}

export interface ApprovalEvent {
  id: string;
  type: ApprovalEventType;
  actorId: string | null;
  actorName: string | null;
  note: string | null;
  createdAt: string;
}

/** A single before → after spec-field change on a Listings Update request. */
export interface ListingFieldChange {
  field: string;
  label: string;
  before: string | null;
  after: string | null;
}

/** Snapshot stored for a Listings Update request (rendered as a diff). */
export interface ListingUpdateSnapshot {
  kind: 'update';
  fields: ListingFieldChange[];
}

/** Narrow an unknown request snapshot to the Listings Update diff shape. */
export function asUpdateSnapshot(snapshot: unknown): ListingUpdateSnapshot | null {
  if (
    typeof snapshot === 'object' &&
    snapshot !== null &&
    (snapshot as { kind?: unknown }).kind === 'update' &&
    Array.isArray((snapshot as { fields?: unknown }).fields)
  ) {
    return snapshot as ListingUpdateSnapshot;
  }
  return null;
}

/** Rich listing summary shown on the queue cards (image + key/value grid). */
export interface ListingPreview {
  kind: 'primary' | 'secondary';
  title: string | null;
  /** Short human reference (`S-1042` / `R-1042`) — shown beside the title on the card. */
  reference: string | null;
  imageUrl: string | null;
  price: number | null;
  priceUnit: string | null;
  propertyType: string | null;
  community: string | null;
  area: string | null;
  developer: string | null;
  size: string | null;
  totalFloors: number | null;
  floorLevel: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  agent: string | null;
  permitNumber: string | null;
}

export interface ApprovalRequestListItem {
  id: string;
  category: string;
  status: ApprovalRequestStatus;
  resourceType: string;
  resourceId: string;
  approvalFor: string | null;
  snapshot: unknown;
  submitterId: string;
  submitterName: string | null;
  currentApproverName: string | null;
  submittedAt: string;
  decidedAt: string | null;
  listingPreview: ListingPreview | null;
}

export interface ApprovalRequestDetail extends ApprovalRequestListItem {
  steps: ApprovalStep[];
  history: ApprovalEvent[];
  canAct: boolean;
}

export interface ApprovalQueueCounts {
  pending: number;
  approved: number;
  changes_requested: number;
}

export interface ApprovalQueueResponse {
  items: ApprovalRequestListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts: ApprovalQueueCounts;
}

export interface ApprovalQueueParams {
  queue: ApprovalQueueSlug;
  status?: ApprovalRequestStatus;
  search?: string;
  approverId?: string;
  agentId?: string;
  page?: number;
  limit?: number;
}

/** Pending-approval status of a source record — drives the wizard's awaiting-publish banner. */
export interface ResourceApprovalStatus {
  hasPendingRequest: boolean;
  requestId: string | null;
  /** WorkflowCategory of the pending request (e.g. 'listings_status'). */
  category: string | null;
  /** Whether THIS user may decide it (designated approver / super-admin). */
  canDecide: boolean;
}

/** Blank strings must behave like a missing value — `??` alone would keep the empty string. */
function nonEmptyText(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Heading for a listing preview. Falls back to a composed description such as
 * `3BR Apartment | Jumeirah Beach Residence | Level 3` when the record carries no stored
 * title/name (secondary listings keep `name` nullable), so approvers can tell requests
 * apart in the queue without opening each one. Mirrors the backend fallback.
 */
export function listingPreviewTitle(preview: ListingPreview | null | undefined): string | null {
  if (preview === null || preview === undefined) return null;
  const stored = nonEmptyText(preview.title);
  if (stored !== null) return stored;
  const bedroomLabel =
    preview.bedrooms !== null && preview.bedrooms > 0 ? `${String(preview.bedrooms)}BR` : null;
  const headline = [bedroomLabel, nonEmptyText(preview.propertyType)]
    .filter((v): v is string => v !== null)
    .join(' ');
  const segments = [
    headline === '' ? null : headline,
    nonEmptyText(preview.community) ?? nonEmptyText(preview.area),
    nonEmptyText(preview.floorLevel),
  ].filter((v): v is string => v !== null);
  return segments.length === 0 ? null : segments.join(' | ');
}
