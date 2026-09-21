# Mobile Listings Update (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the Listings Update approvals queue (approver side) and let an agent submit a content update on a Published listing that routes through the `listings_update` workflow, with an awaiting-update banner — full web parity.

**Architecture:** One-line catalogue flip enables the approver queue (card/detail already render the update diff). The agent side adds two pure `review-state.ts` helpers, an `AgentUpdateSection` in `ReviewBanner.tsx`, and wiring in `ListingWizard.tsx` — reusing the `useResourceApprovalStatus` / `useAcknowledge` layer and the `submitForReview` mutation already present from Phase 2 (go-live).

**Tech Stack:** React Native 0.81, Expo SDK 54, Expo Router, NativeWind v4, TanStack Query v5, axios (`apiClient`), `lucide-react-native`.

## Global Constraints

- **No test runner** (repo policy). Verify every task with `npx tsc --noEmit` (clean) + `pnpm lint` (clean) from repo root + the task's manual-QA note. No `*.test.*` files.
- **Styling:** NativeWind semantic tokens only (`bg-info/15`, `text-info`, `text-foreground`, `text-muted-foreground`, `border-border`…). No hard-coded hex. Colors that need a value come from `useThemeColor('--token')` (wrapped in `normalizeRgb`, as the banner already does).
- **Prop types:** `Readonly<{...}>`. Strict TS. Merge classes with `cn()`.
- **Query invalidation:** repo's fire-and-forget pattern (`qc.invalidateQueries(...).catch(() => {})`).
- **No new runtime dependencies.**
- **Commits:** end message body with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## File Structure

```
src/features/approvals/constants/queues.ts              (modify) flip listings-update deferred:false
src/features/listing-wizard/review-state.ts             (modify) + isAwaitingUpdate, canSubmitUpdate; rename awaiting param
src/features/listing-wizard/components/ReviewBanner.tsx  (modify) + AgentUpdateSection + props
src/features/listing-wizard/components/ListingWizard.tsx (modify) wiring
```

---

### Task 1: Enable the Listings Update approver queue

**Files:**

- Modify: `src/features/approvals/constants/queues.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: the `listings-update` catalogue entry with `deferred: false`.

- [ ] **Step 1: Flip the flag**

In `src/features/approvals/constants/queues.ts`, find the `listings-update` entry:

```ts
  {
    slug: 'listings-update',
    label: 'Listings Update',
    title: 'Listings Update Approvals',
    subtitle: 'Listing field changes awaiting approval before they go live.',
    variant: 'listing',
    deferred: true,
  },
```

Change `deferred: true` to `deferred: false`.

- [ ] **Step 2: Typecheck** — `cd boh-mobile && npx tsc --noEmit` → clean.
- [ ] **Step 3: Lint** — `cd boh-mobile && pnpm lint` → clean.
- [ ] **Step 4: Manual QA**

Open the app with an `approvals:act` account → More → Approvals. The **Listings Update** hub card is now tappable (not "Coming soon"). Tapping it opens the queue: request cards show the changed-field diff ("Changed fields" before → after); opening a request's **Audit** shows the diff + history + approval chain; Approve / Request changes work.

- [ ] **Step 5: Commit**

```bash
cd boh-mobile
git add src/features/approvals/constants/queues.ts
git commit -m "feat(approvals): enable Listings Update approver queue

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Review-state update helpers

**Files:**

- Modify: `src/features/listing-wizard/review-state.ts`

**Interfaces:**

- Consumes: existing `ReviewState`, `isContentLockedForReview`, `FooterSubmitAction`.
- Produces:
  - `isAwaitingUpdate(review: ReviewState | null, approvalStatus: { hasPendingRequest: boolean; category: string | null; canDecide: boolean } | null): boolean`
  - `canSubmitUpdate(review: ReviewState | null, awaitingUpdate: boolean): boolean`
  - `isEditingFrozen(review, awaiting)` and `resolveFooterSubmit(review, awaiting = false)` — the 2nd param renamed `awaiting` (semantics: publish OR update pending). Bodies unchanged apart from the rename.

- [ ] **Step 1: Add the two helpers**

