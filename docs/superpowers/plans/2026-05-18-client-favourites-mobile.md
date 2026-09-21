# Client Favourites (Mobile) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing backend client-favourites API into the mobile app — functional heart buttons on project/listing cards + project detail, a client-only bottom tab set, and a real Favourites page.

**Architecture:** New `src/features/favorites/` module (types, services, TanStack Query hooks, shared components). A single "snapshot" query holds the set of favourited project/listing ids so every heart button derives fill state from one cache entry; a toggle mutation updates it optimistically. Two infinite queries back the Favourites page. RBAC gains a `customer` role check that drives a third bottom-tab variant.

**Tech Stack:** React Native 0.81 / Expo SDK 54, expo-router, TanStack Query v5, Zustand, NativeWind v4, axios (`apiClient`). Backend APIs already exist — no backend change.

**Testing note:** `boh-mobile` has no test runner (see `boh-mobile/CLAUDE.md`; project memory `no-unit-tests-boh-mobile`). Each task is verified with `pnpm exec tsc --noEmit` + `pnpm lint` and manual QA — there are deliberately no unit-test steps.

---

## File Structure

| File                                                                                | Responsibility                         |
| ----------------------------------------------------------------------------------- | -------------------------------------- |
| `src/lib/rbac/roles.ts` (modify)                                                    | Add `CUSTOMER` role code               |
| `src/lib/rbac/use-role.ts` (modify)                                                 | Expose `isCustomer`                    |
| `src/features/favorites/types.ts` (create)                                          | Backend DTO mirrors                    |
| `src/features/favorites/services.ts` (create)                                       | API calls                              |
| `src/features/favorites/hooks/keys.ts` (create)                                     | Query keys                             |
| `src/features/favorites/hooks/use-favorite-snapshot.ts` (create)                    | Favourited-id sets for heart fill      |
| `src/features/favorites/hooks/use-toggle-favorite.ts` (create)                      | Optimistic add/remove mutation         |
| `src/features/favorites/hooks/use-favorites-list.ts` (create)                       | Infinite lists for the Favourites page |
| `src/features/favorites/components/FavoriteHeartButton.tsx` (create)                | Shared heart (guest/customer/other)    |
| `src/features/favorites/components/FavoriteProjectCard.tsx` (create)                | Favourites-page project row            |
| `src/features/favorites/components/FavoriteListingCard.tsx` (create)                | Favourites-page listing row            |
| `src/features/new-projects/components/listing-card/ProjectCardOverlay.tsx` (modify) | Use shared heart                       |
| `src/features/new-projects/components/detail/HeroCarousel.tsx` (modify)             | Heart in hero action row               |
| `src/features/new-projects/components/ProjectDetailScreen.tsx` (modify)             | Pass `projectId` to hero               |
| `src/features/new-projects/components/detail/ListingsSection.tsx` (modify)          | Heart on listing card                  |
| `src/features/new-projects/components/BottomTabBar.tsx` (modify)                    | `CUSTOMER_TABS` branch                 |
| `app/(app)/favourites.tsx` (modify)                                                 | Real Favourites screen                 |

---

## Task 1: Add `customer` role to RBAC

**Files:**

- Modify: `src/lib/rbac/roles.ts`
- Modify: `src/lib/rbac/use-role.ts`

- [ ] **Step 1: Add `CUSTOMER` to the `ROLES` map**

In `src/lib/rbac/roles.ts`, change the `ROLES` object to include the customer code (keep existing entries):

```ts
export const ROLES = {
  SUPER_ADMIN: 'super-admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  AGENT: 'agent',
  DEVELOPER: 'developer',
  CUSTOMER: 'customer',
  END_USER: 'end-user',
} as const;
```

- [ ] **Step 2: Expose `isCustomer` from `useRole`**

In `src/lib/rbac/use-role.ts`, add `isCustomer: boolean;` to the `UseRoleResult` interface (after `isDeveloper`), and add `isCustomer: hasRole(user, ROLES.CUSTOMER),` to the returned object (after `isDeveloper`). `hasRole` and `ROLES` are already imported in that file.

- [ ] **Step 3: Type-check + lint**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.
Run: `pnpm lint src/lib/rbac/roles.ts src/lib/rbac/use-role.ts`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/rbac/roles.ts src/lib/rbac/use-role.ts
git commit -m "feat(rbac): add customer role + isCustomer selector"
```

---

## Task 2: Favourites types

**Files:**

- Create: `src/features/favorites/types.ts`

- [ ] **Step 1: Create the types file**

These mirror `boh-lead-magnet-backend/src/modules/client-favorites/dto/client-favorites.dto.ts` and `PublicListingDto`. Only the fields the UI needs are typed.

```ts
// src/features/favorites/types.ts
export enum FavoriteResourceKind {
  LISTING = 'listing',
  PROJECT = 'project',
}

export type FavoriteListKind = 'listing' | 'project' | 'all';

export interface FavoriteCreatedResponse {
  id: string;
  createdAt: string;
}

export interface ClientFavoriteProjectDeveloper {
  id: string;
  brandName: string;
  logoUrl: string | null;
}

