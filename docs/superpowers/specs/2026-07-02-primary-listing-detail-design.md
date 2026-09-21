# Primary listing detail page (reuse ListingDetailScreen)

**Date:** 2026-07-02
**Repo:** boh-mobile (single repo, no backend changes)
**Branch:** `feat/primary-listing-detail` off `master`

## Summary

The listing detail page currently handles **secondary** (opportunity) listings
only; **primary** (project/developer) listings are list-only. Add a primary
detail page that **reuses the same `ListingDetailScreen`**, mapping the primary
CMS payload into the existing `ListingDetail` shape and surfacing primary-only
info (developer, project, availability, project specs) where it differs.

Editing is out of scope (parked for a later task).

## Data source (verified)

`GET /api/v1/listing-cms/:id` returns `ListingCmsPageResponseDto` — the full
primary payload:

- Flat property fields: `purpose` (`for_sale`/`for_rent`), `availability`,
  `completionStatus`, `developerId/Name`, `projectId/Name`, `unitTypeId`,
  `neighbourhoodId/Name`, `stateId`, `propertyType`, `bedrooms`, `bathrooms`,
  `size`, `viewType`, `furnishing`, `floor`, `totalFloors`, `buildYear`,
  `occupancy`, `parking`, `publicUnitNo`, `privateUnitNo`, `availabilityDate`,
  `mortgageStatus`, `priceType`, `maxCheques`, `deposit`, `assigneeId`.
- `agentInfo` (id/name/avatarUrl/email), `status`, `slug`, `isPublished`,
  timestamps.
- `sections`: `hero{mainTitle,subTitle,description,videoLink,view360Link,media[]}`,
  `highlights{...,price,publicPrice,brochureUrl}`, `about{mainTitle,subTitle,
textSection1,textSection2,additionalDescription,media[]}`, `amenities{items[]}`,
  `location{title,tagline,...}`, `seoSettings`.
- `trakheesiPermit{status,permitNumber,qrCodeUrl,qrCodeAltText,expiryDate}`.

Note: there is **no top-level price** — primary price is
`sections.highlights.publicPrice ?? sections.highlights.price`.

The mobile app already calls this URL (in `getPrimaryListingMedia`) but only
extracts media. Read perm: `LISTINGS_READ` (`listings:read`).

## Changes

### types.ts

- New `ListingPrimaryInfo` interface: `{ developerName?, projectName?,
availability?, size?, floor?, totalFloors?, buildYear?, occupancy?, parking?,
availabilityDate? }` (all nullable).
- Add `primary?: ListingPrimaryInfo | null` to `ListingDetail` (null/absent for
  secondary).

### lib/map-primary-detail.ts (new)

- `PrimaryCmsDetailResponse` raw type (subset of the DTO used).
- `mapPrimaryCmsToDetail(res): ListingDetail` — maps into the existing shape:
  - `sections.hero/about/highlights/location/seo` from `res.sections`.
  - `highlights.price = publicPrice ?? price` so `PriceHeader` resolves it.
  - `media.hero` / about buckets via a local `ListingCmsMediaItemDto →
ListingMediaItem` mapper.
  - `amenities` from `res.sections.amenities.items`.
  - `derived` from flat fields (propertyType, bedrooms, bathrooms, view→viewType,
    furnishing, builtUpArea←size, purpose, priceType, deposit, maxCheques).
  - `trakheesiPermit` passthrough.
  - `primary` block from developer/project/availability + specs.

### services.primary.ts

- `getPrimaryListingDetail(id): Promise<ListingDetail>` → GET + map.

### hooks/use-listing-detail.ts

- `useListingDetail(id, kind: ListingKind = 'secondary')` — queryKey
  `['listing', kind, id]`; picks `getPrimaryListingDetail` vs existing
  `getListingById`. Default `secondary` keeps existing callers working.

### components/ListingDetailScreen.tsx

- Add `kind: ListingKind` prop; call `useListingDetail(id, kind)`.
- Render `<ProjectDetailsSection detail={listing} />` (primary-only; hidden when
  `listing.primary` absent) after the highlights.
- Everything else (carousel, price header, about, agent, amenities, regulatory,
  related) renders unchanged from the shared `ListingDetail`.

### detail/sections.tsx

- New `ProjectDetailsSection` — a card of rows (Developer, Project, Availability,
  Size, Floor, Total Floors, Build Year, Occupancy, Parking, Availability Date),
  rendered only when values exist; hides if empty. Reuses the shared `RegRow`.

### app/(app)/listings/[id].tsx

- Read `kind` param (`'primary' | 'secondary'`, default `secondary`).
- Gate on `LISTINGS_READ` when primary, else `OPPORTUNITY_LISTING_READ`.
- Pass `kind` to the screen.

### components/UnifiedListingCard.tsx

- Make the **primary** branch pressable → navigate
  `/listings/[id]?kind=primary&purpose=…` (mirrors the secondary branch).
- Remove the stale "primary listings have no mobile detail yet" note.

## Out of scope

- Editing (parked).
- No standalone primary component — same `ListingDetailScreen`.
- No backend changes.
- FAQ/SEO/location-category rendering beyond what the shared sections already do.

## Verify

`tsc --noEmit` + eslint. Manual QA: open a primary listing (developer/project/
availability + project specs show; price from publicPrice) and a secondary
listing (unchanged).
