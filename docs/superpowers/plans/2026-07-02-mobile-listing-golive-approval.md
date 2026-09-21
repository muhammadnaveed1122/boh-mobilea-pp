# Mobile Listing Go-Live Approval (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an agent submit an approved listing to go live through the Listings Status approval workflow, and surface the awaiting-publish state (with a deep-link into Approvals + acknowledge) in the wizard's ReviewBanner — full web parity.

**Architecture:** Add a small resource-approval-status + acknowledge data layer to the existing `src/features/approvals/` feature, add pure review-state helpers to `src/features/listing-wizard/review-state.ts`, extend `ReviewBanner.tsx` with agent go-live + awaiting-publish UI (new optional props), and wire it all in `ListingWizard.tsx`. The go-live itself reuses the existing `useReviewMutations().setPublished({ isPublished: true })` mutation — the backend intercepts an agent's publish into a `listings_status` request.

**Tech Stack:** React Native 0.81, Expo SDK 54, Expo Router, NativeWind v4, TanStack Query v5, axios (`apiClient`), `lucide-react-native`.

## Global Constraints

- **No test runner** (repo policy). Verify every task with `npx tsc --noEmit` (clean) + `pnpm lint` (clean) from repo root + the task's manual-QA note. No `*.test.*` files.
- **Styling:** NativeWind semantic tokens only (`bg-info/15`, `text-info`, `text-foreground`, `text-muted-foreground`, `border-border`, `text-warning`…). No hard-coded hex. Colors that need a value come from `useThemeColor('--token')` (wrapped in `normalizeRgb` as the banner already does).
- **Prop types:** `Readonly<{...}>`. Strict TS. Merge classes with `cn()`.
- **HTTP:** through `apiClient` from `@/lib/api`; its interceptor unwraps `{ success, data }`, so `const { data } = await apiClient.get(...)` yields the payload. All paths `/api/v1`.
- **Query invalidation:** use the repo's fire-and-forget pattern (`qc.invalidateQueries(...).catch(() => {})`), matching `use-review-mutations.ts` and `use-approval-detail.ts`.
- **No new runtime dependencies.**
- **Commits:** end message body with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## Refinement over the spec

The spec's `canSubmitGoLive` folded the permit check into visibility. This plan **splits** it: `canSubmitGoLive` gates the button's _visibility_ (approved / agent / not-live / not-awaiting), and a separate `isPermitValidForPublish` gates its _enabled_ state — so the button shows **disabled with a hint** when the permit isn't valid, instead of vanishing. Everything else matches the spec.

## File Structure

```
src/features/approvals/models/approval.ts            (modify) + ResourceApprovalStatus
src/features/approvals/services.ts                   (modify) + getResourceApprovalStatus, acknowledgeRequest
src/features/approvals/hooks/use-resource-approval-status.ts   (create)
src/features/approvals/hooks/use-acknowledge.ts               (create)
src/features/listing-wizard/review-state.ts          (modify) helpers + resolveFooterSubmit param
src/features/listing-wizard/components/ReviewBanner.tsx        (modify) agent go-live + awaiting UI
src/features/listing-wizard/components/ListingWizard.tsx       (modify) wiring
```

---

### Task 1: Approvals resource-status + acknowledge data layer

**Files:**

- Modify: `src/features/approvals/models/approval.ts`
- Modify: `src/features/approvals/services.ts`
- Create: `src/features/approvals/hooks/use-resource-approval-status.ts`
- Create: `src/features/approvals/hooks/use-acknowledge.ts`

**Interfaces:**

- Consumes: `apiClient` (`@/lib/api`).
- Produces:
  - `ResourceApprovalStatus { hasPendingRequest: boolean; requestId: string | null; category: string | null; canDecide: boolean }`
  - `getResourceApprovalStatus(params: { resourceType: string; resourceId: string }): Promise<ResourceApprovalStatus>`
  - `acknowledgeRequest(params: { resourceType: string; resourceId: string; note?: string }): Promise<{ requestId: string } | null>`
  - `useResourceApprovalStatus(resourceType: string, resourceId: string, options?: { enabled?: boolean })` → TanStack query result of `ResourceApprovalStatus`
  - `useAcknowledge()` → TanStack mutation of `acknowledgeRequest`

