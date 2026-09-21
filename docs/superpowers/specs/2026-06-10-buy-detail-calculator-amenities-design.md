# Buy Detail — Mortgage/ROI Calculator + Project-style Amenities

**Date:** 2026-06-10
**Status:** Approved (design)

## Goal

Bring the web `/buy-with-us/<slug>` detail page features to the mobile buy detail
screen:

1. Add a **Mortgage + ROI calculator** (currently missing on mobile).
2. Replace the existing simple amenities section with the richer **project
   `AmenitiesSection`** (carousel UI), fed from the buy item's amenities data.

## Context

- Mobile "buy" tab is a **mixed feed** (buy-project listings + opportunity
  listings). Both kinds render through the same screen:
  [PropertyDetailScreen.tsx](../../../src/features/properties/components/PropertyDetailScreen.tsx).
  Both features therefore land on one screen and cover both kinds.
- Web equivalent: `/buy-with-us/<slug>` (opportunity listing). It shows a tabbed
  **Mortgage Calculator | ROI Calculator** plus a project-style amenities carousel.
- Mobile currently has **no** finance calculator anywhere.
- Numeric price for seeding: `PropertyDetail.price` (AED, `0` when unknown),
  populated for both kinds by
  [normalize-detail.ts](../../../src/features/properties/utils/normalize-detail.ts).

## 1. Calculator

New component dir `src/features/properties/components/detail/PropertyCalculator/`:

- `PropertyCalculator.tsx` — segmented tabs **Mortgage | ROI** (default Mortgage),
  pure React Native, no web deps. Seeds Property Value from `PropertyDetail.price`.
- `calculations.ts` — pure math util, ported verbatim from web.

### Mortgage

Inputs:

| Field                | Default          | Control                                     |
| -------------------- | ---------------- | ------------------------------------------- |
| Property Value (AED) | `price` (else 0) | formatted numeric input                     |
| Down Payment         | 20%              | slider 0–100 + amount input (bidirectional) |
| Loan Period          | 12 yrs           | dropdown `[5,6,7,8,9,10,11,12,15,20,25,30]` |
| Interest Rate        | 4%               | stepper ±0.5                                |

Formula:

```
downPayment = value * pct/100
loan        = value - downPayment
n           = years * 12
r           = (rate/100) / 12
monthly     = r > 0 ? loan*r*(1+r)^n / ((1+r)^n - 1) : loan / n
totalRepay  = monthly * n
totalInterest = totalRepay - loan
```

Outputs: Monthly Payment (prominent), No. of Payments, Loan Amount,
Total Interest Paid, Property Price, Total Repayment Amount.

### ROI

Inputs:

| Field                        | Default                  |
| ---------------------------- | ------------------------ |
| Property Value (AED)         | `price` (else 0)         |
| DLD Fee                      | 4% (fixed, non-editable) |
| Other Costs (AED)            | 1,200                    |
| Annual Rent (AED)            | 60,000                   |
| Annual Service Charges (AED) | 1,200                    |
| Other Annual Costs (AED)     | 2,500                    |

Formula:

```
transferFee = value * 4/100
oneTime     = transferFee + otherCosts
totalAcq    = value + oneTime
opex        = svcCharges + otherAnnual
noi         = annualRent - opex
gross %     = annualRent / value * 100
net %       = noi / value * 100
coc %       = noi / totalAcq * 100
```

Outputs: NOI, Gross Yield %, Net Yield %, Cash-on-Cash %, One-time Costs,
Total Acquisition Cost, Total Cash Invested, Annual Rent, Annual OpEx.

Edge cases: guard `value <= 0` (show 0 / dashes, no divide-by-zero). AED
formatting via existing mobile formatter (reuse whatever About/Header uses).

## 2. Amenities — reuse project `AmenitiesSection`

Swap `PropertyAmenities` for project
[AmenitiesSection.tsx](../../../src/features/new-projects/components/detail/AmenitiesSection.tsx)
(props `amenities: ProjectAmenitiesSection | null`).

Shape mismatch — buy gives `PropertyAmenityItem[]`
(`{id,name,slug,icon?,description?,media:{type,url,altText?}[]}`); project wants
`ProjectAmenitiesSection` with richer items + `ProjectMediaItem` media.

**Adapter** (new util, e.g. `src/features/properties/utils/to-project-amenities.ts`):

```
toProjectAmenities(amenities?: PropertyDetail['amenities']): ProjectAmenitiesSection | null
```

Mapping:

- per item: `amenityId = id`, `isCustom = false`, `isVisible = true`,
  `sortOrder = idx`, `description = description ?? ''`, `icon = icon ?? null`.
- media `{type,url,altText?}` → `{id: `${itemId}-m${idx}`, mediaUrl: url,
mediaType: type, sortOrder: idx, altText}`.
- section: `title`, `tagline` passthrough; `selectedCount = totalCount =
items.length`.
- returns `null` when no items.

Rationale: adapter over editing the shared project component → project detail
screen untouched, zero regression. `AmenitiesSection` already falls back to
default slider images when media empty.

## 3. Placement

Render order in `PropertyDetailScreen`:

```
Hero → Header → Attributes → About → Amenities(new) → Location
     → Calculator(new) → Trakheesi → FAQ → Agent
```

Amenities stays in place (upgraded component); Calculator inserted after Location,
before Trakheesi — matches web flow (calculator low on page).

## Files

New:

- `src/features/properties/components/detail/PropertyCalculator/PropertyCalculator.tsx`
- `src/features/properties/components/detail/PropertyCalculator/calculations.ts`
- `src/features/properties/utils/to-project-amenities.ts`

Edit:

- `src/features/properties/components/PropertyDetailScreen.tsx` (swap amenities
  component + adapter, insert calculator).

Untouched: backend, shared types, project detail screen, `PropertyAmenities.tsx`
(left in place / removable later if unused).

## Out of scope

- No backend changes; relies on existing normalized `price` + `amenities`.
- No new unit tests (per project convention — verify via tsc + lint + manual QA).
- ROI advanced financing (mortgage-funded ROI) not ported; cash-purchase model only,
  matching web's current listing ROI.

## Verification

- `tsc` clean, lint clean.
- Manual QA on a buy-project listing and an opportunity listing: calculator seeds
  price, tab switch works, math matches web for a sample input; amenities carousel
  renders with media and with empty-media fallback.
