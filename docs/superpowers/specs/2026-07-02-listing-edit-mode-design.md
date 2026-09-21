# Listing edit mode — both branches (reuse create wizard)

**Date:** 2026-07-02
**Repo:** boh-mobile (single repo, no backend changes)
**Branch:** `feat/listing-edit` off `master`

## Summary

Make listings editable by **reusing the create wizard** in an edit mode. Rename
`CreateListingWizard` → `ListingWizard` and add `editListingId` + `editKind`.
Create path unchanged. Steps 1-3 are already idempotent upserts keyed by the
existing ids — reused as-is once the ids are pre-seeded. Only the Information
step (step 0) needs update-instead-of-create logic. No backend changes.

Both branches (primary/project + secondary/opportunity). Simple save & finish —
no publish/review-mode gating (matches current mobile create).

## Entry

- Wire the detail page's Edit pencil (currently a no-op) → `router.push` to
  `/listings/edit/[id]?kind=…`.
- New route `app/(app)/listings/edit/[id].tsx`, gated on `LISTINGS_UPDATE`
  (primary) / `OPPORTUNITY_LISTING_UPDATE` (secondary) → `<ListingWizard
editListingId={id} editKind={kind} />`.

## Prefill (chained fetch → inverse mappers)

New `hooks/use-listing-edit-hydration.ts` fetches once and returns seeded values:

- **Secondary:** `getListingById(id)` + `getOpportunityDetail(opportunityId)` +
  `getLeadDetail(leadId)` (all exist) + permit (embedded in detail).
- **Primary:** `getPrimaryListingDetail(id)` (full CMS) + permit (embedded).
- New `mappers.edit.ts` (inverse, server → form):
  - `detail/opportunity/lead → InformationValues` (per branch).
  - `→ DescriptionValues` (title/description).
  - `→ WizardContentInput` (hero/about media via `mapServerMedia`, video/360,
    selectedAmenityIds).
  - `→ WizardPublish` (PF config + permit) and `→ WizardWebsiteContent`.
- Seed forms with `form.reset(values)`; set the wizard's local state objects.
  Loading gate until hydrated.

## Edit saves (step 0 only new)

Pre-seed `created = { branch, listingId, opportunityId?, leadId? }`.

- **Secondary step 0:** `updateOpportunity` (PATCH `/opportunities/:id`, **new**,
  body from `buildOpportunityBody`) + `updateLead` (PATCH `/leads/:id`, exists in
  leads feature, body from `buildLeadBody`) + `persistOpportunityWizardState`
  (purpose/PF, exists).
- **Primary step 0:** `persistPrimaryWizardState` **extended** to send the
  property/pricing detail body (PATCH `/listings/:id/wizard-state`) +
  `updatePrimaryListing` (PATCH `/listings/:id`, **new**, purpose/availability).
- Steps 1-3: existing upsert hooks (`use-save-content/media/amenities/portals`),
  unchanged — they already accept an existing `listingId`.

## Edit UX

- `WizardStepper` gains optional `onStepPress` — edit mode makes all 4 steps
  jumpable; create stays linear (gated by completed steps).
- Immutable-in-edit fields disabled: primary developer/project/unitType selectors;
  secondary owner new/existing toggle (edits the linked lead).
- Header "Edit Listing"; finish = save current step data then return.

## New / changed files

New: `app/(app)/listings/edit/[id].tsx`, `hooks/use-listing-edit-hydration.ts`,
`mappers.edit.ts`, services `updateOpportunity` + `updatePrimaryListing`.
Changed: `CreateListingWizard.tsx` → `ListingWizard.tsx` (edit branch, pre-seed,
hydration, update-vs-create on step 0), `WizardStepper.tsx` (onStepPress),
`persistPrimaryWizardState` (accept details), `create.tsx` import,
`ListingDetailScreen`/`ImageCarousel` (wire real onEdit).

## Out of scope

- Publish/review-mode parity + go-live permit gating.
- No backend changes.
- Reassigning immutable links (primary dev/project/unitType, secondary owner).

## Verify

`tsc --noEmit` + eslint. Manual QA: edit a secondary rent + sale listing and a
primary listing end-to-end — prefill correct across all 4 steps, media shows,
saves persist.