export interface ClientFavoriteProjectItem {
  favoriteId: string;
  favoritedAt: string;
  inquirySent: boolean;
  projectId: string;
  projectName: string;
  slug: string | null;
  propertyUse: string | null;
  propertyType: string | null;
  locationLine: string | null;
  startingPrice: number | null;
  heroImageUrl: string | null;
  developer: ClientFavoriteProjectDeveloper;
}

export interface FavoriteListingProject {
  id: string;
  projectName: string;
  slug?: string | null;
}

export interface FavoriteListingUnitType {
  bedrooms: number;
  bathrooms?: number | null;
  sizeMin?: number | null;
  sizeMax?: number | null;
}

export interface FavoritePublicListing {
  id: string;
  title: string;
  price?: number | null;
  slug?: string | null;
  heroImageUrl?: string | null;
  project: FavoriteListingProject;
  unitType: FavoriteListingUnitType;
}

export interface ClientFavoriteListingItem {
  favoriteId: string;
  favoritedAt: string;
  inquirySent: boolean;
  listing: FavoritePublicListing;
}

export interface PaginatedFavorites<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type PaginatedClientFavoriteProjects = PaginatedFavorites<ClientFavoriteProjectItem>;
export type PaginatedClientFavoriteListings = PaginatedFavorites<ClientFavoriteListingItem>;

export interface ClientFavoriteAllResponse {
  listings: PaginatedClientFavoriteListings;
  projects: PaginatedClientFavoriteProjects;
  // backend also returns `opportunityListings` — intentionally omitted (out of scope)
}
```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.
Run: `pnpm lint src/features/favorites/types.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/favorites/types.ts
git commit -m "feat(favorites): add API types"
```

---

## Task 3: Favourites services

**Files:**

- Create: `src/features/favorites/services.ts`

Reference: `src/features/new-projects/services.ts` for the `apiClient` + `/api/v1/...` convention. The axios response interceptor unwraps the `{ success, data }` envelope, so `data` is the inner payload.

- [ ] **Step 1: Create the services file**

```ts
// src/features/favorites/services.ts
import { apiClient } from '@/lib/api';
import {
  type ClientFavoriteAllResponse,
  type FavoriteCreatedResponse,
  type FavoriteListKind,
  FavoriteResourceKind,
  type PaginatedClientFavoriteListings,
  type PaginatedClientFavoriteProjects,
} from './types';

const BASE = '/api/v1/client/favorites';

export async function addFavorite(
  kind: FavoriteResourceKind,
  id: string,
): Promise<FavoriteCreatedResponse> {
  const { data } = await apiClient.post<FavoriteCreatedResponse>(BASE, { kind, id });
  return data;
}

export async function removeFavorite(kind: FavoriteResourceKind, id: string): Promise<void> {
  await apiClient.delete(`${BASE}/${kind}/${encodeURIComponent(id)}`);
}

interface GetFavoritesParams {
  kind: FavoriteListKind;
  page: number;
  limit: number;
}

export async function getFavoriteProjects(
  page: number,
  limit: number,
): Promise<PaginatedClientFavoriteProjects> {
  const { data } = await apiClient.get<PaginatedClientFavoriteProjects>(BASE, {
    params: { kind: 'project', page, limit } satisfies GetFavoritesParams,
  });
  return data;
}

export async function getFavoriteListings(
  page: number,
  limit: number,
): Promise<PaginatedClientFavoriteListings> {
  const { data } = await apiClient.get<PaginatedClientFavoriteListings>(BASE, {
    params: { kind: 'listing', page, limit } satisfies GetFavoritesParams,
  });
  return data;
}

export async function getAllFavorites(
  page: number,
  limit: number,
): Promise<ClientFavoriteAllResponse> {
  const { data } = await apiClient.get<ClientFavoriteAllResponse>(BASE, {
    params: { kind: 'all', page, limit } satisfies GetFavoritesParams,
  });
  return data;
}
```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.
Run: `pnpm lint src/features/favorites/services.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/favorites/services.ts
git commit -m "feat(favorites): add API services"
```

---

## Task 4: Query keys

**Files:**

- Create: `src/features/favorites/hooks/keys.ts`

Reference pattern: `src/features/notifications/hooks/keys.ts`.

- [ ] **Step 1: Create the keys file**

```ts
// src/features/favorites/hooks/keys.ts
export const favoritesKeys = {
  all: ['favorites'] as const,
  snapshot: () => [...favoritesKeys.all, 'snapshot'] as const,
  list: (kind: 'project' | 'listing') => [...favoritesKeys.all, 'list', kind] as const,
};
```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm exec tsc --noEmit`
Run: `pnpm lint src/features/favorites/hooks/keys.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/favorites/hooks/keys.ts
git commit -m "feat(favorites): add query keys"
```

---

## Task 5: Snapshot hook

**Files:**

- Create: `src/features/favorites/hooks/use-favorite-snapshot.ts`

This is the single source of truth for "is X favourited?". One query (`kind=all`, `limit=100`) → two `Set<string>`.

- [ ] **Step 1: Create the hook**

