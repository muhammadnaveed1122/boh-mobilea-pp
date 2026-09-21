# Mobile Project Comparison — Design

**Date:** 2026-06-24
**Repo:** boh-mobile
**Builds on:** the mobile Project Listing feature (2026-06-24-mobile-project-listing).

## Goal

Mirror the web project-comparison feature on mobile, in a mobile-native manner: select up
to 4 projects from the Project List, then view them side by side in a horizontally
scrollable comparison grid with a frozen label column, grouped sections, and best-value
highlighting.

## Reference: web compare

Web (`boh-lead-magnet/src/features/projects/compare/`) flow: in-list selection (max 4) →
sticky `CompareBar` → `CompareModal` of side-by-side columns. Rows grouped into **Key facts**
(starting price [best=min "Lowest"], booking fee, availability, construction stage, handover
[best=earliest "Soonest"], location, developer, lifestyle tier, property use) and **Inventory**
(unit types, floor plans, amenities, payment plans). Data hydrated from project-by-id,
unit-types, payment-plans, and the public-page amenities.

## 1. Selection state — `src/features/projects/store/compare.store.ts` (Zustand)

```
interface CompareItem { id: string; label: string; subLabel?: string; imageUrl?: string | null }
state: {
  compareMode: boolean;
  items: CompareItem[];               // max 4, insertion order
  setCompareMode(on: boolean): void;  // turning off also clears items
  toggle(item: CompareItem): void;    // add if absent & < MAX; remove if present
  remove(id: string): void;
  clear(): void;
}
const COMPARE_MAX = 4;
// selectors: isSelected(id), canCompare = items.length >= 2
```

Store-owned so selection survives list refetches and the navigation to the compare route.

## 2. Entry + selection on the Project List

- `ProjectListScreen` header gains a **Compare** toggle button (right of the title). Toggling
  sets `compareMode`; turning it off clears the selection.
- `AreaListingCard` gains optional props `selectable?: boolean`, `selected?: boolean`,
  `onToggleSelect?: () => void`. When `selectable`:
  - the card press calls `onToggleSelect` instead of navigating, and
  - a checkbox circle overlays the hero **top-right** (the `+N` count shifts to bottom-right
    while selectable to avoid collision).
  - Areas usage omits these props → unchanged.
- `ProjectListScreen` passes `selectable={compareMode}`, `selected={isSelected(item.id)}`,
  `onToggleSelect={() => toggle({ id, label: title, subLabel: area, imageUrl: imageUrls[0] })}`.

## 3. CompareBar — `src/features/projects/components/CompareBar.tsx`

Floating bottom bar, only when `compareMode && items.length > 0`. Safe-area aware. Shows up to
4 hero thumbnails (each with a small ✕ to remove), a **Clear** text button, and a primary
**Compare (N)** button disabled when `items.length < 2`. Compare → `router.push('/project-management/compare')`.

## 4. Data layer

### New service — `getProjectAmenities(id)` in `projects/services.ts`

```
GET /api/v1/projects/{id}/public-page
→ data.sections.amenities.items[] (each { name, isVisible })
returns string[] of visible amenity names ([] on any miss)
```

### New service — `getCompareProject(id): Promise<CompareProject>`

`Promise.all` of `getProjectById`, `getProjectUnitTypes`, `getProjectPaymentPlans`,
`getProjectAmenities`. Returns a normalized `CompareProject`:

```
interface CompareProject {
  id: string;
  name: string;            // projectName
  imageUrl: string | null; // heroImageUrls[0]
  startingPrice: number | null;
  bookingFee: number | null;        // reservationFee
  availability: string | null;
  developmentStage: string | null;
  handoverDate: string | null;
  location: string;                 // stateName ?? ''
  developer: string;                // developer.brandName ?? '—'
  lifestyleTier: string | null;
  propertyUse: string | null;
  unitTypes: string[];              // distinct UnitType.unitType labels
  floorPlanCount: number;           // sum of layouts across unit types
  amenities: string[];
  paymentPlans: { name: string; status: string; milestones: { label: string; percent: number }[] }[];
}
```

