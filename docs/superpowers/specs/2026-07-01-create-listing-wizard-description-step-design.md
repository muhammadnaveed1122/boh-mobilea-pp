# Create-Listing Wizard — Description Step (Step 2)

**Date:** 2026-07-01
**Repo:** `boh-mobile`
**Depends on:** [`2026-06-29-create-listing-wizard-information-step-design.md`](./2026-06-29-create-listing-wizard-information-step-design.md)

## Goal

Add the wizard's second step — **Description** — at full backend parity with the web
`boh-lead-magnet` wizard, in mobile manner. The step captures the listing's hero
**Title + Description** and persists them to the listing content record. The Description
text is the source pushed to Property Finder on publish.

This is the first change that turns the mobile wizard from a single terminal screen into
a multi-step flow.

## Web reference (source of truth)

- UI: `Step4Content` → `ListingContentWorkflowTab` `descriptionOnly` branch. Renders a single
  "Hero & Basics" card with a helper line, a required **Title** input, and a required
  **Description** textarea (`heroDescription`, 5 rows). No media, no other sections.
- Persistence: `saveContentStep` in `useListingWizard` →
  - **Secondary** (`useOpportunityListingSync.saveAllSections`): lazily creates the
    opportunity-listing, then upserts the hero section.
  - **Primary** (`usePrimaryListingSync.saveAllSections`): upserts the hero CMS section on
    the listing created in step 1.
- Validation: `contentStepSchema` = `title` + `heroDescription` both required.

Web upserts every content section (about/faq/seo/…) on this step even when empty. Mobile
sends **only the hero** — the other sections belong to the not-yet-built Media/Portals steps.

## Current mobile state

- `CreateListingWizard` renders only `InformationStep`. `WizardStepper activeIndex={0}` is
  hardcoded. The footer's "Create & Continue" runs `useCreateListing` and is **terminal**
  (creates lead+opportunity, or the primary listing; toasts; no navigation, no listing
  content record).
- No content/listing-content endpoints are wired. `services.ts` has `createLead`,
  `createOpportunity`, `createPrimaryListing` only.
- Branch resolves from `completionStatus` via existing `branchFor()`.

## Backend contract (mobile, `apiClient` unwraps `{ success, data }`)

All paths are prefixed `/api/v1` (mobile convention).

### Secondary branch (`ready_secondary` / `off_plan_secondary`)

1. **Create listing** — only if `created.listingId` is not set yet:
   `POST /api/v1/opportunity-listing/opportunity/:opportunityId`
   JSON body `{ name: title.trim().slice(0, 120) }` → returns `{ id }`.
2. **Upsert hero** (multipart `FormData`):
   `POST /api/v1/opportunity-listing/:listingId/hero`
   fields: `title`, `subtitle=''`, `description=<description>`, `videoLink=''`,
   `view360Link=''`, `existingMedia='[]'`, `newMediaAltTexts='[]'`.

### Primary branch (`ready_primary` / `off_plan_primary`)

The primary listing is already created in step 1 (`POST /listings` → `id`, stored on
`created.listingId`). Just upsert the hero CMS section:
`POST /api/v1/listing-cms/:listingId?section=hero`
header `X-Use-FormData: true`, multipart `FormData`:
`mainTitle=<title>`, `subTitle=''`, `description=<description>`, `existingMedia='[]'`.

### FormData note

React Native `FormData` with only text fields is sent as `multipart/form-data`. During
implementation, verify `apiClient` (axios) sets the multipart boundary and does not force
`application/json`; strip/override the default `Content-Type` per request if needed, and add
the `X-Use-FormData` header on the primary call. (Confirmed open item, not assumed working.)

## Architecture

### Wizard becomes multi-step (`CreateListingWizard.tsx`)

Add controller state:

- `stepIndex: 0 | 1` (0 = Information, 1 = Description).
- `created: { leadId?; opportunityId?; listingId?; branch: ListingBranch }` — populated when
  step 1 succeeds. `branch` derived from the information form's `completionStatus`.

Step-1 button semantics change:

- **Create & Continue** → runs existing `useCreateListing`; on success stores `created`
  (mapping `useCreateListing`'s `{ kind, id }` result: `kind: 'opportunity'` →
  `opportunityId`, `kind: 'listing'` → `listingId`) + branch, then advances to Description.
  No longer terminal.
