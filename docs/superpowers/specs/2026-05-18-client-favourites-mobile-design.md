# Client Favourites (Mobile) — Design

**Date:** 2026-05-18
**Status:** Approved (design)
**Repo:** `boh-mobile`

## Problem

The backend exposes client favourites APIs (`boh-lead-magnet-backend/src/modules/client-favorites/client-favorites.controller.ts`):

- `POST /api/v1/client/favorites` — body `{ kind, id }`, `kind ∈ listing | project | opportunity_listing`
- `GET /api/v1/client/favorites?kind=&page=&limit=&propertyUse=` — `kind ∈ listing | project | opportunity_listing | all`
- `DELETE /api/v1/client/favorites/:kind/:id`

All require JWT auth **and** the `customer` role (`CustomerRoleGuard`). Internal staff (admin/agent) are 403'd.

The mobile app currently has a **dummy** heart button (local `useState` only, no API) on project cards, a placeholder Favourites screen ("coming soon"), and no client-specific tab set. We need to wire the favourites feature end to end for client (`customer` role) users.

## Scope (v1)

- **Projects + listings.** Heart works for both project cards and listing cards. Favourites page lists both.
- `opportunity_listing` is **out of scope** — the backend `all` response includes it; the UI drops it.
- Heart active in two surfaces: **card overlay** (project cards in Home/listing feed, listing cards in project detail) **and the project detail page**.

## Client detection (RBAC)

Backend source of truth = role code `customer` (`CustomerRoleGuard` queries `UserRole` for role `customer`). The `UserType` enum has a `client` value, but signup (`auth.service.ts`) only reliably assigns the **role**; `userType` defaults to `internal_user`. Therefore gate on **role `customer`**, never `user.userType`.

Changes:

- `src/lib/rbac/roles.ts` — add `CUSTOMER: 'customer'` to `ROLES`.
- `src/lib/rbac/use-role.ts` — add `isCustomer: boolean` to `UseRoleResult` (via `hasRole(user, ROLES.CUSTOMER)`).

## Feature module

New module `src/features/favorites/`:

