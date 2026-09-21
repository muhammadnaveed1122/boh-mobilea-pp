/**
 * Review-workflow state for the listing wizard — mirrors the web wizard's
 * `useListingWizard` review logic. All fields are server-authoritative and come
 * off the GET-single response (`/opportunity-listing/:id` or `/listing-cms/:id`).
 *
 * Phase 1 intentionally omits the workflow-governed Approvals path
 * (`isAwaitingPublish` / `isAwaitingUpdateReview`) — that subsystem isn't on
 * mobile yet. See docs/superpowers/specs/2026-07-02-listing-review-workflow-design.md.
 */

import { STATUS_BADGE_VARIANT, STATUS_LABEL, type ListingStatus } from '@/features/listings/types';

export type PublishOverrideStatus = 'in_review' | 're_review' | 'approved' | 'changes_requested';

/** Minimal person ref for the banner's "submitted by" / "assigned agent" rows. */
export interface ReviewPerson {
  id?: string;
  name?: string | null;
  role?: string | null;
  avatarUrl?: string | null;
}

export interface ReviewState {
  status: ListingStatus;
  /** Server-computed: caller may approve/request-changes/publish this listing. */
  isReviewer: boolean;
  isPublished: boolean;
  changeNotes: string | null;
  submittedAt: string | null;
  contentApprovedAt: string | null;
  changesRequestedAt: string | null;
  publishedAt: string | null;
  pendingPublishAt: string | null;
  pendingUpdateAt: string | null;
  /** The listing creator — shown as "Submitted by" on the banner. */
  createdBy: ReviewPerson | null;
  /**
   * Full name of the user who actually published the listing (from the listing's `published`
   * history event) — the same `publishedBy` field the web shows. Null while unpublished.
   */
  publishedBy: string | null;
  /** The public assigned agent (name + role). */
  agentInfo: ReviewPerson | null;
  permitStatus: string | null;
  permitExpiryDate: string | null;
}

interface ReviewPermitRaw {
  status?: string | null;
  expiryDate?: string | null;
}

/** Raw review fields as they arrive on the GET-single listing responses. */
export interface ReviewFieldsRaw {
  status?: ListingStatus | null;
  isReviewer?: boolean | null;
  isPublished?: boolean | null;
  changeNotes?: string | null;
  submittedAt?: string | null;
  contentApprovedAt?: string | null;
  changesRequestedAt?: string | null;
  publishedAt?: string | null;
  pendingPublishAt?: string | null;
  pendingUpdateAt?: string | null;
  createdBy?: ReviewPerson | null;
  publishedBy?: string | null;
  agentInfo?: ReviewPerson | null;
  trakheesiPermit?: ReviewPermitRaw | null;
}

export function toReviewState(raw: ReviewFieldsRaw): ReviewState {
  return {
    status: raw.status ?? 'draft',
    isReviewer: !!raw.isReviewer,
    isPublished: !!raw.isPublished,
    changeNotes: raw.changeNotes ?? null,
    submittedAt: raw.submittedAt ?? null,
    contentApprovedAt: raw.contentApprovedAt ?? null,
    changesRequestedAt: raw.changesRequestedAt ?? null,
    publishedAt: raw.publishedAt ?? null,
    pendingPublishAt: raw.pendingPublishAt ?? null,
    pendingUpdateAt: raw.pendingUpdateAt ?? null,
    createdBy: raw.createdBy ?? null,
    publishedBy: raw.publishedBy ?? null,
    agentInfo: raw.agentInfo ?? null,
    permitStatus: raw.trakheesiPermit?.status ?? null,
    permitExpiryDate: raw.trakheesiPermit?.expiryDate ?? null,
  };
}

export interface StatusHeadline {
  title: string;
  subtitle: string;
}

