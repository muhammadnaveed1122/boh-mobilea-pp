# Listing Detail Page — Sell/Rent aware + Edit action

**Date:** 2026-07-02
**Repos:** `boh-mobile` (primary) + `boh-lead-magnet-backend`
**Branch:** `feat/listing-detail-page` (worktree off `master` in each repo)

## Summary

The listing detail page already exists and is comprehensive
(`ListingDetailScreen` → hero carousel, price header, highlights, about, agent,
amenities, regulatory, related). This is an **improvement**, not a new build.

Three changes:

1. **Sell/Rent aware** — the page currently hardcodes "For Sale". Drive the
   badge, price formatting, and a purpose-specific details card from the
   listing's actual purpose.
2. **Edit action button** — a dead (no-op) Edit control, per request. Wired to
   nothing for now.
3. **Targeted UI polish** — apply `ui-ux-pro-max` to spacing, typography,
   hierarchy, chips, and shadows. **No layout restructure.**

## Data source (verified)

- The opportunity carries a direct `purpose` enum column: `for_sale | for_rent`
  (`prisma/schema/opportunities.prisma:45`). This is authoritative — preferred
  over `wizardState.purpose`.
- Rent-relevant opportunity columns that exist: `priceType` (price period),
  `deposit` (string), `maxCheques` (int), `furnishing` (already shipped).
- **`availabilityDate` does NOT exist** on the opportunity → excluded from the
  design.
- Today the detail `derived` payload ships only 8 fields
  (`opportunity-listing-response.builder.ts:27-34`), none purpose-specific.

## Backend changes — `boh-lead-magnet-backend`

### `services/opportunity-listing-response.builder.ts`

Extend the `derived` object with:

- `purpose: opp.purpose ?? null` (`'for_sale' | 'for_rent' | null`)
- `priceType: opp.priceType`
- `deposit: opp.deposit`
- `maxCheques: opp.maxCheques`

`furnishing` is already present. All sourced from the existing `opp`
(`Opportunity`) argument — no new query.

### `dto/listing-response.dto.ts`

Add the four fields above to the `derived` shape type so the response contract
and Swagger stay accurate.

## Mobile changes — `boh-mobile`

### `src/features/listings/types.ts`

- `ListingDetail`: add `purpose?: 'for_sale' | 'for_rent' | null`.
- `ListingDerived`: add `priceType?`, `deposit?`, `maxCheques?`.
  (`furnishing` already present.)

Add a small normalizer: `for_sale → 'sale'`, `for_rent → 'rent'` for the UI
layer (mirrors the existing `ListingsPurpose = 'sale' | 'rent'` type).

### `app/(app)/listings/[id].tsx`

Accept an optional `?purpose=` search param (`sale | rent`). Passed to the
screen as an **instant-badge fallback** shown before the payload loads. The
payload's `purpose` wins once available.

### List → detail navigation

Where a listing card navigates to `/listings/[id]`, append `?purpose=` from the
row's `purpose` field so the badge is correct on first paint. Fallback only —
not required for correctness.

### `src/features/listings/components/ListingDetailScreen.tsx`

- Compute `effectivePurpose = normalize(listing.purpose) ?? paramPurpose ?? null`.
- Pass `purpose` down to the sections that need it.
- Pass an `onEdit` no-op to `ImageCarousel` (dead button).

### `src/features/listings/components/detail/ImageCarousel.tsx`

- Generalize the private `CircleButton` to accept any `IconName` (currently
  typed to `'ArrowLeft'` only).
- Add a floating **Edit** circle button (pencil icon) top-right of the hero,
  mirroring the back button top-left. `onPress` = no-op for now.

### `src/features/listings/components/detail/sections.tsx`

- **PriceHeader**: replace hardcoded `'For Sale'` (line 63). Badge reads
  **For Sale** / **For Rent** from `purpose`. For rent, append a period suffix
  derived from `priceType` (e.g. `AED 120,000 /year`); if `priceType` is absent,
  show price with no fabricated period.
- **New purpose-aware card:**
  - Rent → **Rental Terms**: deposit, cheques (`maxCheques`), furnishing.
  - Sale → **Sale Details**: asking price, furnishing.
  - Each row renders only when its value is present; the card hides entirely if
    empty.
- **HighlightsSection**: adapt tile order by purpose — rent leads with
  furnishing; sale leads with area/price. Same tile set, reordered.

### UI polish (ui-ux-pro-max, targeted)

- Surface the status badge in the price header.
- Tune spacing/typography rhythm, chip styling, shadow depth, section-title
  hierarchy.
- Structure unchanged — carousel + overlapping rounded content sheet stays.

## Out of scope

- Any real Edit workflow / mutation (button is intentionally dead).
- `availabilityDate` (field does not exist).
- Layout restructure, sticky-on-scroll header (rejected: "targeted polish").
- New backend queries — reuse the `opp` already loaded.

## Verification

- Backend: `npm run check` (lint:strict + type-check + format:check).
- Mobile: `pnpm lint` + `tsc --noEmit`; manual QA of a sale listing and a rent
  listing (badge, price suffix, purpose card, tile order, Edit button visible +
  inert). No unit tests (per repo convention).
