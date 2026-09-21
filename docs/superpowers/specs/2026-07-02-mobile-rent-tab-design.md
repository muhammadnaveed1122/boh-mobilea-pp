# Mobile Guest Home — Rent Tab (parity with web `/rent-with-us`)

Date: 2026-07-02
Status: Approved (design)

## Problem

The guest / public home screen (`HomeScreen`) has a **Rent** tab that is
currently hard-disabled (`disabled: true`, renders a `RentComingSoon`
placeholder). The web has a fully working `/rent-with-us` page. We need full
parity on mobile, done the mobile way (native list, sheets, expo-router
navigation).

## How the web does it (parity target)

Rent is **not** a separate feature on web — it is Buy with a flag:

- **Data**: same endpoints as Buy, filtered by type.
  - Projects: `GET /public/projects?type=rent&page&limit&<filters>`
    (Buy uses `type=buy`). Backend `type: 'buy' | 'rent'` enum returns the
    nested rent listings per project.
  - Opportunities: `GET /opportunity-listing/public?...&purpose=for_rent`
    (Buy uses `for_sale`).
  - Both sources merged newest-first.
- **Card**: the _same_ card component, switched by `listingType` / `variant`.
  No separate rent card.
- **Detail**: the _same_ shared listing detail page + endpoints. A rent
  listing routes to the identical detail as a buy listing (same slugs).
- **Filters**: the same filter bar (search, beds/baths, city, property type,
  price).

Mobile already mirrors this shape: one unified `PropertyCard` model and one
`PropertyDetailScreen` already handle both `buy-project`
(`/public/projects/{projectSlug}/{listingSlug}`) and `opportunity`
(`/opportunity-listing/public/{slug}`) sources.

## Approved decisions