| File                                 | Purpose                                                                                                                                                                                                                     |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`                           | Mirror backend DTOs: `FavoriteResourceKind`, `ClientFavoriteProjectItem`, `ClientFavoriteListingItem`, `PaginatedClientFavoriteProjects`, `PaginatedClientFavoriteListings`, `ClientFavoriteAllResponse`                    |
| `services.ts`                        | `addFavorite(kind, id)` → `POST /api/v1/client/favorites`; `removeFavorite(kind, id)` → `DELETE /api/v1/client/favorites/:kind/:id`; `getFavorites({ kind, page, limit })` → `GET /api/v1/client/favorites`                 |
| `hooks/keys.ts`                      | Query keys: `favoritesKeys.list(kind)`, `favoritesKeys.snapshot()`                                                                                                                                                          |
| `hooks/use-favorite-snapshot.ts`     | Single query `kind=all limit=100` → derives `favoriteProjectIds: Set<string>` + `favoriteListingIds: Set<string>` for card heart-fill. `enabled: isAuthenticated && isCustomer`                                             |
| `hooks/use-favorites-list.ts`        | Two `useInfiniteQuery` instances (`kind=project`, `kind=listing`) for the Favourites page — mirrors the existing `use-public-projects` infinite pattern (`PAGE_SIZE`, `getNextPageParam` on `page < totalPages`)            |
| `hooks/use-toggle-favorite.ts`       | `useMutation`; optimistic update of the snapshot Set; on settle invalidate `['favorites', ...]`; on error revert Set + `console.warn`                                                                                       |
| `components/FavoriteHeartButton.tsx` | Shared heart. Props `{ kind: FavoriteResourceKind; id: string; className?; size? }`. Guest → `useAuthPromptStore().open()`. Authed customer → toggle via mutation, fill from snapshot. Authed non-customer → renders `null` |
| `components/FavoriteProjectCard.tsx` | Card for a `ClientFavoriteProjectItem` on the Favourites page (its DTO shape differs from `PublicProjectListItem`)                                                                                                          |
| `components/FavoriteListingCard.tsx` | Card for a `ClientFavoriteListingItem` (wraps backend `PublicListingDto`)                                                                                                                                                   |

## Bottom tab bar

`src/features/new-projects/components/BottomTabBar.tsx` — add a third branch to the `TABS` `useMemo`:

- **guest** (`!isAuthenticated`) → `PUBLIC_TABS` (unchanged: Favourites / Home / Profile; `requiresAuth` opens the auth prompt).
- **authed + customer** → new `CUSTOMER_TABS = [Favourites, Home, Profile]` — same three, but no `requiresAuth` (all functional).
- **authed + non-customer** → `AUTHED_TABS` (unchanged, permission-gated).

`/favourites` is already in `TAB_PATHS` in `app/_layout.tsx` — no root-layout change. Tab count ≤ 5, within the existing `MAX_TABS` shared-value budget.

## Heart wiring (3 surfaces)

1. **Project card overlay** — `src/features/new-projects/components/listing-card/ProjectCardOverlay.tsx`: delete the dummy `useState`/`handleHeartPress` and the inline guest-prompt logic; replace the `Pressable` heart with `<FavoriteHeartButton kind="project" id={project.projectId} />`. The shared button absorbs the guest-prompt behaviour, so existing guest UX is preserved.
2. **Project detail** — `src/features/new-projects/components/ProjectDetailScreen.tsx`: overlay `<FavoriteHeartButton kind="project" id={data.projectId} />` top-right of the `HeroCarousel` (absolute-positioned, same visual treatment as the card overlay heart).
3. **Listing card** — `src/features/new-projects/components/detail/ListingsSection.tsx` `ListingCard`: add `<FavoriteHeartButton kind="listing" id={item.id} />` as an absolute top-right overlay on the card image.

## Favourites page

Replace the placeholder `app/(app)/favourites.tsx`. A `SectionList` with two sections — **Projects** first, then **Listings** — each backed by its own infinite query from `use-favorites-list`, each with its own footer "loading more" spinner and `onEndReached`. Reuse the `EmptyState` / `RefreshControl` styling pattern from `ProjectListing.tsx`. Respect `insets.top + MAIN_HEADER_HEIGHT` top padding (the global `MainHeader` renders over it, same as the current placeholder).

- Tap project card → `router.push('/new-projects/[slug]')`.
- Tap listing card → **navigates to the parent project detail** via the `new-projects/[slug]` route using the listing's `project.slug`.

  Implementation note (2026-05-18): the originally-specced `(public)/projects/[id]` compound route — copied from the `ListingsSection` `ListingCard` — does not exist in the app. `app/(public)/` only contains `new-projects/[slug].tsx`; `ListingsSection`'s push to the compound route uses an `as never` cast and is itself dead navigation. Routing favourite-listing taps to the working project detail page is the correct, working behavior; the spec's prior instruction was based on a stale/missing route.

- Each card shows a **filled** heart that un-favourites (optimistic removal from the list + snapshot).
- Empty: friendly "No favourites yet" with a hint to browse projects.
- A non-customer reaching `/favourites` directly (not via tabs) sees a non-crashing empty state ("Sign in as a client to use favourites"); queries stay disabled.

## Data flow & errors

- **Toggle:** optimistic mutate of the snapshot Set (add/remove id) → fire API → `onSettled` invalidate `favoritesKeys.snapshot()` + `favoritesKeys.list('project')` + `favoritesKeys.list('listing')` → `onError` revert the Set and `console.warn` (no toast library in the codebase; matches the `auth.store` `console.warn` convention).
- **Snapshot** inherits the global 5-min `staleTime`; invalidated on every toggle so card fill stays consistent.
- All favourites queries: `enabled: isAuthenticated && isCustomer`.
- `apiClient` base URL already includes host; paths are written with the `/api/v1/...` prefix (consistent with `new-projects/services.ts`). The axios interceptor injects the bearer token; a 401 already triggers global refresh/logout — no per-call handling needed.

## Out of scope

- `opportunity_listing` favourites UI.
- `propertyUse` filter on the Favourites page.
- Reordering / sort controls on the Favourites page.
- Any backend change (APIs already exist).

## Verification

No test runner in `boh-mobile` (documented in `boh-mobile/CLAUDE.md`; user rejects TDD here). Gate:

```bash
pnpm lint
pnpm format:check
pnpm exec tsc --noEmit   # or the repo's type-check entry
```

Manual QA checklist:

1. Guest taps heart on a project card → auth prompt opens (existing behaviour intact).
2. Sign in as a `customer` user → bottom bar shows exactly Favourites / Home / Profile.
3. Favourite a project from a card → heart fills; appears on Favourites page → Projects.
4. Favourite a listing from project detail → heart fills; appears on Favourites page → Listings.
5. Favourite from the project detail hero heart → reflected on the card heart (shared snapshot).
6. Un-favourite from the Favourites page → row removed, card heart un-fills.
7. Sign in as a non-customer (e.g. agent) → no Favourites tab; heart buttons render nothing.
8. Kill network mid-toggle → heart reverts, no crash.
