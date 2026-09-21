# Mobile Project Listing — Design

**Date:** 2026-06-24
**Repo:** boh-mobile

## Goal

Add a top-level Project Listing screen to the mobile app, mirroring the web page at
`/my-account/project-management`. Reuse the existing project card (`AreaListingCard`) and
project detail screen (`project-management/[id].tsx`) that the Areas drill-in already uses.

Mobile scope: **read-only** — search + filter only. No edit, no delete, no create.

## Reference: web listing columns

The web row shows: Name (+developer brand), Public Page Name, **State**, **Status**
(+publicPageStatus), **Type** (availability), **Handover**, **Last Update**, **Trakheesi QA**
(permit status + QR). The mobile card already covers state (`area`), last update (relative time),
and handover. Missing on the mobile card: **Status**, **Type**, **Trakheesi QA**.

## 1. Entry point

The Areas screen is reached via the **More** bottom-tab sheet (`MoreSheet.tsx` `rows` array).
Add a sibling row next to Areas:

```ts
{ key: 'projects', label: 'Project List', icon: Building2, href: '/(app)/project-management', visible: canProjects }
```

- Gate `canProjects` with the project-read permission (match the web `PROJECT_PERMISSION` read gate;
  use the mobile permissions equivalent).
- New route file `app/(app)/project-management/index.tsx` → reexports `ProjectListScreen`.
- Tapping a card opens the existing `app/(app)/project-management/[id].tsx` detail
  (`AreaListingCard` already routes `projectId` → `/project-management/{id}`). No new detail work.
- No edit/delete/create actions anywhere on the screen.

## 2. Screen — `src/features/projects/components/ProjectListScreen.tsx`

Structural clone of `AreasScreen.tsx`:

- `FlatList` rendering `AreaListingCard`.
- `useProjectsInfinite(filters)` (TanStack `useInfiniteQuery`).
- Pagination: `onEndReached` → `fetchNextPage()` when `hasNextPage && !isFetchingNextPage`.
- Pull-to-refresh: `onRefresh` → `refetch()`.
- Empty / loading / error states matching the Areas screen patterns.
- Renders `ProjectFilters` (see §5) above the list.

## 3. Data layer

### Service — `src/features/projects/services.ts`

Add `getProjectsPage(filters, page)`:

```
GET /api/v1/projects
params: { page, limit, search, status, availability, stateId, developerId,
          sortBy: 'updatedAt', sortOrder: 'desc' }
```

Omit any param that is unset. Map each `Project` row → `AreaListingItem` using the same field
mapping as `mapProjectRow` (areas/services.ts), **plus** the new optional fields in §4. Set
`projectId = row.id`, `listingId = null`, `secondaryLabel = 'Developer'`.

### Hook — `src/features/projects/hooks/use-projects-infinite.ts`

`useInfiniteQuery` with `queryKey: ['projects', 'list', filters]`, `initialPageParam: 1`,
`getNextPageParam: page < totalPages ? page + 1 : undefined`, `staleTime: 60_000`.

### Model — extend `src/features/projects/models.ts` `Project`

Add fields the backend already returns but the mobile model omits:

```ts
status?: string | null;                 // 'draft' | 'published' | 'archived'
availability?: string | null;           // 'off_plan' | 'ready' | 'sold_out'   (already present? confirm)
trakheesiPermitStatus?: string | null;  // 'not_applied' | 'applied' | 'approved' | 'rejected' | 'expired'
trakheesiQrCodeUrl?: string | null;
```

(`availability` may already exist on the model — keep one definition.)

## 4. Card extension — `AreaListingItem` + `AreaListingCard`

All additions are **optional** so the Areas usage is unaffected (props simply omitted).

Extend `AreaListingItem` (areas/models/area-detail.ts):

```ts
readonly status?: string;             // project status
readonly availabilityType?: string;  // off_plan / ready / sold_out
readonly trakheesiPermit?: string;    // permit status
readonly trakheesiQrCodeUrl?: string | null;
```

Card rendering:

- **Keep the existing 6-cell grid intact.** Do not repurpose the Service Charge cell.
- Add a **separate badge row** (rendered only when any of the new props are present):
  - **Status** pill (colored by status).
  - **Type** pill (availability label).
  - **Trakheesi QA**: permit-status pill **plus** a small QR-code thumbnail when
    `trakheesiQrCodeUrl` is present (matches web). Show an "Expired" treatment when status is expired.
- When no new props are passed (Areas screen), the badge row does not render → layout unchanged.

## 5. Filters — `src/features/projects/components/ProjectFilters.tsx`

Modeled on `AreaFilters.tsx` + `AreaOptionSheet.tsx` (bottom-sheet single-select).

Filter state: `{ search?, status?, availability?, stateId?, developerId? }`

- **Search** — debounced 350ms text input (maps to `search`).
- **Status** — single-select, static options: draft / published / archived.
- **Type** — single-select, static options: off_plan / ready / sold_out.
- **State** — single-select via existing `useAreaStates()` (`GET /api/v1/locations/states`).
- **Developer** — single-select via **new** `useDevelopers()` hook. Endpoint
  `GET /api/v1/developers` (verify exact path/shape during implementation; web uses a developer list).
- **Reset** button clears all filters.

## Out of scope

- Edit / delete / create projects.
- Public Page Name column (not needed on mobile card).
- Any change to the Areas screen behavior or the project detail screen.

## Open item to verify during implementation

- Exact developer-list endpoint + response shape (`GET /api/v1/developers` assumed).
- Exact mobile project-read permission constant for the More-row gate.
