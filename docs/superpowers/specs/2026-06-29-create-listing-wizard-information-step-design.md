# Create Listing Wizard — Scaffold + Information Step (Step 1)

**Date:** 2026-06-29
**Repo:** `boh-mobile`
**Status:** Approved

## Goal

Port the web Create-Listing wizard (`/my-account/listings/create`) to mobile, **step 1 only**: the
wizard scaffold (4-step stepper + footer) and a faithful replica of the **Information** step —
**both branches** (Primary project-market + Secondary own-property), **every web field**, with all
API-backed selects fetching real data and showing **loading / error / empty** states.

**This increment is form + validation only.** "Save & continue" is a **no-op** (no create POST, no
navigation). Steps 2–4 (Description, Media & Documents, Portals) are not built — the stepper shows
them but only Information is active.

## Reference (web, being ported)

- Wizard: `boh-lead-magnet/src/features/listing-wizard/components/ListingWizard.tsx`
- Information step: `.../components/steps/InformationStep.tsx` (+ `Step2OwnerSource.tsx`,
  `Step3PropertyDetails.tsx`, `PrimaryListingFields.tsx`, `PrimaryPropertyDetails.tsx`)
- Schemas: `.../validation/wizardSchemas.ts`
- Option constants: `boh-lead-magnet/src/features/opportunities/constants/opportunityOptions.ts`,
  `.../listings-shared/constants/rentFields.ts`, `.../leads/constants/leadProfileFields.ts`,
  nationality `.../components/molecules/form/nationality-select/nationalityOptions.ts`

## Decisions (locked)

| Decision                     | Choice                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Scope                        | Wizard scaffold + Information step only                                                                                               |
| Branches                     | **Both** Primary + Secondary                                                                                                          |
| Fields                       | **Every** web field                                                                                                                   |
| Save & continue              | **No-op** this increment                                                                                                              |
| Steps 2–4                    | Stepper shows them; not active, not navigable                                                                                         |
| Create POST / draft / resume | **Out of scope**                                                                                                                      |
| Searchable selects           | Fetch a page (limit ~50) + client-side filter via existing `FormSelect` search; server-side search-as-you-type is a later enhancement |
| Multi-select (languages)     | New `FormMultiSelect` field component                                                                                                 |

## Architecture

### Entry / routing

- New route `app/(app)/listings/create.tsx` — permission gate `LISTINGS_CREATE` **or**
  `OPPORTUNITY_LISTING_CREATE` (deny → redirect `/listings`), renders `CreateListingWizard`.
- Register `listings/create` in `app/(app)/_layout.tsx` Stack (default slide).
- Wire the landing "+ Create" FAB (`ListingsLandingScreen` `onCreate`) → `router.push('/listings/create')`.

### Feature folder `src/features/listing-wizard/`

```
components/
  CreateListingWizard.tsx      scaffold: header + stepper + active step + footer
  WizardStepper.tsx            4-step progress (Information active; others muted)
  WizardFooter.tsx             Cancel + "Save & continue" (no-op)
  PlaceholderStep.tsx          "Coming soon" body for steps 2-4 (not navigated to)
  ApiSelectField.tsx           FormSelect wrapper: loading / error+retry / empty
  steps/
    InformationStep.tsx        orchestrates sections + branch switch
    TypeSection.tsx            property type, completion status, purpose
    LocationSection.tsx        community (API)
    OwnerSection.tsx           secondary owner block (all owner fields)
    SecondaryPropertySection.tsx  secondary property + pricing block
    PrimaryProjectSection.tsx  project/developer/unit-type/availability/assignee
    PrimaryPropertySection.tsx primary property details + pricing block
forms/
  information.schema.ts        Zod (type+location+owner+property+primary) branch-aware
  information.form.ts          useAppForm wrapper
hooks/
  use-neighbourhoods.ts  use-leads-search.ts  use-lead-detail.ts
  use-opportunities-search.ts  use-projects.ts  use-unit-types.ts
  use-wizard-agents.ts
services.ts                    axios calls for the above endpoints
constants.ts                   all static option arrays (below)
types.ts                       WizardStep, CompletionStatus, ListingBranch, form value types
```

### Shared form additions

- `src/components/atoms/MultiSelect.tsx` — bottom-sheet multi-select (mirrors `Select` styling;
  checkbox rows; value = `string[]`).
- `src/components/molecules/forms/input-fields/multi-select.tsx` — `FormMultiSelect` field, register
  in `forms/hook.ts` `fieldComponents` as `MultiSelect`.

### Wizard scaffold behavior

