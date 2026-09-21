# Shared Amenities Module + Portals Step Amenities

**Date:** 2026-07-02
**Repo:** `boh-mobile`
**Depends on:** [`2026-07-01-create-listing-wizard-media-documents-step-design.md`](./2026-07-01-create-listing-wizard-media-documents-step-design.md)

## Goal

1. Create a single shared amenity-mapping module and migrate every existing consumer to it
   (icons, default images, label/media/sort/visibility helpers) — eliminating the duplicated,
   per-feature amenity logic across projects/properties/listings/new-projects.
2. Build the create-listing wizard's **Portals step (index 3)** with its **Amenities** selector
   at web parity (master catalog fetch → selectable grid with search + PropertyFinder badge),
   plus the amenities save (secondary + primary).

## Web reference

- Portals amenities = CRM `AmenitiesSection`: grid of master amenities, each with an icon (Phosphor
  by slug, or admin `iconUrl` image), name, PropertyFinder badge (`isPfAmenity`), description, and a
  checkbox; a search filter; selection stored as `selectedAmenityIds`. (Web's "add custom amenity"
  create button is commented out — excluded here.)
- Master list: `GET /project-public-page/amenities` → `{ id, name, description, slug, icon, iconUrl, isPfAmenity }`.
- Save: secondary `PATCH /opportunity-listing/:id/amenities { selectedAmenityIds }`; primary
  `POST /listing-cms/:id?section=amenities` (FormData `amenities` = JSON of `{ amenityId, sortOrder }`).

## Current mobile state (from inventory)

- `src/features/projects/constants/amenityDefaultImages.ts` — the only shared-ish piece: slug/icon/label
  → default slider images (`getDefaultAmenitySliderImages`), 12 canonical prefixes / 33 aliases + a
  single-image fallback.
- Only `listings/components/detail/sections.tsx` resolves an icon — a literal `name in
lucide-react-native/icons` check with `'Check'` fallback (no alias table).
- Name resolution `customTitle ?? name ?? 'Amenity'` duplicated in `normalize-detail.ts`,
  `listings/detail/sections.tsx`, `use-listing-compare-amenities.ts`.
- Media-normalize duplicated in `normalize-detail.ts` + `to-project-amenities.ts`; `sortOrder` sort and
  `isVisible !== false` filter duplicated across several files.
- `properties/components/detail/PropertyAmenities.tsx` is **dead code** (no importers).
- The compare subsystem (`listings|projects/compare/compare-rows.ts`, `*CompareScreen.tsx`,
  `use-listing-compare-amenities.ts`, `projects/services.ts getProjectAmenities`) is the active
  collision zone with the parallel "listings compare" feature.
- Wizard steps today: 0 Information, 1 Description, 2 Media. No Portals step. `WizardStepper` already
  lists a 4th "Portals" step. No master-amenities fetch. `WizardContent` has no `selectedAmenityIds`.

## Part 1 — Shared amenity module (`src/lib/amenities/`)

New cross-feature module (this app keeps shared libs under `src/lib/`).

- `src/lib/amenities/images.ts` — move `AMENITY_IMAGES_BY_PREFIX`, `AMENITY_LOOKUP_TO_PREFIX`,
  `slugify`, `resolvePrefix`, and export `resolveAmenityImages({ label?, icon?, slug? }): readonly
ImageSourcePropType[]` (today's `getDefaultAmenitySliderImages`, verbatim — all 12 prefixes /
  33 aliases preserved, same fallback image). `require()` asset paths updated to the new relative
  depth (assets stay in `assets/images/amenities/`).