/** Big headline + one-line description per status — mirrors the web review card. */
export function statusHeadline(review: ReviewState): StatusHeadline {
  switch (review.status) {
    case 'in_review':
      return { title: 'Pending Review', subtitle: 'Submitted and awaiting reviewer approval.' };
    case 're_review':
      return { title: 'Pending Re-Review', subtitle: 'Resubmitted and awaiting approval.' };
    case 'changes_requested':
      return {
        title: 'Changes Requested',
        subtitle: 'A reviewer requested updates. Edit and resubmit.',
      };
    case 'approved':
      return { title: 'Approved', subtitle: 'Content approved and ready to publish.' };
    case 'active':
      return review.isPublished
        ? { title: 'Published', subtitle: 'This listing is published and live on the platform.' }
        : { title: 'Unpublished', subtitle: 'This listing is approved but not currently live.' };
    case 'inactive':
      return { title: 'Inactive', subtitle: 'This listing is not active.' };
    case 'archived':
      return { title: 'Archived', subtitle: 'This listing has been archived.' };
    default:
      return { title: 'Draft', subtitle: 'This listing has not been submitted yet.' };
  }
}

/** The timestamp + label most relevant to the current status. */
export function statusTimestamp(review: ReviewState): { label: string; iso: string } | null {
  const pick = (label: string, iso: string | null) => (iso ? { label, iso } : null);
  switch (review.status) {
    case 'active':
      return pick('Published', review.publishedAt);
    case 'approved':
      return pick('Approved', review.contentApprovedAt);
    case 'changes_requested':
      return pick('Requested', review.changesRequestedAt);
    case 'in_review':
    case 're_review':
      return pick('Submitted', review.submittedAt);
    default:
      return null;
  }
}

export interface PermitBadge {
  label: string;
  variant: 'successSoft' | 'warningSoft';
}

/** Trakheesi permit validity chip. Backend flips approved→expired past expiry. */
export function permitBadge(review: ReviewState): PermitBadge | null {
  if (review.permitStatus === 'approved') {
    const expiry = review.permitExpiryDate;
    const today = new Date().toISOString().slice(0, 10);
    if (!expiry || expiry >= today) return { label: 'Permit Valid', variant: 'successSoft' };
    return { label: 'Permit Expired', variant: 'warningSoft' };
  }
  if (review.permitStatus === 'expired') return { label: 'Permit Expired', variant: 'warningSoft' };
  return null;
}

/** Source resourceType the approvals API expects, per wizard branch. */
export function resourceTypeForBranch(
  branch: 'primary' | 'secondary',
): 'listing' | 'opportunity_listing' {
  return branch === 'primary' ? 'listing' : 'opportunity_listing';
}

/** Awaiting-publish: a pending listings_status request the user can't decide, OR a pooled marker. */
export function isAwaitingPublish(
  review: ReviewState | null,
  approvalStatus: {
    hasPendingRequest: boolean;
    category: string | null;
    canDecide: boolean;
  } | null,
): boolean {
  if (!review) return false;
  const workflowGoverned =
    !!approvalStatus?.hasPendingRequest &&
    approvalStatus.category === 'listings_status' &&
    !approvalStatus.canDecide;
  const pooled = review.pendingPublishAt !== null;
  return (workflowGoverned || pooled) && review.status !== 'active' && !review.isPublished;
}

/** The Trakheesi permit reads valid (backend enforces QR/alt + the rest at publish time). */
export function isPermitValidForPublish(review: ReviewState | null): boolean {
  return !!review && permitBadge(review)?.label === 'Permit Valid';
}

/**
 * Whether to SHOW the agent's go-live action: content approved, the caller is an agent
 * (not a reviewer), the listing isn't live, and no go-live is already pending. Permit
 * validity is handled separately (drives the button's enabled state, not its visibility).
 */
export function canSubmitGoLive(review: ReviewState | null, awaitingPublish: boolean): boolean {
  if (!review) return false;
  return (
    review.status === 'approved' && !review.isReviewer && !review.isPublished && !awaitingPublish
  );
}

/** Awaiting-update: a pending listings_update request the user can't decide, OR a pooled marker.
 *  Only meaningful while the listing is still Published (status active). */