1. **Structure**: parameterize the existing feed and reuse the list component
   (closest to web's variant approach — least duplication).
2. **Price label**: append a rent period `/yr` to the rent price (a deliberate,
   minimal divergence from web, which shows no suffix). Applies to **both** the
   card and the detail page.
3. **Filters**: reuse the full Buy filter set (search, beds/baths, city, type,
   price) for rent.

## Design

### 1. Data layer — parameterize the feed by listing type

`src/features/properties/services.ts`

- `fetchBuyCards(type: 'buy' | 'rent')` → `GET /api/v1/public/projects` with
  `params: { type, page: 1, limit: FEED_FETCH_LIMIT }`.
- `fetchOpportunityCards(purpose?: 'for_sale' | 'for_rent')` → adds
  `purpose` to the existing params when provided.
- `getPropertiesFeed(listingType: 'buy' | 'rent' = 'buy')`:
  - buy → `fetchBuyCards('buy')` + `fetchOpportunityCards()` (unchanged
    behaviour, default arg keeps existing call sites working).
  - rent → `fetchBuyCards('rent')` + `fetchOpportunityCards('for_rent')`, then
    post-map: append ` /yr` to each card's `priceLabel` **only when the card
    has a real price** (`priceValue !== undefined`). Cards showing
    `"Price on request"` (from `formatAedExact` on null/≤0) are left untouched.
  - Both sources still fail soft (`[]`) and merge newest-first via `mergeFeed`.

Rationale for the suffix living in the feed (not the mapper): keeps the pure
mappers shared across buy/rent and localises the rent-only concern to the rent
feed path. `PropertyCard` then needs **zero** changes for the card `/yr`.

### 2. Detail `/yr` — via a nav flag (no endpoint/data change)

The detail screen is shared and reached through buy routes; it has no notion of
rent. To show `/yr` on detail without duplicating the screen:

- `src/features/properties/components/PropertyCard.tsx` — `openDetail(card)`
  gains a rent flag. When rendering the rent list, cards navigate with a
  `rent=1` query param:
  - `/properties/opportunity/{slug}?rent=1`
  - `/properties/project/{projectSlug}/{listingSlug}?rent=1`
    The flag is passed into `PropertyCard` as a prop (`isRent`, default `false`)
    by the list, so the buy list is unchanged.
- Route files read the param and pass an `isRent` boolean into
  `PropertyDetailScreen`:
  - `app/(public)/properties/opportunity/[slug].tsx`
  - `app/(public)/properties/project/[projectSlug]/[listingSlug].tsx`
- `src/features/properties/components/PropertyDetailScreen.tsx` — when `isRent`
  and a real price exists, append ` /yr` to the displayed price label (header
  card + sticky `PropertyContactBar`). No change to `usePropertyDetail` or the
  fetch/normalize layer.

### 3. List component — reuse + rename for clarity

`src/features/properties/components/BuyListing.tsx` → rename to
`PropertyListing.tsx`, add prop `listingType: 'buy' | 'rent'` (default `'buy'`):

- passes `listingType` to `usePropertiesFeed(listingType)`.
- passes `isRent={listingType === 'rent'}` down to each `PropertyCard` (drives
  the `rent=1` nav param above).
- everything else reused unchanged: `SearchRow`, `BuyFiltersSheet`,
  `filterBuyCards`, `countActiveBuyFilters`, `LIST_PAGE_SIZE` lazy paging,
  pull-to-refresh, empty/error states. Empty/error copy ("properties") is
  generic enough to keep.

Reason for the rename: the component is now used for both tabs; keeping the
name `BuyListing` for the rent tab is misleading. Single import site to update
(`HomeScreen`). `BuyFiltersSheet` / `filter-buy` keep their names (shared
verbatim) to avoid churn.

### 4. Feed hook

`src/features/properties/hooks/use-properties-feed.ts`

- `usePropertiesFeed(listingType: 'buy' | 'rent' = 'buy')`.
- `queryKey: ['properties', 'feed', listingType]` — buy and rent get separate
  cache buckets so they don't clobber each other.
- `queryFn: () => getPropertiesFeed(listingType)`. `staleTime` unchanged.

### 5. Enable the tab

`src/features/new-projects/components/HomeScreen.tsx`

- Remove `disabled: true` from the `rent` entry in `TABS`.
- Content switch: `tab === 'rent'` → `<PropertyListing listingType="rent"
contentBottomPadding={bottomPad} />`; `tab === 'buy'` →
  `<PropertyListing listingType="buy" contentBottomPadding={bottomPad} />`.
- Delete the `RentComingSoon` placeholder component.

## Touch list (~8 files)

| File                                                              | Change                                                 |
| ----------------------------------------------------------------- | ------------------------------------------------------ |
| `properties/services.ts`                                          | `type`/`purpose` params; rent `/yr` post-map           |
| `properties/hooks/use-properties-feed.ts`                         | `listingType` arg + queryKey                           |
| `properties/components/BuyListing.tsx` → `PropertyListing.tsx`    | rename + `listingType` prop, pass `isRent` to cards    |
| `properties/components/PropertyCard.tsx`                          | `isRent` prop → `rent=1` nav param                     |
| `properties/components/PropertyDetailScreen.tsx`                  | `isRent` prop → `/yr` on price label + sticky bar      |
| `app/(public)/properties/opportunity/[slug].tsx`                  | read `rent` param → `isRent`                           |
| `app/(public)/properties/project/[projectSlug]/[listingSlug].tsx` | read `rent` param → `isRent`                           |
| `new-projects/components/HomeScreen.tsx`                          | enable tab, render `PropertyListing`, drop placeholder |

## Non-goals / YAGNI

- No new card component (web reuses Buy's — so do we).
- No new detail screen or endpoint (rent listings carry the same slugs).
- No backend change (`type=rent` / `purpose=for_rent` already supported).
- No sort UI (web has none; fixed newest-first server + client order).
- No rent-specific filter divergence (reuse Buy filters as web does).

## Verification (no unit tests in this repo — per project convention)

- `pnpm lint` + `tsc` clean.
- Manual QA on device/emulator:
  - Rent tab tappable; shows rent listings; buy tab still shows buy listings.
  - Card prices show `AED … /yr` for priced rentals; `"Price on request"`
    stays suffix-free.
  - Filters + search work on the rent list.
  - Tapping a rent card opens the detail; price shows `/yr`; buy card detail
    unchanged.
  - Buy and rent lists don't clobber each other's cache (separate queryKeys).
