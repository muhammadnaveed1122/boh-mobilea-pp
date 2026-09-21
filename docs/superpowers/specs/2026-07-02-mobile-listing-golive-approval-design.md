# Mobile Listing Go-Live Approval (Phase 2) — Design

**Date:** 2026-07-02
**Status:** Approved — ready for implementation plan
**Repo:** `boh-mobile`

## Goal

Close the Phase-2 gap the listing-review workflow deliberately left open (see
`2026-07-02-listing-review-workflow-design.md`): the **agent-side go-live / submit-for-status
approval**. After a listing's content is approved, an agent submits it to go live; the backend
intercepts the publish call and routes it through the **Listings Status** approval workflow
(line manager → pool). The wizard's `ReviewBanner` then reflects the awaiting-publish state,
deep-links into the Approvals request, and lets a courtesy reviewer acknowledge — full parity
with the web wizard, in mobile manner.

## Background (verified against the codebase)

- **Backend already routes the agent go-live.** `opportunity-listing.service.ts` /
  `listing-cms.service.ts`: "An AGENT's go-live never publishes directly — route through the
  publish fallback chain (workflow → line manager → pool)." It fires on the existing publish
  endpoint (`PATCH /api/v1/opportunity-listing/:id/publish` or `/listing-cms/:id/publish`) with
  `{ isPublished: true }`, sets `pendingPublishAt`, and logs `submitted_for_publish`.
- **Web** does this via `useListingWizard` → `publishListing({ isPublished: true })` (no separate
  submit endpoint; the `SubmitForApprovalModal` exists but is unused). Awaiting state comes from
  `getResourceApprovalStatus` + `pendingPublishAt`; the banner shows an awaiting notice, a
  "Go to Approvals" deep-link (designated approvers), and an "Acknowledge" (courtesy reviewers).
- **Mobile** already has: the publish mutation (`useReviewMutations().setPublished({isPublished})`
  → `publishOpportunityListing` / `publishListingCms`), `pendingPublishAt` on `ReviewState`, and
  the full Approvals inbox (queue + `/(app)/approvals/listings-status/[id]` detail). It LACKS the
  resource-status/acknowledge services and any agent go-live affordance or awaiting-publish UI.

So this phase is UI + a small data layer; no new endpoints, no new publish mechanism.

## Backend endpoints (shared, `/api/v1` prefix)

| Purpose                                                      | Method + path                                                                                                                                   |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent go-live (backend intercepts → listings_status request) | `PATCH /api/v1/opportunity-listing/{id}/publish` or `/listing-cms/{id}/publish` with `{ isPublished: true }` — already wired via `setPublished` |
| Resource pending-approval status                             | `GET /api/v1/approvals/resource-status?resourceType=&resourceId=`                                                                               |
| Courtesy acknowledge                                         | `POST /api/v1/approvals/acknowledge` `{ resourceType, resourceId, note? }`                                                                      |

`resourceType`: `listing` for the **primary** (listing-cms) branch, `opportunity_listing` for the
**secondary** (opportunity) branch.

## 1. Approvals data layer (`src/features/approvals/`)

### `models/approval.ts` — add

```ts
export interface ResourceApprovalStatus {
  hasPendingRequest: boolean;
  requestId: string | null;
  /** WorkflowCategory of the pending request (e.g. 'listings_status'). */
  category: string | null;
  /** Whether THIS user may decide it (designated approver / super-admin). */
  canDecide: boolean;
}
```

### `services.ts` — add

```ts
export async function getResourceApprovalStatus(params: {
  resourceType: string;
  resourceId: string;
}): Promise<ResourceApprovalStatus>; // GET /api/v1/approvals/resource-status?...
// normalize: hasPendingRequest ?? false, requestId ?? null,
// category ?? null, canDecide ?? false

export async function acknowledgeRequest(params: {
  resourceType: string;
  resourceId: string;
  note?: string;
}): Promise<{ requestId: string } | null>; // POST /api/v1/approvals/acknowledge
```

### hooks

- `hooks/use-resource-approval-status.ts` — `useResourceApprovalStatus(resourceType, resourceId, options?)`:
  `useQuery({ queryKey: ['approvals','resource-status', resourceType, resourceId], queryFn, enabled: resourceId !== '' && (options?.enabled ?? true) })`.
- `hooks/use-acknowledge.ts` — `useAcknowledge()`: `useMutation(acknowledgeRequest)` that
  invalidates `['approvals','resource-status', resourceType, resourceId]` and `['approvals']`.

Export all four from the approvals barrel `index.ts` as needed by the wizard.

## 2. Review-state helpers (`src/features/listing-wizard/review-state.ts`)

`ReviewState`/`ReviewFieldsRaw` already carry `pendingPublishAt`. Add:

```ts
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

/** Agent may kick off a go-live: content approved, not a reviewer, not live, not already awaiting,
 *  and the Trakheesi permit reads valid (backend enforces QR/alt + the rest). */
export function canSubmitGoLive(review: ReviewState | null, awaitingPublish: boolean): boolean {
  if (!review) return false;
  return (
    review.status === 'approved' &&
    !review.isReviewer &&
    !review.isPublished &&
    !awaitingPublish &&
    permitBadge(review)?.label === 'Permit Valid'
  );
}
```

Extend the edit-freeze so an agent can't edit while a go-live is pending. Add:

```ts
/** Form is frozen for the agent while under content review OR while a go-live is awaiting publish. */
export function isEditingFrozen(review: ReviewState | null, awaitingPublish: boolean): boolean {
  return isContentLockedForReview(review) || (awaitingPublish && !(review?.isReviewer ?? false));
}
```

`resolveFooterSubmit` also hides the terminal action while awaiting publish — add an
`awaitingPublish` parameter (default `false` to preserve existing callers) and return
`{ isSubmit: false, label: 'Save & Finish', hidden: true }` when it is true.

## 3. ReviewBanner (`src/features/listing-wizard/components/ReviewBanner.tsx`)

Add two pieces, driven by new props (all optional so existing render sites compile):

- `canSubmitGoLive?: boolean`, `submittingGoLive?: boolean`, `onSubmitGoLive?: () => void`
- `awaitingPublish?: boolean`, `permitValid?: boolean`
- `approvalRequestId?: string | null`, `onViewRequest?: () => void`
- `canAcknowledge?: boolean`, `acknowledging?: boolean`, `onAcknowledge?: () => void`

**Agent go-live action** (in the actions area, shown when `canSubmitGoLive`):
`Button` (Rocket icon) labelled **Submit for Approval**, `loading={submittingGoLive}`, disabled
when `!permitValid` with a helper line "An approved Trakheesi permit is required to publish."

**Awaiting-publish notice** (shown when `awaitingPublish`): an `info`-tinted callout (mirror the
existing locked-notice styling) reading "Submitted for publish — awaiting an approver." With:

- **View request** button → `onViewRequest` when `approvalRequestId` is set (routes to the
  Approvals detail). Omitted for the pooled case (no request id yet).
- **Acknowledge** button → `onAcknowledge` when `canAcknowledge`, `loading={acknowledging}`.

Keep all existing reviewer actions and notices unchanged.

## 4. Wizard wiring (`src/features/listing-wizard/components/ListingWizard.tsx`)

- Resolve `branch` from `created`/`initial`; `const resourceType = resourceTypeForBranch(branch)`.
- `const { data: approvalStatus } = useResourceApprovalStatus(resourceType, listingId ?? '', { enabled: hasListing });`
- `const awaitingPublish = isAwaitingPublish(review, approvalStatus ?? null);`
- `const frozen = isEditingFrozen(review, awaitingPublish);` (replaces the current `locked` where it drives the form lock; keep passing the locked notice for content-review).
- `onSubmitGoLive`: permit guard → `reviewMutations.setPublished.mutateAsync({ isPublished: true })`
  → toast "Submitted for approval" (error toast on failure). The subsequent hydration refetch sets
  `pendingPublishAt` and flips the banner to awaiting.
- `onViewRequest`: `router.push({ pathname: '/(app)/approvals/[queue]/[id]', params: { queue: 'listings-status', id: approvalStatus.requestId } })` (guarded on non-null id).
- `onAcknowledge`: `useAcknowledge().mutateAsync({ resourceType, resourceId: listingId })` → toast.
- `canAcknowledge = !!approvalStatus?.hasPendingRequest && (review?.isReviewer ?? false) && !approvalStatus.canDecide`.
- Pass `resolveFooterSubmit(review, awaitingPublish)` so the footer terminal action hides while awaiting.
- Feed the new props into `<ReviewBanner … />`.

## Conventions

- TanStack Query (no RTK); axios `apiClient` (envelope auto-unwrapped); all paths `/api/v1`.
- NativeWind semantic tokens only; `Readonly<{...}>` props; `cn()` for combined classes; strict TS.
- Reuse existing atoms (`Button`, `Badge`, `Icon`, `Text`) and the approvals deep-link route.
- No new runtime dependencies.

## Out of scope

- `listings_update` (content-update-while-published) go-live and its banner state.
- Super-admin direct-publish bypass (the reviewer `Publish` action already exists in the banner).
- Any change to the content-review phase (submit-for-review / approve / request-changes).

## Verification

No unit tests (repo policy). Verify via `npx tsc --noEmit` + `pnpm lint` + manual QA:
agent with an approved listing sees **Submit for Approval** (disabled without a valid permit);
tapping it submits, the banner flips to **awaiting publish** and the form locks; **View request**
opens the listings-status Approvals detail; a line-manager reviewer (not the designated approver)
sees **Acknowledge** and it records; approving the request in Approvals clears the awaiting state.
