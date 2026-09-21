# Mobile Guest Rent Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the Rent tab on the guest/public home screen with full parity to the web `/rent-with-us` page, reusing the existing Buy card, detail screen, and filters.

**Architecture:** Rent is Buy with a `type=rent` flag. Parameterize the existing properties feed (service + hook) by listing type, reuse the list component (renamed `BuyListing` → `PropertyListing`), reuse `PropertyCard` and `PropertyDetailScreen` untouched in shape. Rent price gets a `/yr` suffix on both card and detail; detail learns "is rent" via a `rent=1` navigation query param.

**Tech Stack:** Expo Router (typed routes), React Native 0.81, TanStack Query, axios, NativeWind. Package manager: **pnpm**.

## Global Constraints

- **No test runner** in this repo (project convention). Do NOT add Jest/TDD. Every task verifies via `pnpm exec tsc --noEmit` (clean) + `pnpm lint` (clean), plus manual QA where noted.
- Strict TypeScript (`strict: true`), no `any`. Prefer `Readonly<{...}>` on prop types.
- Use semantic Tailwind tokens; don't hard-code colors. Prettier: single quotes, semis, trailing commas, 100-col. `prettier-plugin-tailwindcss` sorts classes — don't fight it.
- Typed routes are ON — navigate with the object form (`{ pathname, params }`), not query-string template literals.
- Rent `/yr` suffix applies ONLY when a real price exists (card: `priceValue !== undefined`; detail: `data.price > 0`). Never append to `"Price on request"`.
- Backend already supports `type=rent` on `/api/v1/public/projects` and `purpose=for_rent` on `/api/v1/opportunity-listing/public`. No backend change.
- Commit after each task.

---

### Task 1: Parameterize the properties feed by listing type

**Files:**

- Modify: `src/features/properties/services.ts`
- Modify: `src/features/properties/hooks/use-properties-feed.ts`

**Interfaces:**

- Consumes: existing `buyProjectToCards`, `opportunityToCard`, `mergeFeed` (mappers), `PropertyCard`, `BuyProjectsResponse`, `OpportunityListResponse` (types), `FEED_FETCH_LIMIT` (constants).
- Produces:
  - `export type ListingType = 'buy' | 'rent'` (from `services.ts`)
  - `getPropertiesFeed(listingType?: ListingType): Promise<PropertyCard[]>` (default `'buy'`)
  - `usePropertiesFeed(listingType?: ListingType)` with queryKey `['properties','feed',listingType]`

- [ ] **Step 1: Rewrite the feed fetchers + `getPropertiesFeed` in `services.ts`**

Replace the current `fetchBuyCards`, `fetchOpportunityCards`, and `getPropertiesFeed` (lines 12–46) with the following. Leave `getBuyListingDetail` and `getOpportunityDetail` (lines 48–63) unchanged.