- **Save as Draft** → unchanged terminal behavior (create + toast + `router.back()`).
  Preserves the quick-create path.

`WizardStepper activeIndex={stepIndex}` (already parameterized — just wire it).

### New files

- `forms/description.schema.ts` — Zod: `title` required (min 1), `description` required
  (min 1). `DescriptionValues` type. `DESCRIPTION_DEFAULTS = { title: '', description: '' }`.
- `forms/description.form.ts` — `useDescriptionForm(onValidSubmit)` wrapping `useAppForm`
  with `validators: { onSubmit: descriptionSchema }` (mirrors `information.form.ts`).
- `components/steps/DescriptionStep.tsx` — `ScrollView` (`keyboardShouldPersistTaps="handled"`,
  same padding as `InformationStep`) → one `WizardCard`:
  - `icon="FileText"`, `title="Hero & Basics"`,
    `description="The title and description used for portals such as Property Finder."`
  - `form.AppField name="title"` → `field.Input` label `"Title"` `required`
    placeholder `"Title"`.
  - `form.AppField name="description"` → `field.Textarea` label `"Description"` `required`
    `numberOfLines={5}` placeholder
    `"Describe the property — sent to Property Finder on publish."`.
- `hooks/use-save-content.ts` — TanStack `useMutation` taking
  `{ created, values }`. Branch on `created.branch`:
  - secondary: create opportunity-listing if no `listingId` (return the new id to the
    caller so it is stored on `created`), then upsert hero.
  - primary: upsert hero CMS section.
    Returns the resolved `listingId`.

### New services (`services.ts`)

- `createOpportunityListing(opportunityId, body): Promise<{ id }>`
- `upsertOpportunityListingHero(listingId, fields): Promise<void>` (builds FormData)
- `upsertPrimaryListingHero(listingId, fields): Promise<void>` (builds FormData, adds
  `X-Use-FormData` header)

### Footer (`WizardFooter.tsx`)

Extend to support per-step configuration without breaking step 1:

- Add optional props: `primaryLabel` (default `"Create & Continue"`), `onBack`
  (when set, the secondary row shows **Back** instead of / alongside Cancel).
- Description step renders: **Back** (→ `stepIndex = 0`) + **Save Content** primary.
- `submittingMode` reused for the in-flight spinner on the active button.

## Behavior after "Save Content" (per product decision)

Media step (index 2) is not built. Save Content **persists the hero and stays on the
Description step** — success toast (`"Listing content saved"`), no exit, no auto-advance.
The user backs out manually. When the Media step lands, its "Continue" replaces this with an
advance. On failure: error toast, stay on step, nothing consumed.

Idempotency: the created `listingId` is stored on `created` after the first save so a second
Save Content upserts the hero on the same listing instead of creating a duplicate.

## UI/UX validation (ui-ux-pro-max)

Reuses the established design system from step 1 — no new visual language.

- Forms & Feedback: visible labels (FormBase), required asterisks, error rendered below the
  field, inputs ≥44pt, `numberOfLines={5}` gives a comfortable multi-line target.
- Multi-step progress: `WizardStepper` shows the active step; Back navigation is available.
- Style/consistency: same `WizardCard` radius/border/shadow/brand-tinted icon chip; Lucide
  icon (no emoji); semantic Tailwind tokens only (`bg-card`, `text-foreground`,
  `text-muted-foreground`), no hardcoded hex.
- Keyboard: `keyboardShouldPersistTaps="handled"` so taps outside inputs dismiss cleanly.

## Out of scope

- Media & Documents step (index 2), Portals step (index 3).
- Resume/edit hydration, review/publish lifecycle, PF agent/location, per-section media,
  about/highlights/amenities/faq/seo/location content.
- Stepper click-to-jump between steps (forward jumps stay locked; only Back is wired).

## Open items (resolved)

- **Persistence model:** full web parity now (create listing + upsert hero on this step).
- **Step-1 flow:** Create & Continue advances to Description (Save as Draft stays terminal).
- **FormData handling:** verify axios/RN multipart boundary during implementation.
- **After Save Content:** save + stay on step (no exit).
