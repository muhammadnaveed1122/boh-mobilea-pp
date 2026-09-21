# Mobile Listings Update (Phase 3) — Design

**Date:** 2026-07-03
**Status:** Approved — ready for implementation plan
**Repo:** `boh-mobile`

## Goal

Bring the **Listings Update** approval flow to mobile at full web parity, on both sides:

- **Approver side** — enable the `listings-update` approvals queue (currently a greyed
  "Coming soon" catalogue entry). The queue cards and detail screen already render the
  changed-field diff, so this is a catalogue flip.
- **Agent side** — let an agent submit a content update on a **Published** listing. The backend
  intercepts the submit into the `listings_update` workflow, keeps the listing Published
  (status stays `active`), and sets `pendingUpdateAt`. The wizard's `ReviewBanner` surfaces a
  **Submit Update for Review** action and, once submitted, an **awaiting-update** state with a
  deep-link into the Approvals request and an edit-lock — mirroring the web wizard.

This is the sibling of the go-live (`listings_status`) flow shipped in
`2026-07-02-mobile-listing-golive-approval-design.md`, and it reuses that phase's
`useResourceApprovalStatus` / `useAcknowledge` data layer.

## Background (verified against the codebase)

- **Backend intercepts the update.** `opportunity-listing.service.ts` `tryRouteUpdateForApproval`:
  a review submit (`in_review` / `re_review`) on a listing routes through the
  `listings_update` workflow, capturing a before→after field diff. For a **PUBLISHED** listing
  (`status === active`) it keeps status `active` and sets `pendingUpdateAt` (badge stays
  "Published"); the pending state drives the wizard lock. Same shape in `listing-cms.service.ts`.