- [ ] **Step 1: Add the model**

Append to `src/features/approvals/models/approval.ts`:

```ts
/** Pending-approval status of a source record — drives the wizard's awaiting-publish banner. */
export interface ResourceApprovalStatus {
  hasPendingRequest: boolean;
  requestId: string | null;
  /** WorkflowCategory of the pending request (e.g. 'listings_status'). */
  category: string | null;
  /** Whether THIS user may decide it (designated approver / super-admin). */
  canDecide: boolean;
}
```

- [ ] **Step 2: Add the services**

Append to `src/features/approvals/services.ts` (the file already imports `apiClient` and defines `ApproverOption`; add the import of the new type to the existing `import type { ... } from './models/approval';` block):

```ts
export async function getResourceApprovalStatus(params: {
  resourceType: string;
  resourceId: string;
}): Promise<ResourceApprovalStatus> {
  const { data } = await apiClient.get<Partial<ResourceApprovalStatus>>(
    '/api/v1/approvals/resource-status',
    { params: { resourceType: params.resourceType, resourceId: params.resourceId } },
  );
  return {
    hasPendingRequest: data?.hasPendingRequest ?? false,
    requestId: data?.requestId ?? null,
    category: data?.category ?? null,
    canDecide: data?.canDecide ?? false,
  };
}

export async function acknowledgeRequest(params: {
  resourceType: string;
  resourceId: string;
  note?: string;
}): Promise<{ requestId: string } | null> {
  const { data } = await apiClient.post<{ requestId: string } | null>(
    '/api/v1/approvals/acknowledge',
    params,
  );
  return data ?? null;
}
```

Add `ResourceApprovalStatus` to the existing `import type { … } from './models/approval';` in that file.

- [ ] **Step 3: Add the resource-status hook**

Create `src/features/approvals/hooks/use-resource-approval-status.ts`:

```ts
import { useQuery } from '@tanstack/react-query';

import { getResourceApprovalStatus } from '../services';

export function useResourceApprovalStatus(
  resourceType: string,
  resourceId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['approvals', 'resource-status', resourceType, resourceId],
    queryFn: () => getResourceApprovalStatus({ resourceType, resourceId }),
    enabled: resourceId !== '' && (options?.enabled ?? true),
    staleTime: 30_000,
  });
}
```

- [ ] **Step 4: Add the acknowledge hook**

Create `src/features/approvals/hooks/use-acknowledge.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { acknowledgeRequest } from '../services';

export function useAcknowledge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { resourceType: string; resourceId: string; note?: string }) =>
      acknowledgeRequest(params),
    onSuccess: (_data, { resourceType, resourceId }) => {
      queryClient
        .invalidateQueries({ queryKey: ['approvals', 'resource-status', resourceType, resourceId] })
        .catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['approvals'], exact: false }).catch(() => {});
    },
  });
}
```

- [ ] **Step 5: Typecheck** — `cd boh-mobile && npx tsc --noEmit` → clean.
- [ ] **Step 6: Lint** — `cd boh-mobile && pnpm lint` → clean.
- [ ] **Step 7: Commit**