- `WizardStepper`: 4 chips/segments (Information, Description, Media & Documents, Portals).
  Information = active/brand; others = muted, non-tappable.
- Header: BackButton/Cancel + title "Create Listing". `paddingTop: insets.top` (pushed route — no
  global header, same fix as the sell/rent screens).
- `WizardFooter`: "Cancel" (→ `router.back()`) + primary "Save & continue" button that is a **no-op**
  for now (rendered, inert). No "Previous" on step 1.

### Information step — branch logic

- `completionStatus` selects the branch:
  - `ready_primary` | `off_plan_primary` → **Primary** branch.
  - `ready_secondary` | `off_plan_secondary` → **Secondary** branch.
  - Empty → only Type + Location sections render (branch sections hidden until chosen).
- `off_plan_*` forces Purpose = **For Sale** only (purpose options collapse to sale).
- `propertyUse` is derived from the chosen `propertyType`'s group (Residential/Commercial).
- Unit-type options (secondary) come from `UNIT_TYPE_OPTIONS_BY_PROPERTY_TYPE[propertyType]`.

### Fields (exact, by section)

**Type section** (always):

- Property Type — grouped Select (static, see constants), optional.
- Completion Status — Select (static), **required**, drives branch.
- Purpose — Select (static; sale-only when off-plan), **required**.

**Location section** (always):

- Community — **API select** `/locations/neighbourhoods`, **required**.

**Secondary → Owner block:**

- Source of Owner — segmented toggle: "Create new owner" | "Select existing owner".
- Existing Owner — **API select** `/leads?interest=seller` (shown when source=existing); on select,
  fetch `/leads/:id` and prefill the owner fields below.
- Name (text, required), Email (text, optional, email-validated), Phone (PhoneInput, required),
  Gender (Select static), Date of Birth (DatePicker), Source (Select static),
  Nationality (Select static ISO list), Spoken Languages (**MultiSelect** static),
  Listing Assignee — **API select** `/agents` (required for managers/super-admins; agents default self).

**Secondary → Property block:**

- Property Source — segmented toggle: "New property" | "Existing property".
- Existing Property — **API select** `/opportunities?leadId=<ownerId>` (shown when source=existing,
  requires a chosen owner); on select, prefill property fields.
- Unit Type (Select, options by property type), Bedrooms (number, required-for-new),
  Built-up Area (number) + unit (sqft), Bathrooms (number, required-for-new),
  Furnishing (Select static), View (Select static), Project/Building (text), Tower/Block (text),
  Unit Number (text, required), Floor (text), Project Address (text).
- Pricing: Asking Price (number, required for sale), Price Type (Select static, rent only),
  Max Cheques (number, rent only), Deposit (number, rent only), Mortgage Status (Select static, sale only).

**Primary → Project block:**

- Project — **API select** `/listings/projects`, required; on select auto-fills Developer + clears Unit Type.
- Developer — Select, disabled (auto-filled from project), required.
- Unit Type — **API select** `/listings/unit-types?projectId=`; options disabled when
  `usedPurposes` already includes the chosen purpose.
- Availability — Select static (sold↔rented by purpose).
- Assigned Agent — **API select** `/agents` (managers/super-admins; agents default self).

**Primary → Property details block:**

- Bedrooms (number, required), Bathrooms (number, required), Price (number, required for sale),
  Size (number), View (Select), Furnishing (Select), Floor (text), Total Floors (text),
  Build Year (text), Occupancy (Select), Parking (number), Availability Date (DatePicker),
  Public Unit No. (text), Private Unit No. (text), plus rent/sale Pricing block (as secondary).

### Static option arrays → `constants.ts`

- `COMPLETION_STATUS_OPTIONS`: ready_primary "Ready Primary", off_plan_primary "Off-plan Primary",
  ready_secondary "Ready Secondary", off_plan_secondary "Off-plan Secondary".
- `PURPOSE_OPTIONS`: sale "For Sale", rent "For Rent" (sale-only when off-plan).
- `PROPERTY_TYPE_GROUPS`: Residential [apartment, villa, townhouse, residential_plot];
  Commercial [office, retail, warehouse, commercial_plot] (labels per scout).
- `PROPERTY_USE_BY_TYPE`: residential for the first group, commercial for the second.
- `UNIT_TYPE_OPTIONS_BY_PROPERTY_TYPE`: full map (apartment studio/1-6BR+/penthouse; villa 3-6BR+/mansion;
  townhouse 2-5BR; residential_plot; office shell_core/fitted/furnished/full_floor;
  retail retail_unit/fnb_unit/kiosk; warehouse; commercial_plot).