### Hook — `use-compare-data.ts`

TanStack `useQueries` over the selected ids, each `{ queryKey: ['projects','compare',id],
queryFn: () => getCompareProject(id), staleTime: 60_000 }`. Returns `{ projects: CompareProject[],
isLoading }` (projects in selection order, dropping failed/loading slots until resolved).

## 5. Compare row definitions — `src/features/projects/compare/compare-rows.ts`

```
type Best = 'min' | 'earliest' | undefined;
interface CompareRow {
  key: string;
  label: string;
  section: 'key_facts' | 'inventory';
  value(p: CompareProject): { raw: number | string | null; display: string };
  best?: Best;          // highlight winning column
  bestTag?: string;     // 'Lowest' | 'Soonest'
}
```

Rows (display via shared formatters — money `AED 1,234,567` / DASH `—`, titleCase enums):

- **key_facts:** startingPrice (best min, "Lowest"), bookingFee, availability, constructionStage
  (developmentStage), handover (best earliest, "Soonest"), location, developer, lifestyleTier,
  propertyUse
- **inventory:** unitTypes (display "N types"), floorPlans (display "N floor plans"), amenities
  (display "N amenities"), paymentPlans (display "N plan(s)")

Best-value computation: for `min`, the numerically smallest non-null `raw` wins; for `earliest`,
the smallest parseable date wins. Ties → no highlight (avoid misleading single-winner).

## 6. Compare screen — `src/features/projects/components/ProjectCompareScreen.tsx`

Route: `app/(app)/project-management/compare.tsx` → reexports it.

- Header: back button + "Compare" title.
- Guard: if `< 2` items, show an EmptyState ("Pick at least 2 projects to compare") and a back action.
- Body: a horizontal `ScrollView`. Layout = a **frozen label column** (fixed width ~120, lists
  every row label grouped by section header) rendered outside the horizontal scroll, and the
  **project columns** inside the horizontal scroll. Both share identical row heights so rows line
  up — achieved by rendering section/row structure once per column and pinning the label column
  to the left.
  - Implementation: outer `View flex-row`; left = `LabelColumn` (sticky), right = horizontal
    `ScrollView` containing each project column (`width ~46% of screen`, snap). Row heights kept
    consistent by a shared `ROW_H`/section constants and `numberOfLines` clamping.
  - Column header: hero thumbnail, project name (2 lines), ✕ remove (calls `remove(id)`; when
    count drops below 2, navigate back), and a "View" link → `/project-management/{id}`.
  - Each row cell: the row's `display` for that project; when the row has a `best` and this column
    wins, cell gets `bg-primary/10` and a small `bestTag` badge (text + color, not color-only).
  - Section headers ("Key Facts", "Inventory") span the row band as muted labels.
- Loading: skeleton columns while `isLoading`.

## 7. ui-ux-pro-max compliance

- Touch targets ≥44pt (remove ✕ uses hitSlop; View link is a full-height pressable).
- Horizontal scroll only in the comparison grid (a deliberate data-table affordance), never on the
  list. Snap to column width; frozen label column preserves context.
- Best-value conveyed by **badge text + tint**, never color alone (`color-not-only`).
- Tabular figures for prices (`tabular-nums`).
- Safe-area insets on CompareBar and screen header/footer.
- Skeletons for >300ms loads; empty state with guidance when `< 2`.
- Semantic tokens only; light/dark via existing theme.

## Out of scope

- Sharing/exporting a comparison.
- Comparing across listings (owner/CRM) — projects only.
- Editing projects from the compare view (read-only; only "View" navigation).

## Open items resolved

- Amenities endpoint: `GET /api/v1/projects/{id}/public-page` → `sections.amenities.items`.
- Max compare = 4 (matches web); 2 columns visible per viewport with horizontal scroll.
- All comparable fields already available from mobile services except amenities (new service added).