- `src/lib/amenities/icons.ts` — slug/alias → Lucide `IconName` map + `resolveAmenityIcon({ icon?,
slug?, label? }): IconName`:
  1. If `icon` is a non-empty string that is a valid `IconName` (Lucide key), return it (preserves the
     current listings passthrough).
  2. Else slugify `icon`/`slug`/`label` (reusing the images alias table's `slugify`) and look up the
     amenity-icon map.
  3. Else `'Check'`.
     Initial slug→icon map (implementer verifies each key compiles as `IconName`, else swaps to a valid
     Lucide key + reports): `electricity-backup→Zap`, `gym-and-health→Dumbbell`, `swimming-pool→Waves`,
     `cleaning-services→Sparkles`, `broadband-internet→Wifi`, `maintenance-staff→Wrench`,
     `security-staff→ShieldCheck`, `cctv-security→Cctv`, `laundry-facility→WashingMachine`,
     `satellite-or-cable-tv→Tv`, `pets-allowed→Dog`, `floors→Building2`. Aliases reuse the images table's
     alias→prefix mapping so a non-Lucide API `icon` string (e.g. `"gym-and-health"`) resolves.
- `src/lib/amenities/helpers.ts` — `resolveAmenityLabel({ customTitle?, name?, fallback? }): string`
  (`customTitle ?? name ?? fallback ?? 'Amenity'`); `sortAmenities<T extends { sortOrder?: number
}>(items): T[]` (stable by `sortOrder ?? 0`); `filterVisibleAmenities<T extends { isVisible?:
boolean }>(items): T[]` (`isVisible !== false`); `normalizeAmenityMedia(raw: unknown[]): {
id: string; mediaUrl: string; mediaType: 'image' | 'video'; altText: string | null; sortOrder:
number }[]` (http-only urls, `mediaType==='video'` else image — the `toMedia()` behaviour).
- `src/lib/amenities/index.ts` — barrel; re-exports the above + a `CanonicalAmenity` type
  (`{ id; name; slug?; icon?: string | null; description?; media?; isVisible?; sortOrder? }`).

### Migration (all consumers)

- Delete `src/features/projects/constants/amenityDefaultImages.ts`; update its importer
  (`new-projects/components/detail/AmenitiesSection.tsx`) to `@/lib/amenities`; replace that
  component's static `Check` icon with `resolveAmenityIcon`.
- `properties/utils/normalize-detail.ts` → use `resolveAmenityLabel`, `normalizeAmenityMedia`,
  `sortAmenities`, `filterVisibleAmenities` (drop the local `toAmenities` ad-hoc precedence + `toMedia`
  for the amenity path).
- `properties/utils/to-project-amenities.ts` → use `normalizeAmenityMedia` (keep the shape adapter;
  just source media via the shared helper).
- `listings/components/detail/sections.tsx` → `resolveAmenityIcon` + `resolveAmenityLabel` +
  `sortAmenities` (replace `isIconName`/inline `name in icons` + inline label/sort).
- `listings/hooks/use-listing-compare-amenities.ts` → `resolveAmenityLabel` + `sortAmenities`.
- `projects/services.ts getProjectAmenities` → `filterVisibleAmenities` (label already a name).
- Remove dead `properties/components/detail/PropertyAmenities.tsx` (confirm zero importers first).
- **Compare-zone files migrated LAST, as isolated tasks** (`listings/compare/compare-rows.ts`,
  `ListingCompareScreen.tsx`, `projects/compare/compare-rows.ts`, `ProjectCompareScreen.tsx`,
  and `use-listing-compare-amenities.ts` above): re-sync against the branch immediately before
  editing (the parallel compare work may have changed them); each reviewed via `commit~1..commit`.

No behavioural change intended by the migration — same icons/images/labels resolve; verified by
`tsc` + `lint` + spot manual QA of the detail/compare screens.

## Part 2 — Portals step Amenities

### Services (append to `src/features/listing-wizard/services.ts`)

- `interface MasterAmenity { id: string; name: string; description: string; slug: string; icon: string | null; iconUrl: string | null; isPfAmenity: boolean }`
- `getMasterAmenities(): Promise<MasterAmenity[]>` — `GET /api/v1/project-public-page/amenities` (defensive map).
- `upsertOpportunityListingAmenities(listingId: string, selectedAmenityIds: string[]): Promise<void>`
  — `PATCH /api/v1/opportunity-listing/:listingId/amenities` JSON `{ selectedAmenityIds }`.
- `upsertPrimaryListingAmenities(listingId: string, selectedAmenityIds: string[]): Promise<void>`
  — `POST /api/v1/listing-cms/:listingId?section=amenities` (header `X-Use-FormData: true`), FormData
  `amenities` = `JSON.stringify(selectedAmenityIds.map((amenityId, i) => ({ amenityId, sortOrder: i })))`.

### Hooks

- `hooks/use-master-amenities.ts` — `useMasterAmenities()` = `useQuery(['master-amenities'], getMasterAmenities)`.
- `hooks/use-save-amenities.ts` — `useSaveAmenities()` mutation `{ created, selectedAmenityIds }`:
  branch on `created.branch` → primary calls `upsertPrimaryListingAmenities(created.listingId, ids)`;
  secondary calls `upsertOpportunityListingAmenities(created.listingId, ids)`. Throws if `listingId`
  undefined.

### Components

- `components/AmenitiesSelector.tsx` — `AmenitiesSelector({ options, selectedIds, onChange }: Readonly<{
options: MasterAmenity[]; selectedIds: string[]; onChange: (ids: string[]) => void }>)`. Search
  `Input` (filters by name) + a list of rows: leading icon (`iconUrl` `<Image>` when present, else
  `<Icon name={resolveAmenityIcon({ icon, slug, label: name })} />`), name + PropertyFinder badge
  (small text/icon) when `isPfAmenity`, description (muted), trailing `Checkbox`. Toggling updates
  `selectedIds`. Empty-search state "No amenities match your search."
- `components/steps/PortalsStep.tsx` — `ScrollView` + one `WizardCard` (icon `SquareStack` or `Grid3x3`,
  title "Amenities", description "Amenities shown on the listing and sent to Property Finder.")
  wrapping `AmenitiesSelector` fed by `useMasterAmenities()` (loading + error states). Props:
  `{ selectedAmenityIds: string[]; onSelectedChange: (ids: string[]) => void }`.

### Wizard wiring (`components/CreateListingWizard.tsx`, `use-save-media.ts` content type)

- Add `selectedAmenityIds: string[]` to `WizardContentInput`/`WizardContent` (default `[]`).
- Media step's "Save Media" success → **advance to Portals** (`setStepIndex(3)`) instead of stay.
- Render `PortalsStep` at `stepIndex === 3` with `selectedAmenityIds={content.selectedAmenityIds}` +
  `onSelectedChange={(ids) => updateContent('selectedAmenityIds', ids)}`.
- Portals footer: Back (→ Media, step 2) + primary "Save Amenities" → `submitAmenities()` runs
  `useSaveAmenities().mutateAsync({ created, selectedAmenityIds: content.selectedAmenityIds })`; on
  success toast "Amenities saved" and **stay** (Portals is the last built step). Error toast on failure.
- `WizardStepper activeIndex` already supports index 3.

## UI/UX (ui-ux-pro-max)

- Selector rows reuse the wizard card system + `Checkbox` atom; icon+text PF badge (not color-only);
  ≥44pt row tap target; search `Input` labelled; semantic tokens only; loading (spinner) + empty
  states. Migration keeps existing detail/compare visuals identical.

## Out of scope

- Rest of Portals (About text, Subtitle, Highlights, Location & Connectivity, Generate SEO,
  publish/PF-agent/permit) — later increments.
- Custom-amenity creation (`AddAmenityModal`) — excluded (web's create button is off).
- Resume hydration of previously-selected amenities (wizard is create-only; starts empty).
- Amenity per-item media/description editing in the wizard (selection only).

## Open items (resolved)

- Shared module built + **all consumers migrated** (compare files last, isolated).
- Icon strategy: **Lucide per-slug + `iconUrl` image fallback**; detail carousels keep `resolveAmenityImages`.
- Portals increment: **Amenities only**, in a scaffolded Portals step (index 3) with save.
- Save endpoints: secondary `.../amenities {selectedAmenityIds}`; primary listing-cms amenities section.