```ts
// src/features/favorites/hooks/use-favorite-snapshot.ts
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRole } from '@/lib/rbac';
import { useAuthStore } from '@/store/auth.store';
import { getAllFavorites } from '../services';
import type { ClientFavoriteAllResponse } from '../types';
import { favoritesKeys } from './keys';

const SNAPSHOT_LIMIT = 100;

export interface FavoriteSnapshot {
  projectIds: Set<string>;
  listingIds: Set<string>;
}

export function useFavoriteSnapshot(): {
  snapshot: FavoriteSnapshot;
  isLoading: boolean;
  enabled: boolean;
} {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { isCustomer } = useRole();
  const enabled = isAuthenticated && isCustomer;

  const { data, isLoading } = useQuery<ClientFavoriteAllResponse>({
    queryKey: favoritesKeys.snapshot(),
    queryFn: () => getAllFavorites(1, SNAPSHOT_LIMIT),
    enabled,
  });

  const snapshot = useMemo<FavoriteSnapshot>(
    () => ({
      projectIds: new Set((data?.projects.items ?? []).map((p) => p.projectId)),
      listingIds: new Set((data?.listings.items ?? []).map((l) => l.listing.id)),
    }),
    [data],
  );

  return { snapshot, isLoading, enabled };
}
```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm exec tsc --noEmit`
Run: `pnpm lint src/features/favorites/hooks/use-favorite-snapshot.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/favorites/hooks/use-favorite-snapshot.ts
git commit -m "feat(favorites): add snapshot hook"
```

---

## Task 6: Toggle mutation hook

**Files:**

- Create: `src/features/favorites/hooks/use-toggle-favorite.ts`

Optimistically mutates the snapshot query cache, then invalidates favourites queries; reverts on error.

- [ ] **Step 1: Create the hook**

```ts
// src/features/favorites/hooks/use-toggle-favorite.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addFavorite, removeFavorite } from '../services';
import {
  type ClientFavoriteAllResponse,
  FavoriteResourceKind,
  type PaginatedFavorites,
} from '../types';
import { favoritesKeys } from './keys';

interface ToggleVars {
  kind: FavoriteResourceKind;
  id: string;
  /** Current favourited state (from the snapshot) — we flip it. */
  isFavorite: boolean;
}

function emptyPage<T>(): PaginatedFavorites<T> {
  return { items: [], total: 0, page: 1, limit: 100, totalPages: 0 };
}

export function useToggleFavorite(): ReturnType<
  typeof useMutation<void, Error, ToggleVars, { previous?: ClientFavoriteAllResponse }>
> {
  const qc = useQueryClient();

  return useMutation<void, Error, ToggleVars, { previous?: ClientFavoriteAllResponse }>({
    mutationFn: async ({ kind, id, isFavorite }) => {
      if (isFavorite) {
        await removeFavorite(kind, id);
      } else {
        await addFavorite(kind, id);
      }
    },
    onMutate: async ({ kind, id, isFavorite }) => {
      await qc.cancelQueries({ queryKey: favoritesKeys.snapshot() });
      const previous = qc.getQueryData<ClientFavoriteAllResponse>(favoritesKeys.snapshot());

      qc.setQueryData<ClientFavoriteAllResponse>(favoritesKeys.snapshot(), (old) => {
        const base: ClientFavoriteAllResponse = old ?? {
          projects: emptyPage(),
          listings: emptyPage(),
        };
        if (kind === FavoriteResourceKind.PROJECT) {
          const items = isFavorite
            ? base.projects.items.filter((p) => p.projectId !== id)
            : base.projects.items;
          return { ...base, projects: { ...base.projects, items } };
        }
        const items = isFavorite
          ? base.listings.items.filter((l) => l.listing.id !== id)
          : base.listings.items;
        return { ...base, listings: { ...base.listings, items } };
      });

      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(favoritesKeys.snapshot(), ctx.previous);
      }
      console.warn('[favorites] toggle failed; reverted');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: favoritesKeys.all }).catch(() => {});
    },
  });
}
```

Note: optimistic add for a not-yet-favourited item only flips the heart visually via the button's local override (see Task 7); the snapshot is reconciled by the `onSettled` invalidation refetch. Optimistic _remove_ prunes the item immediately so the Favourites page row disappears at once.

- [ ] **Step 2: Type-check + lint**

Run: `pnpm exec tsc --noEmit`
Run: `pnpm lint src/features/favorites/hooks/use-toggle-favorite.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/favorites/hooks/use-toggle-favorite.ts
git commit -m "feat(favorites): add optimistic toggle mutation"
```

---

## Task 7: Shared heart button

**Files:**

- Create: `src/features/favorites/components/FavoriteHeartButton.tsx`

Self-contained circular button. Parent positions it (pass `className`). Behaviour:

- guest → open auth prompt
- authed customer → toggle; fill from snapshot, with an instant local override so the tap feels immediate
- authed non-customer → render `null`

- [ ] **Step 1: Create the component**

```tsx
// src/features/favorites/components/FavoriteHeartButton.tsx
import { useState } from 'react';
import { Pressable } from 'react-native';
import { Icon } from '@/components/atoms/Icon';
import { cn } from '@/lib/utils';
import { useRole } from '@/lib/rbac';
import { useAuthStore } from '@/store/auth.store';
import { useAuthPromptStore } from '@/store/auth-prompt.store';
import { useFavoriteSnapshot } from '../hooks/use-favorite-snapshot';
import { useToggleFavorite } from '../hooks/use-toggle-favorite';
import { FavoriteResourceKind } from '../types';

