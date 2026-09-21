# Listings Compare — Design

Date: 2026-07-01
Feature: Side-by-side comparison of listings on the Sell and Rent screens, mirroring
the existing web feature (`/my-account/listings?purpose=sale|rent`) and the existing
**mobile Projects compare** feature.

## Goal

Let a user select 2–4 listings on the Sell or Rent list and open a comparison grid
that shows key facts side-by-side, highlights the best value per row, and can hide
rows where all listings are identical.

## Guiding principle: reuse the Projects compare pattern

The mobile app already ships a complete compare feature for Projects:

- `src/features/projects/store/compare.store.ts` — selection state (zustand)
- `src/features/projects/components/CompareBar.tsx` — floating bottom bar
- `src/features/projects/components/ProjectCompareScreen.tsx` — frozen-label horizontal grid
- `src/features/projects/compare/compare-rows.ts` — row defs + `bestColumnIndex`
- `src/features/projects/hooks/use-compare-data.ts` — per-id hydration via `useQueries`
- `src/features/projects/components/ProjectListScreen.tsx` — `Compare`/`Done` header toggle + selectable cards

Listings compare **replicates this pattern verbatim**, adapted to listing data. We do
NOT invent new UI — visual consistency with Projects compare is a requirement.

## User flow

1. On Sell or Rent, user taps **Compare** in the header → enters compare mode
   (`Scale` icon, label toggles to **Done**).
2. Each listing card shows a selection control; tapping a card toggles selection
   (cap 4; card press-to-detail and the kebab menu are suppressed while in compare mode).
3. A floating **CompareBar** appears once ≥1 selected: listing thumbnails (each removable),
   **Clear**, and **Compare (N)** — enabled only at ≥2.
4. **Compare (N)** pushes `/listings/compare`, a full-screen grid.
5. Grid: frozen left label column + one horizontal-scrolling column per listing, grouped
   into sections, best-value cells highlighted with a tag, plus a **Differences** toggle
   in the header.
6. Back returns to the list with the selection intact. Tapping **Done** exits compare
   mode and clears the selection.

## Selection & limits

- Max 4 (`COMPARE_MAX = 4`), min 2 to open the grid.
- Selection state lives in a zustand store (not screen state) so it survives list
  refetches and navigation to the compare screen.
- Turning compare mode off clears the selection (same as Projects).

## Data

`UnifiedListingRow` already carries every core compare field: `price`, `sizeSqft`,
`propertyType`, `bedrooms`, `bathrooms`, `location`, `projectName`/`propertyLabel`,
`developerName`, `purpose`, `heroImageUrl`, `title`, `kind`.

Decision: the compare store holds the **full `UnifiedListingRow` snapshot** at toggle
time. The grid reads snapshots directly — no refetch for core rows. (This differs from
Projects, which fetch a rich record per id, because listing rows are already complete.)

### Amenities (wired in v1)

Amenities are not on `UnifiedListingRow`, so they are fetched lazily in the grid:

- **Secondary** listings: `getListingById(id)` → `GET /listings/:id` → `ListingDetail.amenities`.
  Fetched via `useQueries` (one query per secondary id, `staleTime` ~60s), mapped to
  amenity display names (`customTitle ?? amenity?.name`).
- **Primary** listings: mobile has no primary detail/CMS endpoint, so no amenities source.
  The amenities cell shows `—` for primary listings.

This inverts the web (web fetched amenities for primary) but matches what the mobile API
actually exposes today. If a primary amenities endpoint is added later, wire it into the
same hydration hook.

## Compare rows

Section **Key Facts**:

| Key            | Label              | Source                            | Best                |
| -------------- | ------------------ | --------------------------------- | ------------------- |
| `transaction`  | Transaction        | `purpose` → "For Sale"/"For Rent" | —                   |
| `price`        | Price              | `price` (rent appends `/yr`)      | min → tag "Lowest"  |
| `size`         | Size               | `sizeSqft` (`… sqft`)             | max → tag "Largest" |
| `propertyType` | Property type      | `propertyType` (title-cased)      | —                   |
| `bedrooms`     | Bedrooms           | `bedrooms`                        | —                   |
| `bathrooms`    | Bathrooms          | `bathrooms`                       | —                   |
| `location`     | Location           | `location`                        | —                   |
| `property`     | Project / Property | `projectName ?? propertyLabel`    | —                   |
| `developer`    | Developer          | `developerName`                   | —                   |

Section **Amenities**:

| Key         | Label     | Source                       | Best |
| ----------- | --------- | ---------------------------- | ---- |
| `amenities` | Amenities | hydrated names (chips) / `—` | —    |

Best-value logic reuses the Projects approach: `bestColumnIndex` returns the winning
column or `-1` on ties / all-empty (ties never highlight). Extend it to support a `max`
strategy (size) in addition to `min` (price).

## Files

New:

- `src/features/listings/store/compare.store.ts` — mirror of Projects store; `CompareItem`
  holds the `UnifiedListingRow` snapshot.
- `src/features/listings/compare/compare-rows.ts` — row defs above + `bestColumnIndex`
  (min/max) + `visibleRows` diff filter.
- `src/features/listings/hooks/use-listing-compare-data.ts` — reads snapshots from store;
  `useQueries` fetches amenities for secondary ids.
- `src/features/listings/components/ListingCompareBar.tsx` — floating bar → `/listings/compare`.
- `src/features/listings/components/ListingCompareScreen.tsx` — frozen-label horizontal grid
  (copy of `ProjectCompareScreen`, listing cells + amenities chips).
- `app/(app)/listings/compare.tsx` — route rendering `ListingCompareScreen`.

Edited:

- `src/features/listings/components/UnifiedListingCard.tsx` — add `selectable` / `selected`
  / `onToggleSelect` props; selection checkbox + selected highlight; suppress detail-press
  and kebab while `selectable`.
- `src/features/listings/components/UnifiedListingsList.tsx` — thread the selection props
  through to each card; add bottom padding when the bar is visible.
- `src/features/listings/components/ListingsBrowseScreen.tsx` — add the **Compare**/**Done**
  header toggle and mount `<ListingCompareBar />`.
- `app/(app)/_layout.tsx` — register `listings/compare` in the stack.

## Error / edge handling

- < 2 selected on the grid → EmptyState "Pick at least 2 listings to compare."
- Amenities query loading → cell shows a spinner/placeholder; failure → `—`.
- Removing a listing from the grid (column X) or the bar updates the store; dropping below
  2 shows the EmptyState.
- Rows with all-equal values are hidden when **Differences** is on (needs ≥2 listings).

## Verification

No test runner in this repo (per `boh-mobile/CLAUDE.md`). Verify via:

- `pnpm lint`
- `tsc --noEmit`
- Manual QA on both Sell and Rent: enter compare mode, select 2–4 (mix of primary +
  secondary), open grid, check best-value tags (price lowest, size largest), toggle
  Differences, remove a column, verify amenities show for secondary and `—` for primary.

## Out of scope (v1)

- Primary-listing amenities (no mobile endpoint).
- Persisting a comparison across app restarts.
- Sharing / exporting a comparison.