```bash
cd boh-mobile
git add src/features/approvals/models/approval.ts src/features/approvals/services.ts src/features/approvals/hooks/use-resource-approval-status.ts src/features/approvals/hooks/use-acknowledge.ts
git commit -m "feat(approvals): resource-approval-status + acknowledge data layer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Review-state go-live helpers

**Files:**

- Modify: `src/features/listing-wizard/review-state.ts`

**Interfaces:**

- Consumes: existing `ReviewState`, `permitBadge`, `isContentLockedForReview`, `resolveFooterSubmit`, `FooterSubmitAction` in the same file.
- Produces:
  - `resourceTypeForBranch(branch: 'primary' | 'secondary'): 'listing' | 'opportunity_listing'`
  - `isAwaitingPublish(review: ReviewState | null, approvalStatus: { hasPendingRequest: boolean; category: string | null; canDecide: boolean } | null): boolean`
  - `canSubmitGoLive(review: ReviewState | null, awaitingPublish: boolean): boolean` — **visibility only, no permit check**
  - `isPermitValidForPublish(review: ReviewState | null): boolean`
  - `isEditingFrozen(review: ReviewState | null, awaitingPublish: boolean): boolean`
  - `resolveFooterSubmit(review: ReviewState | null, awaitingPublish?: boolean): FooterSubmitAction` — extended with an optional 2nd arg.

- [ ] **Step 1: Add the helpers**

Append to `src/features/listing-wizard/review-state.ts` (after `permitBadge`):

```ts
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

