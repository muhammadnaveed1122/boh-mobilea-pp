# Areas feature + More tab — Design

**Date:** 2026-06-23
**Repo:** `boh-mobile` (Expo Router, React Native 0.81, Expo SDK 54, NativeWind, TanStack Query, Zustand)

## Goal

Port the web Areas **list** page (`https://qa.rhkproperties.com/my-account/areas`) into the mobile app, and replace the `Profile` bottom tab with a `More` tab that opens a bottom sheet linking to the Areas screen.

Profile remains reachable via the existing header avatar (`src/components/organisms/MainHeader.tsx:41`), so demoting the Profile tab loses no access.

## Scope

**In scope**

- Areas **list** screen: search, city (state) filter, property-type filter, infinite-scroll grid of neighbourhoods showing new/sell/rent counts.
- `More` tab replacing `Profile` in `AUTHED_TABS` only.
- A store-driven `More` bottom sheet listing nav rows (Areas now; extensible later).
- Permission gating on `areas:read` (`PERMISSIONS.AREAS_READ`, already mirrored in mobile rbac).

**Out of scope**

- Area **detail** screen (web `/my-account/areas/[id]` with new/sell/rent listing tabs + pagination).
- Area card tap navigation (cards are non-interactive for now).
- Changes to customer/public tab sets (they keep their Profile tab; they lack `areas:read` anyway).

## Reference: web behaviour being ported

- Route `/my-account/areas` (`boh-lead-magnet/src/app/my-account/areas/page.tsx`).
- Responsive grid of `NeighbourhoodCard` (image 16:9, name, three counters: New / Sell / Rent).
- Toolbar: text search, city dropdown (`/locations/states`), property-type dropdown (`usePropertyTypeOptions`), reset-filters button when any filter active.
- Infinite scroll via `IntersectionObserver` (100 items/page) — `useNeighbourhoodsInfiniteScroll`.
- Permission guard: `areas:read`, else `<PermissionDenied />`.

### Data shapes (mirror web models)

```ts
interface Neighbourhood {
  id: string;
  name: string;
  slug: string;
  state: State;
  image?: string | null;
  imageAltText?: string | null;
  counts?: { new: number; sell: number; rent: number };
  createdAt: string;
  updatedAt: string;
}
interface State {
  id: string;
  name: string;
  slug: string;
}
interface NeighbourhoodsMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
```

## Backend

Same NestJS API the web app uses. Endpoints already reachable from mobile (`src/features/leads/services.ts` uses them, but flattens to id/name and drops counts/image — Areas needs its own service preserving the full shape + pagination):

- `GET /api/v1/locations/neighbourhoods?page&limit&search&stateId&propertyType` → `{ items: Neighbourhood[], meta: NeighbourhoodsMeta }` (items include `counts` + `image`).
- `GET /api/v1/locations/states?limit=100&sortOrder=asc&search` → states list.
- `GET /api/v1/platform-settings/property-types` → property-type options (for the property-type filter), with a static fallback list mirroring web's `usePropertyTypeOptions` so the filter never renders empty.

Auth token injected automatically by `apiClient` request interceptor (`src/lib/api.ts`).

## Architecture

### More tab + sheet

- **Store:** `src/store/more-sheet.store.ts` — zustand `{ present(), dismiss() }` (matches existing `useAuthPromptStore` pattern).
- **Sheet:** `src/features/more/components/MoreSheet.tsx` — `@gorhom/bottom-sheet` `BottomSheetModal` (provider already mounted at `app/_layout.tsx:194`). Renders a list of nav rows. The **Areas** row is shown only when `useCan(PERMISSIONS.AREAS_READ)`; pressing it calls `dismiss()` then `router.push('/(app)/areas')`. Built as a simple row list so future links drop in without restructuring.
- **Mount:** render `<MoreSheet/>` in `app/_layout.tsx` next to `GlobalTabBar` (both inside the gorhom + gesture-handler providers).
- **Tab bar:** in `src/features/new-projects/components/BottomTabBar.tsx`, replace the `AUTHED_TABS` `profile` entry with `{ key: 'more', label: 'More', icon: 'Menu', href: '/more' }`. In the tab `onPress`, special-case `tab.key === 'more'` → `useMoreSheetStore.getState().present()` (or a hook) instead of `router.navigate(...)`. The More tab is transient and never shows an active highlight (its `href` matches no path — acceptable).

### Areas feature (`src/features/areas/`)

- `models/area.ts` — `Neighbourhood`, `State`, `NeighbourhoodsMeta`, query-param type.
- `services.ts`
  - `getNeighbourhoodsPage({ page, limit, search, stateId, propertyType })` → typed `{ items, meta }` from `/api/v1/locations/neighbourhoods`.
  - `getStates({ search })` → `State[]`.
  - `getAreaPropertyTypes()` → option list from `/api/v1/platform-settings/property-types` with static fallback.
- `hooks/`
  - `use-neighbourhoods-infinite.ts` — TanStack `useInfiniteQuery`; `getNextPageParam` returns `meta.page + 1` while `meta.page < meta.totalPages`. Query key includes `{ search, stateId, propertyType }` so filter changes reset paging.
  - `use-area-states.ts`, `use-area-property-types.ts`.
- `components/`
  - `AreasScreen.tsx` — `FlatList` (2-column grid), `ListHeaderComponent` = filter toolbar, `onEndReached` → `fetchNextPage`, loading skeletons (initial) + footer spinner ("Loading more areas…"), empty state.
  - `AreaCard.tsx` — image (16:9, fallback placeholder), name, three count chips (New / Sell / Rent). Non-interactive.
  - `AreaFilters.tsx` — debounced search `TextInput`; City selector and Property-type selector implemented as `BottomSheetModal` pickers following the existing `PrioritySelector` pattern; reset-filters button shown when any filter active.
- **Route:** `app/(app)/areas.tsx` renders `AreasScreen`. Add `<Stack.Screen name="areas" />` to `app/(app)/_layout.tsx` (default push slide). Screen-level guard on `AREAS_READ`; render a permission-denied view otherwise.

## Data flow

`AreasScreen` FlatList → `useInfiniteQuery` (page 1, limit 100) → flatten `pages[].items`. `onEndReached` triggers `fetchNextPage` when `hasNextPage`. Search input is debounced; `search` / `stateId` / `propertyType` live in screen state and feed the query key, so changing a filter refetches from page 1. Each card renders its own `counts`.

## Styling / conventions

NativeWind semantic tokens (`bg-background`, `bg-card`, `text-muted-foreground`, `border-border`); `cva` for variant-y atoms; lucide icons via `@/components/atoms/Icon`; `useBottomTabBarSpace()` for bottom content padding. No new dependencies.

## Verification (no unit tests — per project rule)

- `tsc` clean + lint clean.
- Manual QA: authed user sees **More** tab (Menu icon) where Profile was; tapping opens the sheet; **Areas** row visible only with `areas:read`; Areas screen loads the grid; search, city, and property-type filters work and reset paging; infinite scroll loads more pages; reset-filters clears all; header avatar still opens Profile.