In `src/features/listing-wizard/review-state.ts`, add after the existing `canSubmitGoLive` function:

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

- [ ] **Step 2: Rename the `awaitingPublish` param to `awaiting` on the two shared helpers**

Find `isEditingFrozen`:

```ts
export function isEditingFrozen(review: ReviewState | null, awaitingPublish: boolean): boolean {
  return isContentLockedForReview(review) || (awaitingPublish && !(review?.isReviewer ?? false));
}
```

Replace with:

```ts
/** Form is frozen for the agent while under content review OR while a go-live/update is pending. */
export function isEditingFrozen(review: ReviewState | null, awaiting: boolean): boolean {
  return isContentLockedForReview(review) || (awaiting && !(review?.isReviewer ?? false));
}
```

Find `resolveFooterSubmit`'s header + first branch:

```ts
export function resolveFooterSubmit(
  review: ReviewState | null,
  awaitingPublish = false,
): FooterSubmitAction {
  if (awaitingPublish) {
```

Replace the param name and the guard reference:

```ts
export function resolveFooterSubmit(
  review: ReviewState | null,
  awaiting = false,
): FooterSubmitAction {
  if (awaiting) {
```

Leave the rest of both function bodies unchanged. (These are positional args — the existing single caller in `ListingWizard.tsx` still compiles; Task 4 updates what it passes.)

- [ ] **Step 3: Typecheck** — `cd boh-mobile && npx tsc --noEmit` → clean.
- [ ] **Step 4: Lint** — `cd boh-mobile && pnpm lint` → clean.
- [ ] **Step 5: Commit**

