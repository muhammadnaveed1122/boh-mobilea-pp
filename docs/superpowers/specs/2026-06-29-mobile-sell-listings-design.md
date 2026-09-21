# Mobile Sell Listings — Design

**Date:** 2026-06-29
**Repo:** `boh-mobile`
**Status:** Approved

## Goal

Bring the web `/my-account/listings?purpose=sale` experience to mobile. Wire the existing
(no-op) **Sell** card on `ListingsLandingScreen` to a new Sell listings screen that shows the
same per-listing information the web table shows per row, with search, all web filters, and
**lifecycle** tabs (Active / Inactive / Sold). Comparison is explicitly out of scope.

Buy/Rent cards remain no-op for now (separate, later work).

## Reference (web behavior being ported)

- Page: `boh-lead-magnet/src/features/listings/components/UnifiedListingsPage.tsx`
- Table: `.../components/ListingsTable.tsx` (16 columns)
- Screen state/merge: `.../hooks/useListingsScreen.ts`
- Lifecycle tabs: `.../constants/index.ts` `lifecycleTabs()`
- Primary API: `GET /listings` (project CMS listings) — `boh-lead-magnet/src/features/projects/api/listingsApi.ts`
- Secondary API: `GET /opportunity-listing` — `.../property-preparation/api/opportunityListingApi.ts`
- Unified row type: `boh-lead-magnet/src/features/listings/models/screen.ts` `UnifiedListingRow`

Web merges **both** APIs, interleaves by `updatedAt` desc, and a `market` view (All/Primary/Secondary)
controls which rows render. Both APIs are always called so counts stay accurate.

## Decisions (locked)

| Decision                                             | Choice                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Data source                                          | **Unified** — both `/listings` (primary) + `/opportunity-listing` (secondary), merged           |
| Tabs                                                 | **Lifecycle** (Active/Inactive/Sold) — replaces the existing status pills on this screen        |
| Filters                                              | **All 8 web filters** (see below)                                                               |
| Merge/pagination                                     | **Option A** — per-page parallel fetch, interleave by `updatedAt`, accumulate (infinite scroll) |
| Market segment                                       | Included (All / Primary / Secondary)                                                            |
| Primary card tap                                     | **Non-tappable for v1** (secondary cards open existing detail; primary display-only)            |
| Compare                                              | **Excluded**                                                                                    |
| Inline editing (stage, status, agent), delete action | **Excluded** (read-only v1)                                                                     |

## Architecture

### Entry / routing

- New route: `app/(app)/listings/sell.tsx` — permission-gated (`PERMISSIONS.OPPORTUNITY_LISTING_READ`),
  renders `SellListingsScreen`.
- Wire `onSell` in `ListingsLandingScreen.tsx` → `router.push('/listings/sell')`.
- Register screen in `app/(app)/_layout.tsx` Stack (slide animation, like `[id]`).

### Screen — `SellListingsScreen` (new, modeled on `AllListingsScreen`)

Holds UI state: lifecycle tab, market segment, search input, filter draft, page, sheet visibility.
Composition:

- `AllListingsHeader` (reuse) or a Sell-specific header.
- **Lifecycle tabs** component (new `ListingsLifecycleTabs`): `Active | Inactive | Sold`.
- **Market segment** control (new `ListingsMarketSegment`): `All | Primary | Secondary`.
- Search row (reuse `ListingsSearchRow`).
- List (new `UnifiedListingsList`, modeled on `AllListingsList`) of `ListingCard`.
- Filters sheet (extend `ListingsFiltersSheet`).

### Data layer

**New types** (`types.ts` additions):