/** Form is frozen for the agent while under content review OR while a go-live is awaiting publish. */
export function isEditingFrozen(review: ReviewState | null, awaitingPublish: boolean): boolean {
  return isContentLockedForReview(review) || (awaitingPublish && !(review?.isReviewer ?? false));
}
```

- [ ] **Step 2: Extend `resolveFooterSubmit` with the awaiting flag**

Change the signature and add an early hidden branch. Replace the existing function header + first guard:

```ts
export function resolveFooterSubmit(
  review: ReviewState | null,
  awaitingPublish = false,
): FooterSubmitAction {
  if (awaitingPublish) {
    // A go-live is pending approval — no terminal footer action.
    return { isSubmit: false, label: 'Save & Finish', hidden: true };
  }
  if (!review || review.status === 'draft') {
    return { isSubmit: true, label: 'Submit for Review', hidden: false };
  }
```

Leave the rest of the function body unchanged.

- [ ] **Step 3: Typecheck** — `cd boh-mobile && npx tsc --noEmit` → clean. (The existing `resolveFooterSubmit(review)` call in `ListingWizard.tsx` still compiles — the new arg is optional.)
- [ ] **Step 4: Lint** — `cd boh-mobile && pnpm lint` → clean.
- [ ] **Step 5: Commit**

```bash
cd boh-mobile
git add src/features/listing-wizard/review-state.ts
git commit -m "feat(listing-wizard): go-live review-state helpers (awaiting/canSubmit/frozen)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: ReviewBanner — agent go-live + awaiting-publish UI

**Files:**

- Modify: `src/features/listing-wizard/components/ReviewBanner.tsx`

**Interfaces:**

- Consumes: existing `ReviewBanner` internals (`Button`, `Icon`, `Text`, `useThemeColor`, `normalizeRgb`).
- Produces: `ReviewBanner` gains these OPTIONAL props (existing call sites keep compiling):

  ```ts
  canSubmitGoLive?: boolean;
  submittingGoLive?: boolean;
  onSubmitGoLive?: () => void;
  awaitingPublish?: boolean;
  permitValid?: boolean;
  approvalRequestId?: string | null;
  onViewRequest?: () => void;
  canAcknowledge?: boolean;
  acknowledging?: boolean;
  onAcknowledge?: () => void;
  ```

- [ ] **Step 1: Add the `AgentPublishSection` component**

In `src/features/listing-wizard/components/ReviewBanner.tsx`, add this component above the exported `ReviewBanner`. `Rocket` is already imported via the `Icon` atom (used by name); no new imports needed.

```tsx
/** Agent go-live submit + awaiting-publish notice (with view-request + acknowledge). */
function AgentPublishSection({
  canSubmitGoLive,
  submittingGoLive,
  onSubmitGoLive,
  awaitingPublish,
  permitValid,
  approvalRequestId,
  onViewRequest,
  canAcknowledge,
  acknowledging,
  onAcknowledge,
  info,
  fg,
  primaryFg,
}: Readonly<{
  canSubmitGoLive: boolean;
  submittingGoLive: boolean;
  onSubmitGoLive?: () => void;
  awaitingPublish: boolean;
  permitValid: boolean;
  approvalRequestId: string | null;
  onViewRequest?: () => void;
  canAcknowledge: boolean;
  acknowledging: boolean;
  onAcknowledge?: () => void;
  info: string;
  fg: string;
  primaryFg: string;
}>) {
  if (!canSubmitGoLive && !awaitingPublish) return null;

  return (
    <View className="gap-2 border-t border-border pt-3">
      {canSubmitGoLive ? (
        <>
          <Button
            onPress={onSubmitGoLive}
            loading={submittingGoLive}
            disabled={!permitValid || submittingGoLive}
            accessibilityLabel="Submit listing for publish approval"
          >
            <Icon name="Rocket" size={18} color={primaryFg} />
            <Text>Submit for Approval</Text>
          </Button>
          {!permitValid ? (
            <Text className="text-xs text-muted-foreground">
              An approved Trakheesi permit is required to publish.
            </Text>
          ) : null}
        </>
      ) : null}

      {awaitingPublish ? (
        <View className="gap-2 rounded-xl bg-info/15 p-3 dark:bg-info/20">
          <View className="flex-row gap-2">
            <Icon name="Clock" size={18} color={info} />
            <Text className="flex-1 text-sm text-foreground">
              Submitted for publish — awaiting an approver’s decision.
            </Text>
          </View>
          {approvalRequestId && onViewRequest ? (
            <Button
              variant="outline"
              onPress={onViewRequest}
              accessibilityLabel="View the approval request"
            >
              <Icon name="ExternalLink" size={18} color={fg} />
              <Text>View Request</Text>
            </Button>
          ) : null}
          {canAcknowledge && onAcknowledge ? (
            <Button
              variant="outline"
              onPress={onAcknowledge}
              loading={acknowledging}
              accessibilityLabel="Acknowledge this request"
            >
              <Icon name="Check" size={18} color={fg} />
              <Text>Acknowledge</Text>
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2: Add the new props to `ReviewBanner`**

Extend the `ReviewBanner` prop type (append these to the existing `Readonly<{ … }>`), defaulting them in the destructure:

```tsx
  canSubmitGoLive = false,
  submittingGoLive = false,
  onSubmitGoLive,
  awaitingPublish = false,
  permitValid = false,
  approvalRequestId = null,
  onViewRequest,
  canAcknowledge = false,
  acknowledging = false,
  onAcknowledge,
```

with the type additions:

```tsx
  canSubmitGoLive?: boolean;
  submittingGoLive?: boolean;
  onSubmitGoLive?: () => void;
  awaitingPublish?: boolean;
  permitValid?: boolean;
  approvalRequestId?: string | null;
  onViewRequest?: () => void;
  canAcknowledge?: boolean;
  acknowledging?: boolean;
  onAcknowledge?: () => void;
```

- [ ] **Step 3: Render `AgentPublishSection` in the expanded body**

Inside the `{expanded ? ( … ) : null}` block, immediately AFTER the existing `<ReviewActions … />`, add:

```tsx
<AgentPublishSection
  canSubmitGoLive={canSubmitGoLive}
  submittingGoLive={submittingGoLive}
  onSubmitGoLive={onSubmitGoLive}
  awaitingPublish={awaitingPublish}
  permitValid={permitValid}
  approvalRequestId={approvalRequestId}
  onViewRequest={onViewRequest}
  canAcknowledge={canAcknowledge}
  acknowledging={acknowledging}
  onAcknowledge={onAcknowledge}
  info={info}
  fg={fg}
  primaryFg={primaryFg}
/>
```

(`info`, `fg`, `primaryFg` are already computed at the top of `ReviewBanner` via `normalizeRgb(useThemeColor(...))`.)

- [ ] **Step 4: Typecheck** — `cd boh-mobile && npx tsc --noEmit` → clean. If `Icon name="ExternalLink"` fails the `IconName` type, substitute a valid lucide key (e.g. `"SquareArrowOutUpRight"`); confirm against `lucide-react-native/icons`.
- [ ] **Step 5: Lint** — `cd boh-mobile && pnpm lint` → clean.
- [ ] **Step 6: Commit**

```bash
cd boh-mobile
git add src/features/listing-wizard/components/ReviewBanner.tsx
git commit -m "feat(listing-wizard): ReviewBanner agent go-live + awaiting-publish UI

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Wizard wiring

**Files:**

- Modify: `src/features/listing-wizard/components/ListingWizard.tsx`

**Interfaces:**

- Consumes: Task 1 (`useResourceApprovalStatus`, `useAcknowledge`), Task 2 (`resourceTypeForBranch`, `isAwaitingPublish`, `canSubmitGoLive`, `isPermitValidForPublish`, `isEditingFrozen`, and the extended `resolveFooterSubmit`), Task 3 (the new `ReviewBanner` props). Existing `useReviewMutations().setPublished`, `router`, `showToast`.

- [ ] **Step 1: Add imports**

In `ListingWizard.tsx`, add to the review-state import block (the one already importing `resolveFooterSubmit`, `isContentLockedForReview`, `nextSubmitStatus`, `type ReviewState`):

```ts
  canSubmitGoLive,
  isAwaitingPublish,
  isEditingFrozen,
  isPermitValidForPublish,
  resourceTypeForBranch,
```

Add new imports near the other feature imports:

```ts
import { useResourceApprovalStatus } from '@/features/approvals/hooks/use-resource-approval-status';
import { useAcknowledge } from '@/features/approvals/hooks/use-acknowledge';
```

- [ ] **Step 2: Compute resource-status + derived flags**

Immediately AFTER the existing `const reviewMutations = useReviewMutations(created);` line, add:

```ts
const branch = created?.branch ?? null;
const resourceType = branch ? resourceTypeForBranch(branch) : 'opportunity_listing';
const resourceId = created?.listingId ?? '';
const { data: approvalStatus } = useResourceApprovalStatus(resourceType, resourceId, {
  enabled: isEdit && resourceId !== '',
});
const acknowledgeMutation = useAcknowledge();

const awaitingPublish = isAwaitingPublish(review, approvalStatus ?? null);
const frozen = isEditingFrozen(review, awaitingPublish);
const showGoLive = canSubmitGoLive(review, awaitingPublish);
const permitValid = isPermitValidForPublish(review);
const canAcknowledge =
  !!approvalStatus?.hasPendingRequest && !!review?.isReviewer && !approvalStatus.canDecide;
```

Then change the footer-submit line to pass the flag:

```ts
const footerSubmit = resolveFooterSubmit(review, awaitingPublish);
```

- [ ] **Step 3: Add the go-live / view-request / acknowledge handlers**

Add these near the existing `handleSetPublished`:

```ts
const handleSubmitGoLive = () => {
  if (!permitValid) {
    showToast('error', 'An approved Trakheesi permit is required to publish.');
    return;
  }
  reviewMutations.setPublished.mutate(
    { isPublished: true },
    {
      onSuccess: () => showToast('success', 'Submitted for approval'),
      onError: (error) => showToast('error', error.message || 'Could not submit for approval.'),
    },
  );
};

const handleViewRequest = () => {
  const id = approvalStatus?.requestId;
  if (!id) return;
  router.push({
    pathname: '/(app)/approvals/[queue]/[id]',
    params: { queue: 'listings-status', id },
  });
};

const handleAcknowledge = () => {
  if (resourceId === '') return;
  acknowledgeMutation.mutate(
    { resourceType, resourceId },
    {
      onSuccess: () => showToast('success', 'Acknowledged'),
      onError: (error) => showToast('error', error.message || 'Could not acknowledge.'),
    },
  );
};
```

- [ ] **Step 4: Swap the form lock from `locked` to `frozen`**

Find the form-wrapper `View` that disables the body:

```tsx
      <View
        className="flex-1"
        pointerEvents={locked ? 'none' : 'auto'}
        style={locked ? { opacity: 0.55 } : undefined}
      >
```

Change both `locked` references to `frozen`:

```tsx
      <View
        className="flex-1"
        pointerEvents={frozen ? 'none' : 'auto'}
        style={frozen ? { opacity: 0.55 } : undefined}
      >
```

(Keep the `locked` prop passed to `<ReviewBanner locked={locked} … />` as-is — it drives the content-review "editing locked" notice; the awaiting-publish notice is separate.)

- [ ] **Step 5: Pass the new props to `ReviewBanner`**

Extend the existing `<ReviewBanner … />` render with:

```tsx
          canSubmitGoLive={showGoLive}
          submittingGoLive={reviewMutations.setPublished.isPending}
          onSubmitGoLive={handleSubmitGoLive}
          awaitingPublish={awaitingPublish}
          permitValid={permitValid}
          approvalRequestId={approvalStatus?.requestId ?? null}
          onViewRequest={handleViewRequest}
          canAcknowledge={canAcknowledge}
          acknowledging={acknowledgeMutation.isPending}
          onAcknowledge={handleAcknowledge}
```

- [ ] **Step 6: Typecheck** — `cd boh-mobile && npx tsc --noEmit` → clean.
- [ ] **Step 7: Lint** — `cd boh-mobile && pnpm lint` → clean.
- [ ] **Step 8: Manual QA**

Sign in as an **agent** (non-reviewer) and open a listing whose content is **approved** in the wizard (edit mode):

1. The ReviewBanner shows **Submit for Approval**. With an invalid/missing Trakheesi permit it's disabled with the hint; with a valid permit it's enabled.
2. Tap it → toast "Submitted for approval"; after the hydration refetch the banner flips to the **awaiting-publish** notice and the form greys out / stops accepting input (frozen). The footer's terminal action is hidden.
3. When a `listings_status` request exists, **View Request** opens `/(app)/approvals/listings-status/<id>`.
4. As a **line-manager reviewer who is NOT the designated approver** (hasPendingRequest, isReviewer, !canDecide), **Acknowledge** appears and records (toast "Acknowledged").
5. Approving the request from the Approvals inbox clears the awaiting state on the next wizard load. A **reviewer** still sees the existing Approve / Request Changes / Publish actions (unchanged).

- [ ] **Step 9: Commit**

```bash
cd boh-mobile
git add src/features/listing-wizard/components/ListingWizard.tsx
git commit -m "feat(listing-wizard): wire agent go-live, awaiting-publish and acknowledge

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**

- Resource-status + acknowledge services + hooks → Task 1. ✅
- `ResourceApprovalStatus` model → Task 1. ✅
- `resourceTypeForBranch` / `isAwaitingPublish` / `canSubmitGoLive` / `isEditingFrozen` / `resolveFooterSubmit` param → Task 2. ✅ (`canSubmitGoLive` split from permit per the documented refinement; `isPermitValidForPublish` added.)
- ReviewBanner agent go-live button + awaiting notice + view-request + acknowledge → Task 3. ✅
- Wizard wiring (resource-status query, awaitingPublish, frozen lock, handlers, footer, banner props) → Task 4. ✅
- Reuse publish endpoint via `setPublished({ isPublished: true })` → Task 4 `handleSubmitGoLive`. ✅
- Permit guard → Task 4 (`permitValid` + guard in handler) + Task 3 (disabled+hint). ✅

**Out-of-scope confirmed omitted:** listings_update go-live, super-admin bypass, content-review changes. ✅

**Placeholder scan:** No TBD/TODO; every code step ships complete code. ✅

**Type consistency:** `useResourceApprovalStatus(resourceType, resourceId, {enabled})` and `useAcknowledge()` (Task 1) are consumed with those exact shapes in Task 4. `ResourceApprovalStatus` fields (`hasPendingRequest`/`requestId`/`category`/`canDecide`) are used consistently in Task 2's `isAwaitingPublish`, Task 4's `canAcknowledge`, and the banner's `approvalRequestId`. ReviewBanner's new prop names (Task 3) match exactly what Task 4 passes. `resolveFooterSubmit(review, awaitingPublish)` matches Task 2's extended signature. ✅

**Flagged for the implementer:** the `Icon name="ExternalLink"` fallback (Task 3 Step 4) if the lucide key differs.