- **Web** shows a `showPendingUpdate` notice in `ReviewBannerView` ("Your content update is
  awaiting review. The listing stays published … until the reviewer approves the update.") driven
  by `getResourceApprovalStatus` (category `listings_update`, can't decide) OR the
  `pendingUpdateAt` marker. The submit itself is the wizard's review submit.
- **Mobile already has:** the `submitForReview` mutation (`useReviewMutations().submitForReview`
  → `publishOpportunityListing`/`publishListingCms` with `{ isPublished:false, status }`), the
  approvals queue+detail that already render the update diff (`ChangedFields` /
  `FieldChangeList` via `asUpdateSnapshot`), `pendingUpdateAt` on `ReviewState`, and the
  `useResourceApprovalStatus` + `useAcknowledge` hooks wired into `ListingWizard`. It LACKS: the
  listings-update queue being enabled, and any agent submit-update affordance or awaiting-update UI.
- **The gap in `resolveFooterSubmit`:** for a Published listing (`status === active`) it returns
  `Save & Finish` (no submit). So an agent editing a published listing has no way to submit an
  update. The new banner action fills this.

So this phase is a catalogue flip + UI/state; no new endpoints, no new mutation, no new services.

## A. Approver side — enable the queue

`src/features/approvals/constants/queues.ts`: change the `listings-update` entry's
`deferred: true` → `deferred: false`. Nothing else — the generic queue screen, the rich card's
`ChangedFields` block, and the detail screen's `updateDiff` / `FieldChangeList` already handle
the update-request shape. The hub's Listings Update card becomes tappable.

## B. Agent side — content-update submit + awaiting-update banner

### B1. Review-state helpers (`src/features/listing-wizard/review-state.ts`)

`ReviewState` already carries `pendingUpdateAt`, `isPublished`, `status`. Add:

```ts
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
```

Extend the existing `isEditingFrozen` to also freeze while an update is pending. Change it to
accept the combined awaiting flag (the wizard passes `awaitingPublish || awaitingUpdate`):

```ts
/** Form is frozen for the agent while under content review OR while a go-live/update is pending. */
export function isEditingFrozen(review: ReviewState | null, awaiting: boolean): boolean {
  return isContentLockedForReview(review) || (awaiting && !(review?.isReviewer ?? false));
}
```

`resolveFooterSubmit`'s 2nd parameter already hides the terminal action while awaiting; keep its
signature `resolveFooterSubmit(review, awaiting = false)` and have the wizard pass
`awaitingPublish || awaitingUpdate`. (No signature change beyond the caller's argument.)

> Note: the go-live phase's `isEditingFrozen(review, awaitingPublish)` call in `ListingWizard`
> becomes `isEditingFrozen(review, awaitingPublish || awaitingUpdate)`; the helper body already
> matches this generalized shape.

### B2. ReviewBanner (`src/features/listing-wizard/components/ReviewBanner.tsx`)

Add an `AgentUpdateSection` alongside the existing `AgentPublishSection`, driven by new OPTIONAL
props (existing call sites keep compiling):

- `canSubmitUpdate?: boolean`, `submittingUpdate?: boolean`, `onSubmitUpdate?: () => void`
- `awaitingUpdate?: boolean`

It reuses the already-present `approvalRequestId` / `onViewRequest` / `canAcknowledge` /
`acknowledging` / `onAcknowledge` props (shared with the publish section).

`AgentUpdateSection` renders (returns null when neither condition holds):

- **Submit Update for Review** button (`Icon name="Send"` or `"Upload"`), `loading={submittingUpdate}`,
  shown when `canSubmitUpdate`.
- Awaiting-update notice (info-tinted callout, mirroring `AgentPublishSection`'s awaiting styling)
  when `awaitingUpdate`: "Your content update is awaiting review — the listing stays published
  until the reviewer approves the update." With **View Request** (when `approvalRequestId` &&
  `onViewRequest`) and **Acknowledge** (when `canAcknowledge` && `onAcknowledge`).

Render `<AgentUpdateSection … />` immediately AFTER the existing `<AgentPublishSection … />` in
the expanded block. Only one of publish/update sections is ever active for a given listing state
(approved→publish; active+published→update), so they don't overlap.

### B3. Wizard wiring (`src/features/listing-wizard/components/ListingWizard.tsx`)

The go-live task already computes `approvalStatus`, `awaitingPublish`, `frozen`, `footerSubmit`,
and `canAcknowledge`. Extend:

```ts
const awaitingUpdate = isAwaitingUpdate(review, approvalStatus ?? null);
const showSubmitUpdate = canSubmitUpdate(review, awaitingUpdate);
const frozen = isEditingFrozen(review, awaitingPublish || awaitingUpdate);
const footerSubmit = resolveFooterSubmit(review, awaitingPublish || awaitingUpdate);
```

(`canAcknowledge` is category-agnostic — unchanged. It already covers a listings_update request
the reviewer can't decide.)

Add the handler (reuses the existing `submitForReview` mutation + `queryClient` from the go-live task):

```ts
const handleSubmitUpdate = () => {
  reviewMutations.submitForReview.mutate(
    { status: nextSubmitStatus(review) },
    {
      onSuccess: () => {
        queryClient
          .invalidateQueries({
            queryKey: ['approvals', 'resource-status', resourceType, resourceId],
          })
          .catch(() => {});
        showToast('success', 'Update submitted for review');
      },
      onError: (error) => showToast('error', error.message || 'Could not submit update.'),
    },
  );
};
```

Pass the new props to `<ReviewBanner … />`:

```tsx
          canSubmitUpdate={showSubmitUpdate}
          submittingUpdate={reviewMutations.submitForReview.isPending}
          onSubmitUpdate={handleSubmitUpdate}
          awaitingUpdate={awaitingUpdate && !review?.isReviewer}
```

`nextSubmitStatus(review)` for an `active` listing returns `in_review` (only `changes_requested`
maps to `re_review`), which the backend routes into `listings_update` and keeps Published.

## Conventions

- TanStack Query (no RTK); axios `apiClient` (envelope auto-unwrapped); paths `/api/v1`.
- NativeWind semantic tokens only; `Readonly<{...}>` props; `cn()`; strict TS.
- Query invalidation via the repo's fire-and-forget pattern (`.catch(() => {})`).
- Reuse existing atoms, the resource-status/acknowledge hooks, and the approvals deep-link route.
- No new runtime dependencies.

## Out of scope

- `listings_status` go-live (shipped in Phase 2).
- Changes to the content-review phase (submit-for-review from draft / changes-requested) beyond
  reusing its mutation for the published-listing update path.
- Super-admin bypass and reviewer-side actions (already present).

## Verification

No unit tests (repo policy). Verify via `npx tsc --noEmit` + `pnpm lint` + manual QA:

- **Approver:** the Approvals hub's **Listings Update** card is tappable; the queue lists update
  requests with the changed-field diff on each card; the detail shows the diff + history + chain;
  Approve / Request changes work.
- **Agent:** editing a **Published** listing shows **Submit Update for Review**; tapping it (after
  editing) submits, the badge stays **Published**, the banner flips to the **awaiting-update**
  notice, and the form freezes; **View Request** opens the listings-update Approvals detail; a
  line-manager reviewer sees **Acknowledge**; approving the request clears the awaiting state.