interface Props {
  kind: FavoriteResourceKind;
  id: string;
  size?: number;
  className?: string;
}

export function FavoriteHeartButton({ kind, id, size = 18, className }: Readonly<Props>) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { isCustomer } = useRole();
  const openAuthPrompt = useAuthPromptStore((s) => s.open);
  const { snapshot } = useFavoriteSnapshot();
  const toggle = useToggleFavorite();
  const [override, setOverride] = useState<boolean | null>(null);

  // Authed users who are not portal customers cannot favourite — hide entirely.
  if (isAuthenticated && !isCustomer) return null;

  const set = kind === FavoriteResourceKind.PROJECT ? snapshot.projectIds : snapshot.listingIds;
  const isFavorite = override ?? set.has(id);

  function handlePress(): void {
    if (!isAuthenticated) {
      openAuthPrompt();
      return;
    }
    const next = !isFavorite;
    setOverride(next);
    toggle.mutate(
      { kind, id, isFavorite },
      {
        onError: () => setOverride(null),
        onSettled: () => setOverride(null),
      },
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      accessibilityLabel={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
      className={cn(
        'h-10 w-10 items-center justify-center rounded-full active:opacity-70',
        className,
      )}
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
    >
      <Icon name="Heart" size={size} color={isFavorite ? '#ef4444' : '#fff'} />
    </Pressable>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm exec tsc --noEmit`
Run: `pnpm lint src/features/favorites/components/FavoriteHeartButton.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/favorites/components/FavoriteHeartButton.tsx
git commit -m "feat(favorites): add shared heart button"
```

---

## Task 8: Wire heart into the project card overlay

**Files:**

- Modify: `src/features/new-projects/components/listing-card/ProjectCardOverlay.tsx`

- [ ] **Step 1: Replace the dummy heart**

Replace the entire file contents with:

```tsx
import { Image, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { FavoriteHeartButton } from '@/features/favorites/components/FavoriteHeartButton';
import { FavoriteResourceKind } from '@/features/favorites/types';
import { statusLabel } from '../../utils/format';
import { useProjectCard } from './ProjectCardContext';

export function ProjectCardOverlay() {
  const { project } = useProjectCard();
  const status = statusLabel(project.availability);
  const logo = project.developer?.developer_logo;

  return (
    <>
      {logo ? (
        <View className="absolute left-3 top-3 h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/95">
          <Image source={{ uri: logo }} className="h-full w-full" resizeMode="contain" />
        </View>
      ) : null}

      <FavoriteHeartButton
        kind={FavoriteResourceKind.PROJECT}
        id={project.projectId}
        className="absolute right-3 top-3"
      />

      {status ? (
        <View
          className="absolute bottom-3 left-3 flex-row items-center gap-1 rounded-full px-2.5 py-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
        >
          <View
            className={`h-1.5 w-1.5 rounded-full ${
              status === 'Ready' ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
          <Text className="text-[11px] font-semibold text-white">{status}</Text>
        </View>
      ) : null}
    </>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm exec tsc --noEmit`
Run: `pnpm lint src/features/new-projects/components/listing-card/ProjectCardOverlay.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/new-projects/components/listing-card/ProjectCardOverlay.tsx
git commit -m "feat(favorites): wire project card heart to API"
```

---

## Task 9: Wire heart into the project detail hero

**Files:**

- Modify: `src/features/new-projects/components/detail/HeroCarousel.tsx`
- Modify: `src/features/new-projects/components/ProjectDetailScreen.tsx`

- [ ] **Step 1: Add a `projectId` prop to `HeroCarousel`**

In `src/features/new-projects/components/detail/HeroCarousel.tsx`:

Add imports near the other feature imports:

```tsx
import { FavoriteHeartButton } from '@/features/favorites/components/FavoriteHeartButton';
import { FavoriteResourceKind } from '@/features/favorites/types';
```

Change the `Props` interface to add `projectId`:

```tsx
interface Props {
  hero: ProjectHeroSection | null;
  fallbackTitle?: string;
  shareUrl?: string;
  projectId?: string;
}
```

Update the function signature:

```tsx
export function HeroCarousel({ hero, fallbackTitle, shareUrl, projectId }: Readonly<Props>) {
```

In the top action row, add the heart before the Share button. Replace this block:

```tsx
<View className="flex-row gap-2">
  {currentIsVideo ? (
    <CircleButton
      icon={muted ? 'VolumeX' : 'Volume2'}
      onPress={() => setMuted((m) => !m)}
      label={muted ? 'Unmute' : 'Mute'}
    />
  ) : null}
  <CircleButton icon="Share2" onPress={handleShare} label="Share" />
</View>
```

with:

```tsx
<View className="flex-row gap-2">
  {currentIsVideo ? (
    <CircleButton
      icon={muted ? 'VolumeX' : 'Volume2'}
      onPress={() => setMuted((m) => !m)}
      label={muted ? 'Unmute' : 'Mute'}
    />
  ) : null}
  {projectId ? <FavoriteHeartButton kind={FavoriteResourceKind.PROJECT} id={projectId} /> : null}
  <CircleButton icon="Share2" onPress={handleShare} label="Share" />
</View>
```

(`FavoriteHeartButton`'s default circle is `rgba(0,0,0,0.35)` vs the local `CircleButton`'s `0.45` — visually consistent enough; no extra styling needed.)

- [ ] **Step 2: Pass `projectId` from `ProjectDetailScreen`**

In `src/features/new-projects/components/ProjectDetailScreen.tsx`, change the `HeroCarousel` usage from:

```tsx
<HeroCarousel hero={sections.hero} fallbackTitle={projectName} />
```

to:

```tsx
<HeroCarousel hero={sections.hero} fallbackTitle={projectName} projectId={projectId} />
```

(`projectId` is already declared as `const projectId = data.projectId;` in that component.)

- [ ] **Step 3: Type-check + lint**

Run: `pnpm exec tsc --noEmit`
Run: `pnpm lint src/features/new-projects/components/detail/HeroCarousel.tsx src/features/new-projects/components/ProjectDetailScreen.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/new-projects/components/detail/HeroCarousel.tsx src/features/new-projects/components/ProjectDetailScreen.tsx
git commit -m "feat(favorites): add heart to project detail hero"
```

---

## Task 10: Wire heart into the listing card

**Files:**

- Modify: `src/features/new-projects/components/detail/ListingsSection.tsx`

- [ ] **Step 1: Add the heart overlay**

In `src/features/new-projects/components/detail/ListingsSection.tsx`:

Add imports with the other imports:

```tsx
import { FavoriteHeartButton } from '@/features/favorites/components/FavoriteHeartButton';
import { FavoriteResourceKind } from '@/features/favorites/types';
```

The `ListingCard`'s root `Pressable` already has `className="w-64 overflow-hidden rounded-2xl border border-border bg-card active:opacity-90"`. Change it to add `relative`:

```tsx
className =
  'relative w-64 overflow-hidden rounded-2xl border border-border bg-card active:opacity-90';
```

Then, immediately after the opening image conditional block (right after the closing `)}` of the `item.heroImageUrl ? (...) : (...)` expression and before `<View className="p-3">`), insert:

```tsx
<FavoriteHeartButton
  kind={FavoriteResourceKind.LISTING}
  id={item.id}
  className="absolute right-2 top-2"
/>
```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm exec tsc --noEmit`
Run: `pnpm lint src/features/new-projects/components/detail/ListingsSection.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/new-projects/components/detail/ListingsSection.tsx
git commit -m "feat(favorites): add heart to listing card"
```

---

## Task 11: Client-only bottom tab set

**Files:**

- Modify: `src/features/new-projects/components/BottomTabBar.tsx`

- [ ] **Step 1: Add `CUSTOMER_TABS` and the role branch**

In `src/features/new-projects/components/BottomTabBar.tsx`:

Add the import next to the existing `useAuthStore` import:

```tsx
import { useRole } from '@/lib/rbac';
```

Add a new tab list constant right after the existing `PUBLIC_TABS` constant:

```tsx
const CUSTOMER_TABS: TabItem[] = [
  { key: 'favourites', label: 'Favourites', icon: 'Heart', href: '/favourites' },
  { key: 'home', label: 'Home', icon: 'House', href: '/' },
  { key: 'profile', label: 'Profile', icon: 'User', href: '/profile' },
];
```

Inside `BottomTabBar`, add the role hook next to the other hooks (near `const isAuthenticated = useAuthStore(...)`):

```tsx
const { isCustomer } = useRole();
```

Replace the existing `TABS` `useMemo` with:

```tsx
const TABS = useMemo<TabItem[]>(() => {
  if (!isAuthenticated) return PUBLIC_TABS;
  if (isCustomer) return CUSTOMER_TABS;
  const tabPermission: Record<string, boolean> = {
    listings: canListings,
    leads: canLeads,
    home: true,
    chat: canChat,
    profile: true,
  };
  return AUTHED_TABS.filter((t) => tabPermission[t.key] !== false);
}, [isAuthenticated, isCustomer, canListings, canLeads, canChat]);
```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm exec tsc --noEmit`
Run: `pnpm lint src/features/new-projects/components/BottomTabBar.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/new-projects/components/BottomTabBar.tsx
git commit -m "feat(favorites): client-only bottom tab set"
```

---

## Task 12: Favourites-page cards

**Files:**

- Create: `src/features/favorites/components/FavoriteProjectCard.tsx`
- Create: `src/features/favorites/components/FavoriteListingCard.tsx`

Reference styling: `src/features/new-projects/components/detail/ListingsSection.tsx` `ListingCard` and `src/features/new-projects/utils/format.ts` (`formatAed`). Both cards are full-width rows with a filled heart that un-favourites.

- [ ] **Step 1: Create `FavoriteProjectCard`**

```tsx
// src/features/favorites/components/FavoriteProjectCard.tsx
import { Image, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';
import { formatAed } from '@/features/new-projects/utils/format';
import { FavoriteHeartButton } from './FavoriteHeartButton';
import { FavoriteResourceKind, type ClientFavoriteProjectItem } from '../types';

export function FavoriteProjectCard({ item }: Readonly<{ item: ClientFavoriteProjectItem }>) {
  const mutedFg = useThemeColor('--muted-foreground');

  return (
    <Pressable
      onPress={() => {
        if (item.slug) router.push(`/new-projects/${item.slug}`);
      }}
      className="relative mb-4 overflow-hidden rounded-2xl border border-border bg-card active:opacity-90"
    >
      {item.heroImageUrl ? (
        <Image
          source={{ uri: item.heroImageUrl }}
          className="h-44 w-full bg-muted"
          resizeMode="cover"
        />
      ) : (
        <View className="h-44 w-full items-center justify-center bg-muted">
          <Icon name="Image" size={28} color={mutedFg} />
        </View>
      )}
      <FavoriteHeartButton
        kind={FavoriteResourceKind.PROJECT}
        id={item.projectId}
        className="absolute right-3 top-3"
      />
      <View className="p-3">
        <Text className="text-base font-bold text-foreground" numberOfLines={1}>
          {item.projectName}
        </Text>
        {item.locationLine ? (
          <View className="mt-1 flex-row items-center gap-1">
            <Icon name="MapPin" size={12} color={mutedFg} />
            <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
              {item.locationLine}
            </Text>
          </View>
        ) : null}
        {typeof item.startingPrice === 'number' ? (
          <Text className="mt-2 text-sm font-bold text-brand">{formatAed(item.startingPrice)}</Text>
        ) : null}
        <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={1}>
          {item.developer.brandName}
        </Text>
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 2: Create `FavoriteListingCard`**

```tsx
// src/features/favorites/components/FavoriteListingCard.tsx
import { Image, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';
import { formatAed } from '@/features/new-projects/utils/format';
import { FavoriteHeartButton } from './FavoriteHeartButton';
import { FavoriteResourceKind, type ClientFavoriteListingItem } from '../types';

export function FavoriteListingCard({ item }: Readonly<{ item: ClientFavoriteListingItem }>) {
  const mutedFg = useThemeColor('--muted-foreground');
  const listing = item.listing;
  const beds = listing.unitType?.bedrooms;
  const baths = listing.unitType?.bathrooms;

  return (
    <Pressable
      onPress={() => {
        const slug = listing.project?.slug;
        if (slug) router.push(`/new-projects/${slug}`);
      }}
      className="relative mb-4 overflow-hidden rounded-2xl border border-border bg-card active:opacity-90"
    >
      {listing.heroImageUrl ? (
        <Image
          source={{ uri: listing.heroImageUrl }}
          className="h-44 w-full bg-muted"
          resizeMode="cover"
        />
      ) : (
        <View className="h-44 w-full items-center justify-center bg-muted">
          <Icon name="Image" size={28} color={mutedFg} />
        </View>
      )}
      <FavoriteHeartButton
        kind={FavoriteResourceKind.LISTING}
        id={listing.id}
        className="absolute right-3 top-3"
      />
      <View className="p-3">
        {typeof listing.price === 'number' ? (
          <Text className="text-base font-bold text-foreground" numberOfLines={1}>
            {formatAed(listing.price)}
          </Text>
        ) : null}
        <Text className="mt-0.5 text-sm font-medium text-foreground" numberOfLines={1}>
          {listing.title}
        </Text>
        <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
          {listing.project?.projectName}
        </Text>
        <View className="mt-2 flex-row items-center gap-3">
          {beds ? (
            <View className="flex-row items-center gap-1">
              <Icon name="Bed" size={13} color={mutedFg} />
              <Text className="text-xs text-muted-foreground">{beds}</Text>
            </View>
          ) : null}
          {baths ? (
            <View className="flex-row items-center gap-1">
              <Icon name="Bath" size={13} color={mutedFg} />
              <Text className="text-xs text-muted-foreground">{baths}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 3: Type-check + lint**

Run: `pnpm exec tsc --noEmit`
Run: `pnpm lint src/features/favorites/components/FavoriteProjectCard.tsx src/features/favorites/components/FavoriteListingCard.tsx`
Expected: no errors. (If `formatAed`'s import path differs, confirm with `grep -n "export function formatAed" src/features/new-projects/utils/format.ts` and adjust.)

- [ ] **Step 4: Commit**

```bash
git add src/features/favorites/components/FavoriteProjectCard.tsx src/features/favorites/components/FavoriteListingCard.tsx
git commit -m "feat(favorites): add favourites-page cards"
```

---

## Task 13: Favourites list hook

**Files:**

- Create: `src/features/favorites/hooks/use-favorites-list.ts`

Mirrors `src/features/new-projects/hooks/use-public-projects.ts` (infinite query, `getNextPageParam` on `page < totalPages`).

- [ ] **Step 1: Create the hook**

```ts
// src/features/favorites/hooks/use-favorites-list.ts
import { useInfiniteQuery, type UseInfiniteQueryResult } from '@tanstack/react-query';
import { useRole } from '@/lib/rbac';
import { useAuthStore } from '@/store/auth.store';
import { getFavoriteListings, getFavoriteProjects } from '../services';
import type { PaginatedClientFavoriteListings, PaginatedClientFavoriteProjects } from '../types';
import { favoritesKeys } from './keys';

const PAGE_SIZE = 10;

export function useFavoriteProjectsList(): UseInfiniteQueryResult<
  { pages: PaginatedClientFavoriteProjects[] },
  Error
> {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { isCustomer } = useRole();
  return useInfiniteQuery<PaginatedClientFavoriteProjects, Error>({
    queryKey: favoritesKeys.list('project'),
    queryFn: ({ pageParam }) => getFavoriteProjects(pageParam as number, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled: isAuthenticated && isCustomer,
  }) as UseInfiniteQueryResult<{ pages: PaginatedClientFavoriteProjects[] }, Error>;
}

export function useFavoriteListingsList(): UseInfiniteQueryResult<
  { pages: PaginatedClientFavoriteListings[] },
  Error
> {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { isCustomer } = useRole();
  return useInfiniteQuery<PaginatedClientFavoriteListings, Error>({
    queryKey: favoritesKeys.list('listing'),
    queryFn: ({ pageParam }) => getFavoriteListings(pageParam as number, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled: isAuthenticated && isCustomer,
  }) as UseInfiniteQueryResult<{ pages: PaginatedClientFavoriteListings[] }, Error>;
}
```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm exec tsc --noEmit`
Run: `pnpm lint src/features/favorites/hooks/use-favorites-list.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/favorites/hooks/use-favorites-list.ts
git commit -m "feat(favorites): add favourites list hooks"
```

---

## Task 14: Favourites screen

**Files:**

- Modify: `app/(app)/favourites.tsx`

Reference: the placeholder already imports `MAIN_HEADER_HEIGHT` + `useSafeAreaInsets`. Use a `SectionList` (one section per resource type) like `ProjectListing.tsx`.

- [ ] **Step 1: Replace the screen**

```tsx
// app/(app)/favourites.tsx
import { useMemo } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { MAIN_HEADER_HEIGHT } from '@/components/organisms';
import { FavoriteListingCard } from '@/features/favorites/components/FavoriteListingCard';
import { FavoriteProjectCard } from '@/features/favorites/components/FavoriteProjectCard';
import {
  useFavoriteListingsList,
  useFavoriteProjectsList,
} from '@/features/favorites/hooks/use-favorites-list';
import type {
  ClientFavoriteListingItem,
  ClientFavoriteProjectItem,
} from '@/features/favorites/types';
import { useRole } from '@/lib/rbac';
import { useThemeColor } from '@theme';

type Row =
  | { type: 'project'; item: ClientFavoriteProjectItem }
  | { type: 'listing'; item: ClientFavoriteListingItem };

export default function FavouritesScreen() {
  const insets = useSafeAreaInsets();
  const mutedFg = useThemeColor('--muted-foreground');
  const { isCustomer } = useRole();

  const projects = useFavoriteProjectsList();
  const listings = useFavoriteListingsList();

  const projectRows = useMemo<Row[]>(
    () =>
      (projects.data?.pages.flatMap((p) => p.items) ?? []).map((item) => ({
        type: 'project' as const,
        item,
      })),
    [projects.data],
  );
  const listingRows = useMemo<Row[]>(
    () =>
      (listings.data?.pages.flatMap((p) => p.items) ?? []).map((item) => ({
        type: 'listing' as const,
        item,
      })),
    [listings.data],
  );

  const sections = useMemo(
    () =>
      [
        { title: 'Projects', data: projectRows },
        { title: 'Listings', data: listingRows },
      ].filter((s) => s.data.length > 0),
    [projectRows, listingRows],
  );

  const topPad = insets.top + MAIN_HEADER_HEIGHT;
  const isLoading = projects.isLoading || listings.isLoading;
  const isError = !!projects.error || !!listings.error;
  const isEmpty = !isLoading && !isError && sections.length === 0;

  if (!isCustomer) {
    return (
      <View
        className="flex-1 items-center justify-center bg-background px-6"
        style={{ paddingTop: topPad }}
      >
        <Text variant="muted" className="text-center">
          Sign in as a client to use favourites.
        </Text>
      </View>
    );
  }

  function handleRefresh(): void {
    projects.refetch().catch(() => {});
    listings.refetch().catch(() => {});
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: topPad }}>
      <SectionList
        sections={sections}
        keyExtractor={(row) =>
          row.type === 'project' ? `p-${row.item.favoriteId}` : `l-${row.item.favoriteId}`
        }
        renderSectionHeader={({ section }) => (
          <View className="bg-background px-4 pb-2 pt-3">
            <Text className="text-lg font-bold text-foreground">{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View className="px-4">
            {item.type === 'project' ? (
              <FavoriteProjectCard item={item.item} />
            ) : (
              <FavoriteListingCard item={item.item} />
            )}
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center px-6 py-24">
            {isLoading ? (
              <ActivityIndicator />
            ) : (
              <>
                <View className="mb-3 h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <Icon name={isError ? 'WifiOff' : 'Heart'} size={22} color={mutedFg} />
                </View>
                <Text className="text-center text-sm font-medium text-foreground">
                  {isError ? 'Could not load favourites' : 'No favourites yet'}
                </Text>
                <Text className="mt-1 text-center text-xs text-muted-foreground">
                  {isError ? 'Pull down to retry' : 'Tap the heart on a project to save it here'}
                </Text>
              </>
            )}
          </View>
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (projects.hasNextPage && !projects.isFetchingNextPage) {
            projects.fetchNextPage().catch(() => {});
          }
          if (listings.hasNextPage && !listings.isFetchingNextPage) {
            listings.fetchNextPage().catch(() => {});
          }
        }}
        ListFooterComponent={
          projects.isFetchingNextPage || listings.isFetchingNextPage ? (
            <View className="py-6">
              <ActivityIndicator />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={
              (projects.isFetching && !projects.isFetchingNextPage) ||
              (listings.isFetching && !listings.isFetchingNextPage)
            }
            onRefresh={handleRefresh}
          />
        }
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
      />
      {isEmpty ? null : null}
    </View>
  );
}
```

(The trailing `{isEmpty ? null : null}` line is redundant — delete it; `isEmpty` is covered by `ListEmptyComponent` since `sections` is empty when there is no data. It is left out of the final file.)

Final note for the implementer: remove the `isEmpty` variable and the redundant trailing expression — they are not needed because an empty `sections` array makes `SectionList` render `ListEmptyComponent`. Keep `isLoading`/`isError` (used inside `ListEmptyComponent`).

- [ ] **Step 2: Type-check + lint**

Run: `pnpm exec tsc --noEmit`
Run: `pnpm lint "app/(app)/favourites.tsx"`
Expected: no errors. Fix any unused-var lint error by removing `isEmpty` as noted.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/favourites.tsx"
git commit -m "feat(favorites): real favourites screen"
```

---

## Task 15: Full verification + manual QA

**Files:** none (verification only)

- [ ] **Step 1: Full quality gate**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.
Run: `pnpm lint`
Expected: no errors.
Run: `pnpm format:check`
Expected: all matched files use Prettier style. If it fails, run `pnpm format` and commit the formatting.

- [ ] **Step 2: Manual QA (device/simulator)**

Run: `pnpm ios` (or `pnpm android`). Verify each:

1. Logged out: tap heart on a Home project card → auth prompt opens.
2. Sign in as a `customer` account → bottom bar shows exactly **Favourites / Home / Profile**.
3. From Home, favourite a project → heart turns red immediately.
4. Open the same project's detail → hero heart is red; un-favourite there → card heart un-fills on back.
5. On a project detail, favourite a listing card → heart turns red.
6. Open Favourites tab → Projects section shows the project, Listings section shows the listing.
7. Un-favourite from a Favourites card → row disappears.
8. Pull-to-refresh on Favourites works; empty account shows "No favourites yet".
9. Sign in as a non-customer (e.g. agent) → no Favourites tab; project/listing hearts render nothing.
10. Turn off network, toggle a heart → it reverts, no crash, `[favorites] toggle failed; reverted` in logs.

- [ ] **Step 3: Final commit (only if formatting changed)**

```bash
git add -A
git commit -m "chore(favorites): formatting"
```

---

## Self-Review

**Spec coverage:**

- Client detection (role `customer`) → Task 1. ✅
- Feature module (types/services/keys/snapshot/toggle/list/components) → Tasks 2–7, 12, 13. ✅
- Bottom tab bar 3-tab customer set → Task 11. ✅
- Heart on card overlay → Task 8; project detail → Task 9; listing card → Task 10. ✅
- Favourites page (projects + listings sections, infinite, pull-refresh, empty/error, non-customer guard) → Task 14. ✅
- Data flow & errors (optimistic snapshot, revert + console.warn, enabled gating) → Tasks 5–7. ✅
- `opportunity_listing` excluded → enforced by typed `ClientFavoriteAllResponse` omission + project/listing-only services. ✅
- Verification (tsc + lint + manual, no unit tests) → every task + Task 15. ✅

**Placeholder scan:** No TBD/TODO. The one redundant line in Task 14 is explicitly called out with removal instructions rather than left ambiguous.

**Type consistency:** `FavoriteResourceKind` enum (`LISTING`/`PROJECT`) used consistently across services, toggle, heart button, cards. `favoritesKeys` shape (`all`/`snapshot()`/`list()`) consistent across Tasks 4/5/6/13. `ClientFavoriteAllResponse` shape (`projects`/`listings` only) consistent across Tasks 2/5/6. `useFavoriteSnapshot` returns `{ snapshot, isLoading, enabled }`, consumed only as `snapshot` in Task 7 — consistent. `formatAed` import path flagged for verification in Task 12.