- `FURNISHING_OPTIONS`: furnished, semi_furnished, unfurnished.
- `VIEW_OPTIONS`: sea/city/garden/pool/canal/golf/landmark/community/park/marina/boulevard/other.
- `AVAILABILITY_OPTIONS`: available, reserved, on_hold, off_market, unavailable, sold (rented when rent).
- `GENDER_OPTIONS`: male, female, other.
- `OWNER_SOURCE_OPTIONS`: referral, walk_in, portal, cold_call, other.
- `SPOKEN_LANGUAGE_OPTIONS`: English…Punjabi (18 langs, value==label).
- `RENT_PRICE_TYPE_OPTIONS`: year, month, week, day.
- `MORTGAGE_STATUS_OPTIONS`: mortgaged, no_mortgage.
- `OCCUPANCY_OPTIONS`: owner_occupied, vacant, rented.
- `NATIONALITY_OPTIONS`: ISO alpha-2 list (port the web array).

### API selects (services + hooks)

Mobile axios `apiClient` base = `EXPO_PUBLIC_API_BASE_URL`; existing services use `/api/v1/...`. Assumed
mobile paths (verify in QA — fix the BASE const only if the prefix differs):

| Field             | Path                               | Params                                                                 | Item → option                                                 |
| ----------------- | ---------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------- | --- | -------------------- | --- | ------- |
| Community         | `/api/v1/locations/neighbourhoods` | page,limit,search                                                      | `{value:id,label:name}`                                       |
| Existing Owner    | `/api/v1/leads`                    | interest=seller,search,page,perPage=50,sortBy=updatedAt,sortOrder=desc | `{value:id,label:name                                         |     | email}`              |
| Owner detail      | `/api/v1/leads/:id`                | —                                                                      | prefill owner fields                                          |
| Existing Property | `/api/v1/opportunities`            | leadId,search,limit=20                                                 | `{value:id,label:projectBuilding                              |     | "Unit "+unitNumber}` |
| Project           | `/api/v1/listings/projects`        | search                                                                 | `{value:id,label:name}` (+developerId/Name)                   |
| Unit Types        | `/api/v1/listings/unit-types`      | projectId                                                              | `{value:id,label:displayLabel,disabled:usedPurposes∋purpose}` |
| Agents            | `/api/v1/agents`                   | page=1,limit=100,isActive=true                                         | `{value:id,label:fullName                                     |     | first+last           |     | email}` |

> NOTE for implementer: before writing a new service/hook, check the mobile repo for an existing one
> (the `leads` feature already exists; `useListingAgents` exists at `/api/v1/opportunity-listing/agents`).
> Reuse where the endpoint + shape match; only add new hooks for endpoints not already wrapped.

### `ApiSelectField` (loading / error / empty)

A wrapper over `FormSelect` that takes `{ isLoading, isError, refetch, options, ... }`:

- Loading → trigger shows a spinner + "Loading…", disabled.
- Error → inline destructive text under the field + a "Retry" pressable calling `refetch`.
- Empty (loaded, 0 options) → placeholder "No options".
- Loaded → normal `FormSelect` with options.

### Validation (`information.schema.ts`)

Mirror web `wizardSchemas.ts`, branch-aware (a discriminated/refined Zod schema on `completionStatus`):

- Always: completionStatus required, purpose required, neighbourhoodId (Community) required.
- Secondary new owner: name required, phone required, email optional+format; new property: bedrooms,
  bathrooms required, unitNumber required, askingPrice required when purpose=sale.
- Primary: projectId required, developerId required, bedrooms, bathrooms required, price required when sale.
- Numbers as positive-int strings (match web `optionalPositiveIntString`).
  Wired via `useAppForm({ validators: { onChange: schema } })`; field errors render through `FormBase`.

## Out of scope (this increment)

- Create POST (leads→opportunities→opportunity-listings / POST /listings), draft/resume, autosave.
- Steps 2–4 (Description, Media & Documents, Portals) bodies.
- Server-side search-as-you-type (use client filter on a fetched page).
- Push-to-Property-Finder toggle, publish/submit-for-review actions.

## Risks / notes

- Endpoint path prefixes assumed `/api/v1/...`; verify on the mobile API base in QA.
- `FormMultiSelect` is net-new shared infra — keep it generic (value `string[]`).
- The Information step is large; decompose into the section components above so each file stays focused.
- No test runner — verify via `pnpm exec tsc --noEmit` + `pnpm lint` + manual QA (project rule).
