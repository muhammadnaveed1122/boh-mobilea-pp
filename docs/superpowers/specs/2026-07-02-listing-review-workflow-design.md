# Mobile Listing Review Workflow — Design

Date: 2026-07-02
Repo: `boh-mobile`

## Goal

Bring the mobile listing wizard to parity with the web wizard's **review workflow**. Mobile
today is a pure create/edit data-entry flow; it has no status badge, no review banner, no
submit-for-review / approve / request-changes actions, no activity history, and no
role-or-status-driven form locking. All backend routes and fields already exist — mobile is
just blind to them.

## Scope (decided)

- **Include:** core review workflow — submit-for-review, approve, request-changes (+notes),
  publish/unpublish, form lock, status badge, review banner, activity history.
- **Both** primary (`/listing-cms`) and secondary (`/opportunity-listing`) kinds.
- **Activity UI:** bottom-sheet (clock icon in header opens a slide-up sheet).
- **Deferred to phase 2:** workflow-governed Approvals subsystem (`resource-approval-status`,
  `isAwaitingPublish` / `isAwaitingUpdateReview`, "Go to Approvals" routing). That subsystem
  does not exist on mobile yet.

## Backend contract (confirmed, no backend changes needed)

Status enum (both `ListingStatus` + `OpportunityListingStatus`):
`draft | in_review | re_review | changes_requested | approved | active | inactive | archived`.
Publish-override subset (each requires `isPublished:false`):
`in_review | re_review | approved | changes_requested`.

| Action                                                       | Route                                           | Body                                                  |
| ------------------------------------------------------------ | ----------------------------------------------- | ----------------------------------------------------- |
| Submit / approve / request-changes / (un)publish (secondary) | `PATCH /api/v1/opportunity-listing/:id/publish` | `{ isPublished, status?, changeNotes?, agentNotes? }` |
| Submit / approve / request-changes / (un)publish (primary)   | `PATCH /api/v1/listing-cms/:id/publish`         | same                                                  |
| History (secondary)                                          | `GET /api/v1/opportunity-listing/:id/history`   | —                                                     |
| History (primary)                                            | `GET /api/v1/listing-cms/:id/history`           | —                                                     |

GET-single responses already return `status`, `isReviewer`, `isPublished`, `changeNotes`,
`contentApprovedAt`, `pendingPublishAt`, `pendingUpdateAt`, `submittedAt`. `isReviewer` is
server-computed (all-access, or publish-permission + creator/team-manager/ops-manager).

Action → body mapping:

- Submit for review: `status = (current==='changes_requested' ? 're_review' : 'in_review')`, `isPublished:false`.
- Approve content: `status:'approved'`, `isPublished:false`.
- Request changes: `status:'changes_requested'`, `isPublished:false`, `changeNotes`.
- Publish: `isPublished:true` (no status). Unpublish: `isPublished:false`.

## Client architecture

### Data layer (Phase A)

- Extend `SecondaryListingRaw` / `PrimaryListingRaw` (`services.ts`) with the review fields
  (`status`, `isReviewer`, `isPublished`, `changeNotes`, `contentApprovedAt`,
  `pendingPublishAt`, `pendingUpdateAt`, `submittedAt`).
- New `ReviewState` type derived in hydration → added to `EditHydration.review`.
- New services: `publishOpportunityListing`, `publishListingCms`, `getOpportunityListingHistory`,
  `getListingCmsHistory`. History returns a normalized `ReviewHistoryEntry[]`.
- New mutation hook `use-review-mutations.ts`: `useSubmitForReview`, `useApproveListing`,
  `useRequestChanges`, `useSetPublished` — each PATCHes the right endpoint per branch and
  invalidates `['listing-edit', branch, id]`. New `useListingHistory(created)` query hook.

### Review-state derivation (Phase B)

Pure helper `review-state.ts`:

```
isContentLockedForReview(review) =
  (review.status === 'in_review' || review.status === 're_review') && !review.isReviewer
```

(Awaiting-publish/update omitted — phase 2.) Super-admin is covered because backend sets
`isReviewer:true` for all-access, so the `!isReviewer` clause is false → never locked. Agent:
locked once `in_review`/`re_review`; unlocked when manager sets `changes_requested`.

Footer action model per (role, status): see `footer-action.ts` helper returning
`{ label, mode, hidden }`. Agents on the last step get **Submit for Review** /
**Submit Re-Review**. Reviewers act via the banner, not the footer.

### UI (Phase C–E) — mobile-native, not a web port

- **Header:** add status `Badge` (reuse `STATUS_LABEL` + `STATUS_BADGE_VARIANT` from
  `features/listings/types.ts`) + a clock `Icon` button that opens the Activity sheet. Only in
  edit mode with a known status.
- **ReviewBanner** (new component under `listing-wizard/components/`): colored card under the
  stepper. Shows status title, change-notes callout (when `changes_requested`), an
  "editing restricted while under review" notice when locked, and reviewer action buttons
  (Approve / Request Changes / Publish / Unpublish) gated by `isReviewer` + status.
- **Lock overlay:** wrap the step body in a `View` with `pointerEvents={locked?'none':'auto'}`
  - reduced opacity. RN has no `<fieldset disabled>`. Footer save/submit hidden when locked.
- **RequestChangesSheet** (RN `Modal` slide, matches `MoveStageSheet` pattern): textarea for
  notes → `useRequestChanges`.
- **ActivitySheet** (same Modal pattern): timeline list from `useListingHistory`.

## Files

New:

- `src/features/listing-wizard/review-state.ts`
- `src/features/listing-wizard/hooks/use-review-mutations.ts`
- `src/features/listing-wizard/hooks/use-listing-history.ts`
- `src/features/listing-wizard/components/ReviewBanner.tsx`
- `src/features/listing-wizard/components/RequestChangesSheet.tsx`
- `src/features/listing-wizard/components/ActivitySheet.tsx`

Changed:

- `services.ts` (raw types + publish/history services + history/review types)
- `use-listing-edit-hydration.ts` (derive + expose `review`)
- `ListingWizard.tsx` (header badge + clock, banner, lock overlay, footer submit wiring, sheets)
- `WizardFooter.tsx` (support a `submit` variant / hide when locked)

## Verification

No test runner (per repo policy). Verify via `pnpm exec tsc --noEmit` + `pnpm lint` + manual QA
per role (super-admin always editable; agent locked after submit; reviewer approve/request-changes).

```

```