- `UnifiedListingRow` — mirror web's: `id, kind('primary'|'secondary'), title, status, isPublished,
price, previousPrice, priceTrend, projectName, developerName, propertyLabel, permitNumber,
propertyType, bedrooms, bathrooms, sizeSqft, unitNumber, location, heroImageUrl, agentName,
createdByName, assigneeId, portals, purpose, updatedAt, leadId, opportunityId, slug`.
- `ListingsLifecycle = 'active' | 'inactive' | 'sold'`.
- `ListingMarket = 'all' | 'primary' | 'secondary'`.
- `ListingPortal = 'property_finder' | 'bayut' | 'dubizzle' | 'whatsapp'`.
- Extend `ListingsQuery` with `purpose`, `lifecycle`, `stageId?`, `developerId?`, `propertyUse?`.

**New service** `services.primary.ts`:

- `getPrimaryListings(params)` → `GET /listings` (page, limit, purpose=`for_sale`, lifecycle, search,
  status, developerId, propertyUse, assigneeId, sortBy=createdAt, sortOrder=desc).
- `getDeveloperOptions(search?)` → developer filter options (endpoint per web `fetchDeveloperFilterOptions`).
- Normalizer `primaryItemToRow(item): UnifiedListingRow`.

**Extend secondary** (`services.ts` / a new normalizer): add `purpose` + `lifecycle` params to the
existing `getListings`; add `secondaryItemToRow(item): UnifiedListingRow`.

**Hook** `use-sell-listings.ts`:

- Inputs: lifecycle, market, search, filters, page.
- Fires `useQuery` for primary and secondary in parallel (keyed by all params + page).
- Merges items from both → `UnifiedListingRow[]`, interleaves by `updatedAt` desc, accumulates across
  pages.
- Applies **client-side** filters on merged rows: rooms (Studio/1/2/3/4+; 4+ = `>=4`), price range
  (min/max buckets), portals (row must carry all selected).
- `market` filters which rows render (`all` = both).
- Exposes `rows, isLoading, isFetchingNextPage, hasNextPage, loadMore, refetch, counts`.
- Note: global ordering is exact within accumulated data, approximate across page boundaries
  (accepted tradeoff, same as web).

### Filters (all 8)

| Filter                               | Applied | Param                                          |
| ------------------------------------ | ------- | ---------------------------------------------- |
| Public-page status                   | server  | `status` (both APIs)                           |
| Property type                        | server  | `propertyUse` (primary)                        |
| Developer                            | server  | `developerId` (primary)                        |
| Agent                                | server  | `assigneeId` (primary) / `agentId` (secondary) |
| Unit number                          | server  | `property` (secondary)                         |
| Rooms (Studio/1/2/3/4+)              | client  | —                                              |
| Price range (preset buckets)         | client  | —                                              |
| Portals (PF/Bayut/Dubizzle/WhatsApp) | client  | —                                              |

Filter draft type extended from `ListingsFilterDraft`. Active-filter count updated accordingly.

### Listing card

Extend `ListingCard` to accept a `UnifiedListingRow` (keep existing `ListingListItem` path or adapt
callers). Per-card fields (mobile subset of the 16 web columns):

- Thumbnail (heroImageUrl, gradient fallback) • Title • kind badge (Primary/Secondary) • status badge
- Price + trend arrow • beds / baths / size row
- Location • property type • permit number
- Agent name • portal pills
- Secondary cards: `onPress` → `/listings/{id}` (existing detail). Primary cards: no `onPress` (v1).

## Out of scope (v1)

- Compare feature.
- Stage column + inline stage editing.
- Inline public-page-status and agent editing.
- Delete action (super-admin).
- Primary-listing detail screen.
- Buy/Rent flows.

## Risks / notes

- Cross-page interleave ordering is approximate (Option A). Acceptable.
- `/listings` (primary) must be reachable from the mobile API base (`EXPO_PUBLIC_API_BASE_URL`).
  Verify the route is served by the same backend the mobile app targets.
- Developer filter options endpoint must exist for mobile; confirm path from web's
  `fetchDeveloperFilterOptions`.
- No test runner in repo — verify via `tsc` + `pnpm lint` + manual QA (per project convention).