```ts
export type ListingType = 'buy' | 'rent';

/** Buy/Rent projects (`type=buy|rent`) — each nested listing becomes one card. */
async function fetchProjectCards(type: ListingType): Promise<PropertyCard[]> {
  try {
    const { data } = await apiClient.get<BuyProjectsResponse>('/api/v1/public/projects', {
      params: { type, page: 1, limit: FEED_FETCH_LIMIT },
    });
    return (data.items ?? []).flatMap(buyProjectToCards);
  } catch {
    return [];
  }
}

/** Public opportunity (secondary) listings, optionally filtered by purpose. */
async function fetchOpportunityCards(purpose?: 'for_sale' | 'for_rent'): Promise<PropertyCard[]> {
  try {
    const { data } = await apiClient.get<OpportunityListResponse>(
      '/api/v1/opportunity-listing/public',
      {
        params: {
          page: 1,
          limit: FEED_FETCH_LIMIT,
          sortOrder: 'desc',
          ...(purpose ? { purpose } : {}),
        },
      },
    );
    return (data.items ?? [])
      .map(opportunityToCard)
      .filter((card): card is PropertyCard => card !== null);
  } catch {
    return [];
  }
}

/** Append a rent period to cards that carry a real price (skip "Price on request"). */
function withRentPeriod(cards: PropertyCard[]): PropertyCard[] {
  return cards.map((card) =>
    card.priceValue !== undefined ? { ...card, priceLabel: `${card.priceLabel} /yr` } : card,
  );
}

/**
 * The mixed feed for a listing type: both sources fetched together, merged
 * newest-first. Each source fails soft (returns []) so one outage doesn't blank
 * the screen. Rent cards get a `/yr` price suffix.
 */
export async function getPropertiesFeed(listingType: ListingType = 'buy'): Promise<PropertyCard[]> {
  if (listingType === 'rent') {
    const [rent, opportunity] = await Promise.all([
      fetchProjectCards('rent'),
      fetchOpportunityCards('for_rent'),
    ]);
    return mergeFeed(withRentPeriod([...rent, ...opportunity]));
  }
  const [buy, opportunity] = await Promise.all([fetchProjectCards('buy'), fetchOpportunityCards()]);
  return mergeFeed([...buy, ...opportunity]);
}
```

- [ ] **Step 2: Parameterize the hook in `use-properties-feed.ts`**

Replace the whole file body's hook with:

```ts
import { useQuery } from '@tanstack/react-query';
import { getPropertiesFeed, type ListingType } from '../services';
import type { PropertyCard } from '../types';

/**
 * The full mixed feed for a listing type (buy|rent), merged newest-first.
 * Buy and rent use separate cache buckets so they never clobber each other.
 */
export function usePropertiesFeed(listingType: ListingType = 'buy') {
  return useQuery<PropertyCard[], Error>({
    queryKey: ['properties', 'feed', listingType],
    queryFn: () => getPropertiesFeed(listingType),
    staleTime: 5 * 60_000,
  });
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors. (`BuyListing.tsx` still calls `usePropertiesFeed()` with no arg — valid, default `'buy'`.)

- [ ] **Step 4: Commit**

```bash
git add src/features/properties/services.ts src/features/properties/hooks/use-properties-feed.ts
git commit -m "feat(properties): parameterize feed by listing type (buy|rent) with rent /yr suffix"
```

---

### Task 2: Add `isRent` to `PropertyCard` → `rent=1` nav param

**Files:**

- Modify: `src/features/properties/components/PropertyCard.tsx`

**Interfaces:**

- Consumes: `PropertyCardModel` (aliased `PropertyCard` type), `router` from `expo-router`.
- Produces: `PropertyCard` component now accepts `isRent?: boolean` (default `false`); when true, detail navigation carries `rent: '1'`.

- [ ] **Step 1: Update `openDetail` to accept and forward the rent flag**

Replace `openDetail` (lines 21–27) with the object-form navigation (typed-routes safe):

```ts
function openDetail(card: PropertyCardModel, isRent: boolean): void {
  const rentParam = isRent ? { rent: '1' } : {};
  if (card.kind === 'opportunity') {
    router.push({
      pathname: '/properties/opportunity/[slug]',
      params: { slug: card.slug ?? '', ...rentParam },
    });
    return;
  }
  router.push({
    pathname: '/properties/project/[projectSlug]/[listingSlug]',
    params: {
      projectSlug: card.projectSlug ?? '',
      listingSlug: card.listingSlug ?? '',
      ...rentParam,
    },
  });
}
```

- [ ] **Step 2: Add the `isRent` prop and pass it into `openDetail`**

Change the component signature (line 81) and the pressable's `onPress` (line 86):

```ts
export function PropertyCard({
  card,
  isRent = false,
}: Readonly<{ card: PropertyCardModel; isRent?: boolean }>) {
```

```ts
      <Pressable onPress={() => openDetail(card, isRent)} className="active:opacity-95">
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors. (`BuyListing.tsx` renders `<PropertyCard card={item} />` — `isRent` defaults to `false`, still valid.)

- [ ] **Step 4: Commit**

```bash
git add src/features/properties/components/PropertyCard.tsx
git commit -m "feat(properties): PropertyCard isRent prop carries rent=1 to detail nav"
```

---

### Task 3: Detail screen shows `/yr` when reached as rent

**Files:**

- Modify: `src/features/properties/components/PropertyDetailScreen.tsx`
- Modify: `app/(public)/properties/opportunity/[slug].tsx`
- Modify: `app/(public)/properties/project/[projectSlug]/[listingSlug].tsx`

**Interfaces:**

- Consumes: `PropertyDetailScreen` (from Task's own change), `PropertyDetailTarget`, `useLocalSearchParams`.
- Produces: `PropertyDetailScreen` now accepts `isRent?: boolean` (default `false`).

- [ ] **Step 1: Add `isRent` prop + computed price label in `PropertyDetailScreen.tsx`**

Change the signature (line 28):

```ts
export function PropertyDetailScreen({
  target,
  isRent = false,
}: Readonly<{ target: PropertyDetailTarget; isRent?: boolean }>) {
```

After the `error || !data` guard (i.e. immediately before the `return (` on line 50), add:

```ts
const priceLabel = isRent && data.price > 0 ? `${data.priceLabel} /yr` : data.priceLabel;
```

Then use `priceLabel` in both consumers — `PropertyHeaderCard` (line 66) and `PropertyContactBar` (line 79):

```ts
        <PropertyHeaderCard title={data.title} location={data.location} priceLabel={priceLabel} />
```

```ts
      <PropertyContactBar
        priceLabel={priceLabel}
        phone={data.agent?.phone}
        whatsapp={data.agent?.whatsapp}
      />
```

- [ ] **Step 2: Read `rent` param in the opportunity route**

Replace `app/(public)/properties/opportunity/[slug].tsx` entirely:

```tsx
import { useLocalSearchParams } from 'expo-router';
import { PropertyDetailScreen } from '@/features/properties/components/PropertyDetailScreen';

export default function OpportunityDetailRoute() {
  const { slug, rent } = useLocalSearchParams<{ slug: string; rent?: string }>();
  return <PropertyDetailScreen target={{ kind: 'opportunity', slug }} isRent={rent === '1'} />;
}
```

- [ ] **Step 3: Read `rent` param in the buy-project route**

Replace `app/(public)/properties/project/[projectSlug]/[listingSlug].tsx` entirely:

```tsx
import { useLocalSearchParams } from 'expo-router';
import { PropertyDetailScreen } from '@/features/properties/components/PropertyDetailScreen';

export default function BuyListingDetailRoute() {
  const { projectSlug, listingSlug, rent } = useLocalSearchParams<{
    projectSlug: string;
    listingSlug: string;
    rent?: string;
  }>();
  return (
    <PropertyDetailScreen
      target={{ kind: 'buy-project', projectSlug, listingSlug }}
      isRent={rent === '1'}
    />
  );
}
```

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/properties/components/PropertyDetailScreen.tsx "app/(public)/properties/opportunity/[slug].tsx" "app/(public)/properties/project/[projectSlug]/[listingSlug].tsx"
git commit -m "feat(properties): detail shows /yr when opened from a rent listing"
```

---

### Task 4: Rename `BuyListing` → `PropertyListing`, enable the Rent tab

**Files:**

- Rename: `src/features/properties/components/BuyListing.tsx` → `src/features/properties/components/PropertyListing.tsx`
- Modify: (the renamed) `PropertyListing.tsx`
- Modify: `src/features/new-projects/components/HomeScreen.tsx`

**Interfaces:**

- Consumes: `usePropertiesFeed(listingType)` (Task 1), `PropertyCard` with `isRent` (Task 2), `ListingType` (Task 1), existing `BuyFiltersSheet`, `filterBuyCards`, `countActiveBuyFilters`, `LIST_PAGE_SIZE`.
- Produces: `PropertyListing` component accepting `listingType?: ListingType` (default `'buy'`) and `contentBottomPadding?: number`.

- [ ] **Step 1: Rename the file (preserve git history)**

```bash
git mv src/features/properties/components/BuyListing.tsx src/features/properties/components/PropertyListing.tsx
```

- [ ] **Step 2: Add `listingType` to the component and thread it through**

In `PropertyListing.tsx`, add the import for `ListingType` (alongside the existing type import on line 10):

```ts
import type { ListingType } from '../services';
```

Rename the exported function and update its props + the feed call + the card render. Replace the signature (was line 86) and the `usePropertiesFeed()` call (was line 95):

```ts
export function PropertyListing({
  listingType = 'buy',
  contentBottomPadding = 24,
}: Readonly<{ listingType?: ListingType; contentBottomPadding?: number }>) {
```

```ts
const { data, isLoading, isFetching, refetch, error } = usePropertiesFeed(listingType);
const isRent = listingType === 'rent';
```

Update the `renderItem` `PropertyCard` (was line 147) to pass the flag:

```ts
        renderItem={({ item }) => (
          <View className="px-4 pb-4">
            <PropertyCard card={item} isRent={isRent} />
          </View>
        )}
```

- [ ] **Step 3: Update `HomeScreen.tsx` — import, tab config, content, remove placeholder**

Change the import (line 6):

```ts
import { PropertyListing } from '@/features/properties/components/PropertyListing';
```

Enable the rent tab in `TABS` (line 14) by removing `disabled: true`:

```ts
const TABS: { value: HomeTab; label: string; disabled?: boolean }[] = [
  { value: 'buy', label: 'Buy' },
  { value: 'rent', label: 'Rent' },
  { value: 'project', label: 'Projects' },
];
```

Delete the entire `RentComingSoon` function (lines 45–54).

Replace the content switch (lines 79–81) with:

```ts
        {tab === 'project' ? <ProjectListing contentBottomPadding={bottomPad} /> : null}
        {tab === 'buy' ? (
          <PropertyListing listingType="buy" contentBottomPadding={bottomPad} />
        ) : null}
        {tab === 'rent' ? (
          <PropertyListing listingType="rent" contentBottomPadding={bottomPad} />
        ) : null}
```

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors. (Confirm no dangling `BuyListing`/`RentComingSoon` references: `grep -rn "BuyListing\b\|RentComingSoon" src app | grep -viE "BuyListingItem|BuyListingDetail|normalizeBuyListing|getBuyListing"` returns nothing.)

- [ ] **Step 5: Manual QA on emulator/device**

Run: `pnpm ios` (or `pnpm android`). As a guest (logged out), on the home screen:

- Rent tab is enabled (not greyed) and tappable.
- Rent tab shows rental listings; Buy tab still shows buy listings (both populated, not clobbered).
- Priced rent cards show `AED … /yr`; any `"Price on request"` card shows no `/yr`.
- Search + filters (beds/baths, city, type, price) work on the rent list.
- Tapping a rent card opens the detail; header price and sticky bar show `/yr`. Tapping a buy card opens detail with no `/yr`.

- [ ] **Step 6: Commit**

```bash
git add src/features/properties/components/PropertyListing.tsx src/features/new-projects/components/HomeScreen.tsx
git commit -m "feat(home): enable guest Rent tab, reuse list as PropertyListing"
```

---

## Notes for the implementer

- The mixed feed fetches up to `FEED_FETCH_LIMIT` (100) per source and paginates client-side (`LIST_PAGE_SIZE` = 10) — same as Buy. No server pagination wiring needed.
- `filterBuyCards` / `BuyFiltersSheet` / `filter-buy` keep their `Buy*` names on purpose (shared verbatim by both tabs) — do not rename them; only the list component is renamed.
- Do not touch `getBuyListingDetail` / `normalizeBuyListingDetail` / `BuyListingDetailRoute` — those names are unrelated to the list component and are correct as-is.