```bash
cd boh-mobile
git add src/features/listing-wizard/review-state.ts
git commit -m "feat(listing-wizard): update review-state helpers (isAwaitingUpdate/canSubmitUpdate)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: ReviewBanner — AgentUpdateSection

**Files:**

- Modify: `src/features/listing-wizard/components/ReviewBanner.tsx`

**Interfaces:**

- Consumes: existing `AgentPublishSection`, `Button`, `Icon`, `Text`, and the banner's `info`/`fg`/`primaryFg` theme values.
- Produces: `ReviewBanner` gains these OPTIONAL props (existing call sites keep compiling):

  ```ts
  canSubmitUpdate?: boolean;
  submittingUpdate?: boolean;
  onSubmitUpdate?: () => void;
  awaitingUpdate?: boolean;
  ```

  and reuses the already-present `approvalRequestId` / `onViewRequest` / `canAcknowledge` / `acknowledging` / `onAcknowledge`.

- [ ] **Step 1: Add the `AgentUpdateSection` component**

In `src/features/listing-wizard/components/ReviewBanner.tsx`, add this component immediately after the existing `AgentPublishSection` function. It mirrors `AgentPublishSection`'s structure. `Send` is a valid `lucide-react-native/icons` key.

```tsx
/** Agent content-update submit + awaiting-update notice (with view-request + acknowledge). */
function AgentUpdateSection({
  canSubmitUpdate,
  submittingUpdate,
  onSubmitUpdate,
  awaitingUpdate,
  approvalRequestId,
  onViewRequest,
  canAcknowledge,
  acknowledging,
  onAcknowledge,
  info,
  fg,
  primaryFg,
}: Readonly<{
  canSubmitUpdate: boolean;
  submittingUpdate: boolean;
  onSubmitUpdate?: () => void;
  awaitingUpdate: boolean;
  approvalRequestId: string | null;
  onViewRequest?: () => void;
  canAcknowledge: boolean;
  acknowledging: boolean;
  onAcknowledge?: () => void;
  info: string;
  fg: string;
  primaryFg: string;
}>) {
  if (!canSubmitUpdate && !awaitingUpdate) return null;

  return (
    <View className="gap-2 border-t border-border pt-3">
      {canSubmitUpdate ? (
        <Button
          onPress={onSubmitUpdate}
          loading={submittingUpdate}
          disabled={submittingUpdate}
          accessibilityLabel="Submit content update for review"
        >
          <Icon name="Send" size={18} color={primaryFg} />
          <Text>Submit Update for Review</Text>
        </Button>
      ) : null}

      {awaitingUpdate ? (
        <View className="gap-2 rounded-xl bg-info/15 p-3 dark:bg-info/20">
          <View className="flex-row gap-2">
            <Icon name="Clock" size={18} color={info} />
            <Text className="flex-1 text-sm text-foreground">
              Your content update is awaiting review — the listing stays published until the
              reviewer approves the update.
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

Append these to the `ReviewBanner` `Readonly<{ … }>` prop type (next to the existing `canSubmitGoLive` etc.):

```tsx
  canSubmitUpdate?: boolean;
  submittingUpdate?: boolean;
  onSubmitUpdate?: () => void;
  awaitingUpdate?: boolean;
```

And add these to the destructure with defaults (next to the existing `canSubmitGoLive = false,` block):

```tsx
  canSubmitUpdate = false,
  submittingUpdate = false,
  onSubmitUpdate,
  awaitingUpdate = false,
```

- [ ] **Step 3: Render `AgentUpdateSection` after `AgentPublishSection`**

Immediately AFTER the existing `<AgentPublishSection … />` render in the expanded block, add:

```tsx
<AgentUpdateSection
  canSubmitUpdate={canSubmitUpdate}
  submittingUpdate={submittingUpdate}
  onSubmitUpdate={onSubmitUpdate}
  awaitingUpdate={awaitingUpdate}
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

(`approvalRequestId`, `onViewRequest`, `canAcknowledge`, `acknowledging`, `onAcknowledge`, `info`, `fg`, `primaryFg` are already in scope — they feed `AgentPublishSection` too.)

- [ ] **Step 4: Typecheck** — `cd boh-mobile && npx tsc --noEmit` → clean. If `Icon name="Send"` fails the `IconName` type, substitute a valid lucide key (e.g. `"Upload"`); confirm against `lucide-react-native/icons`.
- [ ] **Step 5: Lint** — `cd boh-mobile && pnpm lint` → clean.
- [ ] **Step 6: Commit**

```bash
cd boh-mobile
git add src/features/listing-wizard/components/ReviewBanner.tsx
git commit -m "feat(listing-wizard): ReviewBanner agent submit-update + awaiting-update UI

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Wizard wiring

**Files:**

- Modify: `src/features/listing-wizard/components/ListingWizard.tsx`

**Interfaces:**

- Consumes: Task 2 (`isAwaitingUpdate`, `canSubmitUpdate`), Task 3 (the 4 new `ReviewBanner` props). Existing `reviewMutations.submitForReview`, `nextSubmitStatus`, `queryClient`, `showToast`, and the already-computed `awaitingPublish`/`approvalStatus`/`resourceType`/`resourceId`/`canAcknowledge`.

- [ ] **Step 1: Add the two imports**

In the review-state import block (the one already importing `canSubmitGoLive`, `isAwaitingPublish`, `isEditingFrozen`, `isPermitValidForPublish`, `nextSubmitStatus`, `resolveFooterSubmit`, `resourceTypeForBranch`), add:

```ts
  canSubmitUpdate,
  isAwaitingUpdate,
```

- [ ] **Step 2: Compute the update flags + combine the awaiting flag**

The current block reads:

```ts
const awaitingPublish = isAwaitingPublish(review, approvalStatus ?? null);
const frozen = isEditingFrozen(review, awaitingPublish);
const showGoLive = canSubmitGoLive(review, awaitingPublish);
const permitValid = isPermitValidForPublish(review);
const canAcknowledge =
  !!approvalStatus?.hasPendingRequest && !!review?.isReviewer && !approvalStatus.canDecide;
```

Replace those lines with (adds `awaitingUpdate` + `showSubmitUpdate`, and combines the awaiting flag into `frozen`):

```ts
const awaitingPublish = isAwaitingPublish(review, approvalStatus ?? null);
const awaitingUpdate = isAwaitingUpdate(review, approvalStatus ?? null);
const awaiting = awaitingPublish || awaitingUpdate;
const frozen = isEditingFrozen(review, awaiting);
const showGoLive = canSubmitGoLive(review, awaitingPublish);
const showSubmitUpdate = canSubmitUpdate(review, awaitingUpdate);
const permitValid = isPermitValidForPublish(review);
const canAcknowledge =
  !!approvalStatus?.hasPendingRequest && !!review?.isReviewer && !approvalStatus.canDecide;
```

And change the `footerSubmit` line from `resolveFooterSubmit(review, awaitingPublish)` to:

```ts
const footerSubmit = resolveFooterSubmit(review, awaiting);
```

- [ ] **Step 3: Add the `handleSubmitUpdate` handler**

Add near the existing `handleSubmitGoLive` (which already uses `queryClient`, `resourceType`, `resourceId`, `showToast`):

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

- [ ] **Step 4: Pass the new props to `<ReviewBanner />`**

Add to the existing `<ReviewBanner … />` render (next to the `canSubmitGoLive={showGoLive}` block):

```tsx
          canSubmitUpdate={showSubmitUpdate}
          submittingUpdate={reviewMutations.submitForReview.isPending}
          onSubmitUpdate={handleSubmitUpdate}
          awaitingUpdate={awaitingUpdate && !review?.isReviewer}
```

- [ ] **Step 5: Typecheck** — `cd boh-mobile && npx tsc --noEmit` → clean.
- [ ] **Step 6: Lint** — `cd boh-mobile && pnpm lint` → clean.
- [ ] **Step 7: Manual QA**

Sign in as an **agent** and open a **Published** listing in the wizard (edit mode):

1. The ReviewBanner shows **Submit Update for Review** (badge shows **Published**). Reviewer actions are not shown to the agent.
2. Edit a field, save the step, then tap **Submit Update for Review** → toast "Update submitted for review". After the refetch the badge stays **Published**, the banner flips to the **awaiting-update** notice, and the form greys out (frozen). The footer terminal action is hidden.
3. When a `listings_update` request exists, **View Request** opens `/(app)/approvals/listings-update/<id>`.
4. As a **line-manager reviewer** who is not the designated approver, **Acknowledge** appears and records.
5. A **reviewer** sees no agent submit/awaiting UI (existing reviewer actions unchanged); approving the request from the Approvals inbox clears the awaiting state on next load.

- [ ] **Step 8: Commit**

```bash
cd boh-mobile
git add src/features/listing-wizard/components/ListingWizard.tsx
git commit -m "feat(listing-wizard): wire agent submit-update + awaiting-update banner

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**

- Approver-side queue enable (flip `deferred:false`) → Task 1. ✅
- `isAwaitingUpdate` / `canSubmitUpdate` + `isEditingFrozen`/`resolveFooterSubmit` param generalization → Task 2. ✅
- ReviewBanner `AgentUpdateSection` (submit-update button + awaiting notice + view-request + acknowledge) → Task 3. ✅
- Wizard wiring (awaitingUpdate/showSubmitUpdate, combined `frozen`+`footerSubmit`, `handleSubmitUpdate` reusing `submitForReview` + resource-status invalidation, banner props, reviewer suppression via `&& !review?.isReviewer`) → Task 4. ✅
- Reuse of resource-status/acknowledge layer + `submitForReview` mutation → Task 4 (no new services). ✅

**Out-of-scope confirmed omitted:** go-live (Phase 2), content-review phase changes, super-admin bypass. ✅

**Placeholder scan:** No TBD/TODO; every code step ships complete code. ✅

**Type consistency:** `isAwaitingUpdate(review, approvalStatus)` and `canSubmitUpdate(review, awaitingUpdate)` (Task 2) are consumed with those exact shapes in Task 4. The 4 new `ReviewBanner` props (Task 3) match exactly what Task 4 passes. `isEditingFrozen`/`resolveFooterSubmit` renamed param is positional — the Task 4 caller passes `awaiting`. `handleSubmitUpdate` uses `reviewMutations.submitForReview` + `nextSubmitStatus(review)`, both already imported/available. ✅

**Flagged for the implementer:** the `Icon name="Send"` fallback (Task 3 Step 4) if the lucide key differs.