export function isAwaitingUpdate(
  review: ReviewState | null,
  approvalStatus: {
    hasPendingRequest: boolean;
    category: string | null;
    canDecide: boolean;
  } | null,
): boolean {
  if (!review) return false;
  const workflowGoverned =
    !!approvalStatus?.hasPendingRequest &&
    approvalStatus.category === 'listings_update' &&
    !approvalStatus.canDecide;
  const pooled = review.pendingUpdateAt !== null;
  return (workflowGoverned || pooled) && review.status === 'active' && review.isPublished;
}

/** Agent may submit a content update: the listing is Published, the caller is an agent
 *  (not a reviewer), and no update is already pending. */
export function canSubmitUpdate(review: ReviewState | null, awaitingUpdate: boolean): boolean {
  if (!review) return false;
  return review.status === 'active' && review.isPublished && !review.isReviewer && !awaitingUpdate;
}

/** Form is frozen for the agent while under content review OR while a go-live/update is pending. */
export function isEditingFrozen(review: ReviewState | null, awaiting: boolean): boolean {
  return isContentLockedForReview(review) || (awaiting && !(review?.isReviewer ?? false));
}

const UNDER_REVIEW: ReadonlySet<ListingStatus> = new Set(['in_review', 're_review']);

/**
 * The single source of truth that disables the form. An agent (non-reviewer)
 * whose listing is `in_review` / `re_review` cannot edit until a manager sets
 * `changes_requested`. Reviewers (incl. super-admin, whom the backend stamps
 * `isReviewer:true`) are never locked by review status.
 */
export function isContentLockedForReview(review: ReviewState | null): boolean {
  if (!review) return false;
  return UNDER_REVIEW.has(review.status) && !review.isReviewer;
}

/** Reviewer may act (approve / request changes) only while the listing is under review. */
export function canReviewNow(review: ReviewState | null): boolean {
  return !!review && review.isReviewer && UNDER_REVIEW.has(review.status);
}

/** Status → the next submit action's override status. */
export function nextSubmitStatus(review: ReviewState | null): PublishOverrideStatus {
  return review?.status === 'changes_requested' ? 're_review' : 'in_review';
}

export interface FooterSubmitAction {
  /** When true, the terminal footer action is the review submit (not plain save). */
  isSubmit: boolean;
  label: string;
  /** Hide the terminal action entirely (form locked, or reviewer acts via banner). */
  hidden: boolean;
}

/**
 * Resolves the last-step (Portals) terminal action for the current role + status.
 * - Reviewers act from the banner → footer terminal action hidden.
 * - Locked (agent under review) → hidden.
 * - `changes_requested` → "Submit Re-Review"; otherwise "Submit for Review".
 * - Already active/approved with no edits still allows a plain finish (Save & Finish).
 */
export function resolveFooterSubmit(
  review: ReviewState | null,
  awaiting = false,
): FooterSubmitAction {
  if (awaiting) {
    // A go-live is pending approval — no terminal footer action.
    return { isSubmit: false, label: 'Save & Finish', hidden: true };
  }
  if (!review || review.status === 'draft') {
    return { isSubmit: true, label: 'Submit for Review', hidden: false };
  }
  if (isContentLockedForReview(review)) {
    return { isSubmit: false, label: 'Save & Finish', hidden: true };
  }
  if (review.isReviewer && UNDER_REVIEW.has(review.status)) {
    // Reviewer decides from the banner, not the footer.
    return { isSubmit: false, label: 'Save & Finish', hidden: true };
  }
  if (review.status === 'changes_requested') {
    return { isSubmit: true, label: 'Submit Re-Review', hidden: false };
  }
  if (UNDER_REVIEW.has(review.status)) {
    return { isSubmit: true, label: 'Submit for Review', hidden: false };
  }
  // approved / active / inactive / archived — plain save, no re-submit.
  return { isSubmit: false, label: 'Save & Finish', hidden: false };
}

export function statusLabel(status: ListingStatus): string {
  return STATUS_LABEL[status];
}

export function statusBadgeVariant(
  status: ListingStatus,
): (typeof STATUS_BADGE_VARIANT)[ListingStatus] {
  return STATUS_BADGE_VARIANT[status];
}
