# Mobile Sell Listings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the no-op "Sell" landing card to a new mobile Sell listings screen that mirrors the web `/my-account/listings?purpose=sale` — unified primary + secondary data, lifecycle tabs (Active/Inactive/Sold), all web filters, search; no compare.

**Architecture:** A new `SellListingsScreen` composes lifecycle tabs + market segment + search + a unified filters sheet over a `UnifiedListingsList`. Data comes from two paginated APIs (`/api/v1/listings` primary, `/api/v1/opportunity-listing` secondary), each via its own infinite query; a `useSellListings` hook normalizes both into a shared `UnifiedListingRow`, interleaves by `updatedAt`, applies client-side filters (rooms, price, portals, property type), and exposes one list interface.

**Tech Stack:** Expo Router, React 19, TanStack Query (infinite), axios (`apiClient`), NativeWind v4, TypeScript strict.

## Global Constraints

- **No test runner in this repo.** Verify every task with `pnpm exec tsc --noEmit` AND `pnpm lint`, then manual QA. Do NOT add a test framework (project rule).
- Package manager is **pnpm**. Never touch `package-lock.json`.
- Styling: semantic Tailwind tokens only (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-card`, `bg-brand`, `text-brand-foreground`). No hard-coded hex except where the existing listings code already does (`lib/visuals.ts`, portal brand marks).
- Props typed `Readonly<{...}>`. Single quotes, semis, trailing commas, 100-col, 2-space (prettier auto-runs on commit via husky).
- Imports: `@/` → `src/`, `@theme` → `theme`.
- Branch: `feat/mobile-project-listing` (already checked out). Commit after each task.

---

### Task 1: Types + filter constants

**Files:**

- Modify: `src/features/listings/types.ts`
- Create: `src/features/listings/lib/filters.ts`

**Interfaces:**

- Produces: `PriceTrend`, `ListingKind`, `ListingPortal`, `ListingMarket`, `ListingsLifecycle`, `StageSummary`, `UnifiedListingRow`, `PrimaryListingItem`, `PrimaryPaginatedListings`, `PrimaryListingsQuery`, `ListingDeveloperOption`; extended `ListingListItem` (adds `previousPrice`, `priceTrend`, `stage`, `unitNumber`, `isPushedToPropertyFinder`, `pfListingId`, `createdByName`, `purpose`); extended `ListingsQuery` (adds `purpose`, `lifecycle`, `stageId`). From `filters.ts`: `STATUS_FILTER_OPTIONS`, `ROOM_PILLS`, `PRICE_OPTIONS`, `PORTAL_META`, `PORTAL_ORDER`.

- [ ] **Step 1: Extend the secondary `ListingListItem` and `ListingsQuery` in `types.ts`**

In `src/features/listings/types.ts`, add the `PriceTrend` type and `StageSummary` near the top (after the `ListingStatus` union, before `ListingAssignee`):

```typescript
export type PriceTrend = 'up' | 'down' | 'none';

export interface StageSummary {
  id: string;
  name: string;
  color: string;
}
```

Then add these fields to the existing `ListingListItem` interface (append inside the interface, before the closing brace):

```typescript
  previousPrice?: number | null;
  priceTrend?: PriceTrend;
  unitNumber?: string | null;
  stage?: StageSummary | null;
  isPushedToPropertyFinder?: boolean;
  pfListingId?: string | null;
  createdByName?: string | null;
  purpose?: 'sell' | 'rent' | null;
```

Replace the existing `ListingsQuery` interface with:

```typescript
export interface ListingsQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: ListingStatus;
  includeArchived?: boolean;
  agentId?: string;
  property?: string;
  purpose?: 'for_sale' | 'for_rent';
  lifecycle?: ListingsLifecycle;
  stageId?: string;
}
```

- [ ] **Step 2: Add the unified + primary types to `types.ts`**

Append to the end of `src/features/listings/types.ts`:

```typescript
/* ----------------------------------------------------- unified listings */

export type ListingKind = 'primary' | 'secondary';
export type ListingMarket = 'all' | 'primary' | 'secondary';
export type ListingsLifecycle = 'active' | 'inactive' | 'sold';
export type ListingPortal = 'property_finder' | 'bayut' | 'dubizzle' | 'whatsapp';

/** Shared row shape for both data sources (mirror of the web UnifiedListingRow). */
export interface UnifiedListingRow {
  id: string;
  kind: ListingKind;
  title: string;
  status: string;
  isPublished?: boolean | null;
  price: number | null;
  previousPrice: number | null;
  priceTrend: PriceTrend;
  stage: StageSummary | null;
  projectName?: string | null;
  developerName?: string | null;
  propertyLabel?: string | null;
  permitNumber?: string | null;
  propertyType?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sizeSqft?: number | null;
  unitNumber?: string | null;
  location?: string | null;
  heroImageUrl?: string | null;
  agentName?: string | null;
  createdByName?: string | null;
  assigneeId?: string | null;
  portals?: ListingPortal[];
  purpose?: string | null;
  updatedAt?: string | null;
  leadId?: string | null;
  opportunityId?: string | null;
  slug?: string | null;
}

/* ----------------------------------------------- primary (project) listings */

export interface PrimaryListingItem {
  id: string;
  slug?: string;
  title?: string;
  projectName?: string;
  project?: { id: string; projectName?: string; slug?: string };
  developerId?: string;
  developerName?: string;
  propertyUse?: string;
  price?: number | null;
  previousPrice?: number | null;
  status: string;
  isPublished?: boolean | null;
  purpose?: 'for_sale' | 'for_rent';
  bedrooms?: number;
  bathrooms?: number;
  sizeSqft?: number | null;
  propertyType?: string;
  neighbourhoodName?: string | null;
  unitNumber?: string | null;
  unitType?: {
    propertyType?: string;
    bedrooms?: number;
    bathrooms?: number;
    sizeMin?: number | null;
    sizeMax?: number | null;
  };
  assigneeId?: string | null;
  assignee?: ListingAssignee | null;
  createdByName?: string | null;
  isPushedToPropertyFinder?: boolean;
  pfListingId?: string | null;
  heroImageUrls?: string[];
  stage?: StageSummary | null;
  priceTrend?: PriceTrend;
  createdAt?: string;
  updatedAt?: string;
}

export interface PrimaryPaginatedListings {
  items: PrimaryListingItem[];
  total: number;
  totalForScope?: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PrimaryListingsQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  status?: string;
  purpose?: 'for_sale' | 'for_rent';
  lifecycle?: ListingsLifecycle;
  developerId?: string;
  propertyUse?: string;
  assigneeId?: string;
  stageId?: string;
}

export interface ListingDeveloperOption {
  value: string;
  label: string;
}
```

- [ ] **Step 3: Create the filter constants file**

Create `src/features/listings/lib/filters.ts`:

```typescript
import type { ListingPortal } from '../types';

/** Public-page status options (mirrors web; excludes re_review). '' = all. */
export const STATUS_FILTER_OPTIONS: readonly { label: string; value: string }[] = [
  { label: 'All statuses', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Pending Review', value: 'in_review' },
  { label: 'Changes Requested', value: 'changes_requested' },
  { label: 'Approved', value: 'approved' },
  { label: 'Published', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Archived', value: 'archived' },
];

/** Room pills. value is the bedroom count as a string; '4' means 4+. */
export const ROOM_PILLS: readonly { label: string; value: string }[] = [
  { label: 'Studio', value: '0' },
  { label: '1 Bed', value: '1' },
  { label: '2 Beds', value: '2' },
  { label: '3 Beds', value: '3' },
  { label: '4+ Beds', value: '4' },
];

/** Price buckets. value is the encoded range; min/max are inclusive bounds. */
export const PRICE_OPTIONS: readonly {
  label: string;
  value: string;
  min?: number;
  max?: number;
}[] = [
  { label: 'Any price', value: '' },
  { label: 'Up to 500K', value: '0-500000', min: 0, max: 500_000 },
  { label: '500K – 1M', value: '500000-1000000', min: 500_000, max: 1_000_000 },
  { label: '1M – 2M', value: '1000000-2000000', min: 1_000_000, max: 2_000_000 },
  { label: '2M – 5M', value: '2000000-5000000', min: 2_000_000, max: 5_000_000 },
  { label: '5M+', value: '5000000-', min: 5_000_000 },
];

export const PORTAL_META: Record<ListingPortal, { mark: string; label: string; bg: string }> = {
  property_finder: { mark: 'PF', label: 'Property Finder', bg: '#ef4444' },
  bayut: { mark: 'BY', label: 'Bayut', bg: '#2563eb' },
  dubizzle: { mark: 'DZ', label: 'Dubizzle', bg: '#e11d48' },
  whatsapp: { mark: 'WA', label: 'WhatsApp', bg: '#16a34a' },
};

export const PORTAL_ORDER: readonly ListingPortal[] = [
  'property_finder',
  'bayut',
  'dubizzle',
  'whatsapp',
];
```

- [ ] **Step 4: Typecheck, lint, commit**

Run:

```bash
cd /Users/nabeel.ahmed/Desktop/Projects/boh/boh-mobile
pnpm exec tsc --noEmit
pnpm lint
```

Expected: both pass (no errors). `tsc` may report unused exports only if `noUnusedLocals` — these are exported, so clean.

```bash
git add src/features/listings/types.ts src/features/listings/lib/filters.ts
git commit -m "feat(listings): add unified listing types and filter constants"
```

---

### Task 2: Row normalizers

**Files:**

- Create: `src/features/listings/lib/normalize-row.ts`

**Interfaces:**

- Consumes: `PrimaryListingItem`, `ListingListItem`, `UnifiedListingRow`, `ListingPortal`, `PriceTrend` (Task 1).
- Produces: `normalizePrimaryRow(item: PrimaryListingItem): UnifiedListingRow`, `normalizeSecondaryRow(item: ListingListItem): UnifiedListingRow`.

- [ ] **Step 1: Create the normalizer module**

Create `src/features/listings/lib/normalize-row.ts`:

```typescript
import type {
  ListingListItem,
  ListingPortal,
  PriceTrend,
  PrimaryListingItem,
  UnifiedListingRow,
} from '../types';

function normalizeTrend(trend: PriceTrend | undefined): PriceTrend {
  return trend ?? 'none';
}

function pfPortals(pushed: boolean | undefined, pfId: string | null | undefined): ListingPortal[] {
  const portals: ListingPortal[] = [];
  if (pushed === true || (pfId ?? '') !== '') portals.push('property_finder');
  return portals;
}

function fullName(
  assignee: { firstName?: string | null; lastName?: string | null } | null | undefined,
): string | null {
  if (!assignee) return null;
  const name = `${assignee.firstName ?? ''} ${assignee.lastName ?? ''}`.trim();
  return name === '' ? null : name;
}

export function normalizePrimaryRow(item: PrimaryListingItem): UnifiedListingRow {
  const projectName = item.project?.projectName ?? item.projectName ?? null;
  const trimmedTitle = (item.title ?? '').trim();
  return {
    id: item.id,
    kind: 'primary',
    title: trimmedTitle === '' ? 'Untitled listing' : trimmedTitle,
    status: item.status,
    isPublished: item.isPublished ?? null,
    price: item.price ?? null,
    previousPrice: item.previousPrice ?? null,
    priceTrend: normalizeTrend(item.priceTrend),
    stage: item.stage ?? null,
    projectName,
    developerName: item.developerName ?? null,
    propertyLabel: projectName,
    permitNumber: null,
    propertyType: item.propertyType ?? item.unitType?.propertyType ?? null,
    bedrooms: item.bedrooms ?? item.unitType?.bedrooms ?? null,
    bathrooms: item.bathrooms ?? item.unitType?.bathrooms ?? null,
    sizeSqft: item.sizeSqft ?? item.unitType?.sizeMin ?? item.unitType?.sizeMax ?? null,
    unitNumber: item.unitNumber ?? null,
    location: item.neighbourhoodName ?? projectName,
    heroImageUrl: item.heroImageUrls?.[0] ?? null,
    agentName: fullName(item.assignee),
    createdByName: item.createdByName ?? null,
    assigneeId: item.assigneeId ?? null,
    portals: pfPortals(item.isPushedToPropertyFinder, item.pfListingId),
    purpose: item.purpose ?? null,
    updatedAt: item.updatedAt ?? null,
    leadId: null,
    opportunityId: null,
    slug: item.slug ?? item.project?.slug ?? null,
  };
}

export function normalizeSecondaryRow(item: ListingListItem): UnifiedListingRow {
  const trimmedHeroTitle = (item.heroTitle ?? '').trim();
  const trimmedName = (item.name ?? '').trim();
  const title = trimmedHeroTitle || trimmedName || 'Untitled listing';
  return {
    id: item.id,
    kind: 'secondary',
    title,
    status: item.status,
    isPublished: item.isPublished,
    price: item.price ?? null,
    previousPrice: item.previousPrice ?? null,
    priceTrend: normalizeTrend(item.priceTrend),
    stage: item.stage ?? null,
    projectName: null,
    developerName: null,
    propertyLabel: item.propertyLabel ?? null,
    permitNumber: item.permitNumber ?? null,
    propertyType: item.propertyType ?? null,
    bedrooms: item.bedrooms ?? null,
    bathrooms: item.bathrooms ?? null,
    sizeSqft: null,
    unitNumber: item.unitNumber ?? null,
    location: item.neighbourhoodName ?? item.stateName ?? null,
    heroImageUrl: item.heroImageUrl ?? null,
    agentName: fullName(item.assignee) ?? item.agentName ?? null,
    createdByName: item.createdByName ?? null,
    assigneeId: item.assigneeId ?? null,
    portals: pfPortals(item.isPushedToPropertyFinder, item.pfListingId),
    purpose: item.purpose ?? null,
    updatedAt: item.updatedAt,
    leadId: item.leadId ?? null,
    opportunityId: item.opportunityId ?? null,
    slug: item.urlSlug ?? null,
  };
}
```

- [ ] **Step 2: Typecheck, lint, commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/features/listings/lib/normalize-row.ts
git commit -m "feat(listings): add primary/secondary row normalizers"
```

---

### Task 3: Primary listings service + infinite hook

**Files:**

- Create: `src/features/listings/services.primary.ts`
- Create: `src/features/listings/hooks/use-primary-listings.ts`

**Interfaces:**

- Consumes: `PrimaryListingsQuery`, `PrimaryPaginatedListings`, `ListingDeveloperOption` (Task 1); `apiClient` from `@/lib/api`.
- Produces: `getPrimaryListings(params): Promise<PrimaryPaginatedListings>`, `getDevelopers(search?): Promise<ListingDeveloperOption[]>`, `usePrimaryListingsInfinite(params): UseInfiniteQueryResult`, type `PrimaryListingsParams = Omit<PrimaryListingsQuery,'page'|'limit'>`.

> NOTE for implementer: the mobile axios `apiClient` base is `EXPO_PUBLIC_API_BASE_URL`. The secondary service uses path `/api/v1/opportunity-listing`. The primary path is assumed to be `/api/v1/listings` (same `/api/v1` prefix). Manual-QA step: confirm a request to `/api/v1/listings?purpose=for_sale&lifecycle=active` returns data; if the backend serves it under a different prefix, fix `PRIMARY_BASE` / `DEVELOPERS_BASE` only.

- [ ] **Step 1: Create the primary service**

Create `src/features/listings/services.primary.ts`:

```typescript
import { apiClient } from '@/lib/api';
import type {
  ListingDeveloperOption,
  PrimaryListingsQuery,
  PrimaryPaginatedListings,
} from './types';

const PRIMARY_BASE = '/api/v1/listings';
const DEVELOPERS_BASE = '/api/v1/developers';

export async function getPrimaryListings(
  params: PrimaryListingsQuery,
): Promise<PrimaryPaginatedListings> {
  const { data } = await apiClient.get<PrimaryPaginatedListings>(PRIMARY_BASE, {
    params: {
      sortBy: 'createdAt',
      sortOrder: 'desc',
      ...params,
    },
  });
  return data;
}

interface DevelopersResponse {
  items: { id: string; brandName?: string | null; name?: string | null }[];
  page: number;
  totalPages: number;
}

export async function getDevelopers(search?: string): Promise<ListingDeveloperOption[]> {
  const { data } = await apiClient.get<DevelopersResponse>(DEVELOPERS_BASE, {
    params: { page: 1, limit: 100, search: search?.trim() ? search.trim() : undefined },
  });
  return (data.items ?? []).map((d) => ({
    value: d.id,
    label: d.brandName ?? d.name ?? 'Unnamed developer',
  }));
}
```

- [ ] **Step 2: Create the primary infinite hook**

Create `src/features/listings/hooks/use-primary-listings.ts`:

```typescript
import { useInfiniteQuery } from '@tanstack/react-query';
import { getPrimaryListings } from '../services.primary';
import type { PrimaryListingsQuery, PrimaryPaginatedListings } from '../types';

const PAGE_SIZE = 20;

export type PrimaryListingsParams = Omit<PrimaryListingsQuery, 'page' | 'limit'>;

export function usePrimaryListingsInfinite(params: PrimaryListingsParams) {
  return useInfiniteQuery<PrimaryPaginatedListings, Error>({
    queryKey: ['listings', 'primary', params],
    queryFn: ({ pageParam }) =>
      getPrimaryListings({ ...params, page: pageParam as number, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}
```

- [ ] **Step 3: Typecheck, lint, commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/features/listings/services.primary.ts src/features/listings/hooks/use-primary-listings.ts
git commit -m "feat(listings): add primary listings + developers service and hook"
```

---

### Task 4: Developer options hook

**Files:**

- Create: `src/features/listings/hooks/use-developers.ts`

**Interfaces:**

- Consumes: `getDevelopers` (Task 3), `ListingDeveloperOption` (Task 1).
- Produces: `useDeveloperOptions(): { data: ListingDeveloperOption[]; isLoading: boolean }`.

- [ ] **Step 1: Create the hook**

Create `src/features/listings/hooks/use-developers.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { getDevelopers } from '../services.primary';
import type { ListingDeveloperOption } from '../types';

export function useDeveloperOptions() {
  const query = useQuery<ListingDeveloperOption[]>({
    queryKey: ['listing-developers'],
    queryFn: () => getDevelopers(),
    staleTime: 5 * 60 * 1000,
  });
  return { data: query.data ?? [], isLoading: query.isLoading };
}
```

- [ ] **Step 2: Typecheck, lint, commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/features/listings/hooks/use-developers.ts
git commit -m "feat(listings): add developer options hook"
```

---

### Task 5: Unified filter draft + `useSellListings` orchestration hook

**Files:**

- Create: `src/features/listings/hooks/use-sell-listings.ts`

**Interfaces:**

- Consumes: `usePrimaryListingsInfinite` (Task 3), `useListingsInfinite` (existing), `normalizePrimaryRow`/`normalizeSecondaryRow` (Task 2), `PRICE_OPTIONS` (Task 1), types `UnifiedListingRow`, `ListingMarket`, `ListingsLifecycle`, `ListingPortal`, `ListingStatus`.
- Produces: `UnifiedFilterDraft`, `SellListingsState`, `useSellListings(args): SellListingsState`, `countActiveFilters(draft): number`, `propertyTypeOptionsFromRows(rows): string[]`.

> NOTE: Both queries are always enabled (matches web) so the count for each market stays accurate. `market` only affects which normalized rows render and which total is shown.

- [ ] **Step 1: Create the hook**

Create `src/features/listings/hooks/use-sell-listings.ts`:

```typescript
import { useMemo } from 'react';
import { useListingsInfinite } from './use-listings';
import { usePrimaryListingsInfinite } from './use-primary-listings';
import { normalizePrimaryRow, normalizeSecondaryRow } from '../lib/normalize-row';
import { PRICE_OPTIONS } from '../lib/filters';
import type {
  ListingMarket,
  ListingPortal,
  ListingStatus,
  ListingsLifecycle,
  UnifiedListingRow,
} from '../types';

export interface UnifiedFilterDraft {
  status?: string;
  propertyType?: string;
  rooms?: string;
  priceValue?: string;
  developerId?: string;
  developerLabel?: string;
  unitNumber?: string;
  portals?: ListingPortal[];
  agentId?: string;
  agentLabel?: string;
}

export interface SellListingsArgs {
  lifecycle: ListingsLifecycle;
  market: ListingMarket;
  search: string;
  filters: UnifiedFilterDraft;
}

export interface SellListingsState {
  rows: UnifiedListingRow[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  loadMore: () => void;
  refetch: () => void;
}

export function countActiveFilters(f: UnifiedFilterDraft): number {
  let n = 0;
  if (f.status) n += 1;
  if (f.propertyType) n += 1;
  if (f.rooms !== undefined) n += 1;
  if (f.priceValue) n += 1;
  if (f.developerId) n += 1;
  if (f.unitNumber?.trim()) n += 1;
  if (f.portals && f.portals.length > 0) n += 1;
  if (f.agentId) n += 1;
  return n;
}

export function propertyTypeOptionsFromRows(rows: UnifiedListingRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) if (r.propertyType) set.add(r.propertyType);
  return [...set].sort((a, b) => a.localeCompare(b));
}

function priceBounds(value: string | undefined): { min?: number; max?: number } {
  const opt = PRICE_OPTIONS.find((o) => o.value === value);
  return opt ? { min: opt.min, max: opt.max } : {};
}

function toTime(row: UnifiedListingRow): number {
  const ms = Date.parse(row.updatedAt ?? '');
  return Number.isNaN(ms) ? 0 : ms;
}

export function useSellListings({
  lifecycle,
  market,
  search,
  filters,
}: SellListingsArgs): SellListingsState {
  const wantPrimary = market === 'all' || market === 'primary';
  const wantSecondary = market === 'all' || market === 'secondary';
  const status = filters.status || undefined;
  const searchParam = search.length > 0 ? search : undefined;

  const primary = usePrimaryListingsInfinite({
    purpose: 'for_sale',
    lifecycle,
    search: searchParam,
    status,
    developerId: filters.developerId,
    assigneeId: filters.agentId,
  });

  const secondary = useListingsInfinite({
    purpose: 'for_sale',
    lifecycle,
    search: searchParam,
    status: status as ListingStatus | undefined,
    agentId: filters.agentId,
    property: filters.unitNumber?.trim() ? filters.unitNumber.trim() : undefined,
  });

  const rows = useMemo<UnifiedListingRow[]>(() => {
    const primaryRows = wantPrimary
      ? (primary.data?.pages.flatMap((p) => p.items) ?? []).map(normalizePrimaryRow)
      : [];
    const secondaryRows = wantSecondary
      ? (secondary.data?.pages.flatMap((p) => p.items) ?? []).map(normalizeSecondaryRow)
      : [];
    const merged = [...primaryRows, ...secondaryRows].sort((a, b) => toTime(b) - toTime(a));

    const roomsTarget = filters.rooms !== undefined ? Number(filters.rooms) : undefined;
    const { min: minPrice, max: maxPrice } = priceBounds(filters.priceValue);
    const wantPortals = (filters.portals?.length ?? 0) > 0;

    return merged.filter((row) => {
      if (filters.propertyType && row.propertyType !== filters.propertyType) return false;
      if (roomsTarget !== undefined) {
        const beds = row.bedrooms;
        if (beds === null || beds === undefined) return false;
        if (roomsTarget >= 4 ? beds < 4 : beds !== roomsTarget) return false;
      }
      if (minPrice !== undefined || maxPrice !== undefined) {
        if (row.price === null) return false;
        if (minPrice !== undefined && row.price < minPrice) return false;
        if (maxPrice !== undefined && row.price > maxPrice) return false;
      }
      if (wantPortals) {
        const rowPortals = row.portals ?? [];
        if (!filters.portals!.every((p) => rowPortals.includes(p))) return false;
      }
      return true;
    });
  }, [wantPrimary, wantSecondary, primary.data, secondary.data, filters]);

  const total =
    (wantPrimary ? (primary.data?.pages[0]?.total ?? 0) : 0) +
    (wantSecondary ? (secondary.data?.pages[0]?.totalItems ?? 0) : 0);

  const loadMore = () => {
    if (wantPrimary && primary.hasNextPage && !primary.isFetchingNextPage) {
      primary.fetchNextPage().catch(() => {});
    }
    if (wantSecondary && secondary.hasNextPage && !secondary.isFetchingNextPage) {
      secondary.fetchNextPage().catch(() => {});
    }
  };

  const refetch = () => {
    if (wantPrimary) primary.refetch().catch(() => {});
    if (wantSecondary) secondary.refetch().catch(() => {});
  };

  return {
    rows,
    total,
    isLoading: (wantPrimary && primary.isLoading) || (wantSecondary && secondary.isLoading),
    isError: (wantPrimary && primary.isError) || (wantSecondary && secondary.isError),
    isRefetching: primary.isRefetching || secondary.isRefetching,
    isFetchingNextPage: primary.isFetchingNextPage || secondary.isFetchingNextPage,
    hasNextPage:
      (wantPrimary && primary.hasNextPage === true) ||
      (wantSecondary && secondary.hasNextPage === true),
    loadMore,
    refetch,
  };
}
```

- [ ] **Step 2: Typecheck, lint, commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/features/listings/hooks/use-sell-listings.ts
git commit -m "feat(listings): add useSellListings merge + client-filter hook"
```

---

### Task 6: Lifecycle tabs + market segment components

**Files:**

- Create: `src/features/listings/components/ListingsLifecycleTabs.tsx`
- Create: `src/features/listings/components/ListingsMarketSegment.tsx`

**Interfaces:**

- Consumes: `ListingsLifecycle`, `ListingMarket` (Task 1).
- Produces: `ListingsLifecycleTabs({ value, onChange })`, `ListingsMarketSegment({ value, onChange })`.

- [ ] **Step 1: Create the lifecycle tabs**

Create `src/features/listings/components/ListingsLifecycleTabs.tsx`:

```typescript
import { Pressable, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import type { ListingsLifecycle } from '../types';

const TABS: readonly { label: string; value: ListingsLifecycle }[] = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Sold', value: 'sold' },
];

interface Props {
  value: ListingsLifecycle;
  onChange: (v: ListingsLifecycle) => void;
}

export function ListingsLifecycleTabs({ value, onChange }: Readonly<Props>) {
  return (
    <View className="mx-4 mt-2 flex-row rounded-full border border-border bg-card p-1">
      {TABS.map((tab) => {
        const active = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange(tab.value)}
            className={cn(
              'flex-1 items-center rounded-full py-2',
              active ? 'bg-brand' : 'bg-transparent',
            )}
          >
            <Text
              className={cn(
                'text-xs font-semibold',
                active ? 'text-brand-foreground' : 'text-muted-foreground',
              )}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 2: Create the market segment**

Create `src/features/listings/components/ListingsMarketSegment.tsx`:

```typescript
import { Pressable, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import type { ListingMarket } from '../types';

const SEGMENTS: readonly { label: string; value: ListingMarket }[] = [
  { label: 'All', value: 'all' },
  { label: 'Primary', value: 'primary' },
  { label: 'Secondary', value: 'secondary' },
];

interface Props {
  value: ListingMarket;
  onChange: (v: ListingMarket) => void;
}

export function ListingsMarketSegment({ value, onChange }: Readonly<Props>) {
  return (
    <View className="mt-3 flex-row gap-2 px-4">
      {SEGMENTS.map((seg) => {
        const active = seg.value === value;
        return (
          <Pressable
            key={seg.value}
            onPress={() => onChange(seg.value)}
            className={cn(
              'rounded-full px-3.5 py-1.5',
              active ? 'bg-brand' : 'border border-border bg-card',
            )}
          >
            <Text
              className={cn(
                'text-xs font-semibold',
                active ? 'text-brand-foreground' : 'text-foreground',
              )}
            >
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 3: Typecheck, lint, commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/features/listings/components/ListingsLifecycleTabs.tsx src/features/listings/components/ListingsMarketSegment.tsx
git commit -m "feat(listings): add lifecycle tabs and market segment controls"
```

---

### Task 7: Unified listing card

**Files:**

- Create: `src/features/listings/components/UnifiedListingCard.tsx`

**Interfaces:**

- Consumes: `UnifiedListingRow`, `ListingStatus`, `STATUS_LABEL`, `STATUS_BADGE_VARIANT`, `BadgeTone` (types), `PORTAL_META` (Task 1), `HERO_GRADIENT` (visuals), `formatCurrency`, `Icon`, `Text`, `useThemeColor`.
- Produces: `UnifiedListingCard({ row })`.

> NOTE: Reuses the visual language of the existing `ListingCard`. `row.status` is a free string; the status badge falls back to the raw value if it isn't a known `ListingStatus`. Secondary rows are tappable → `/listings/{id}`; primary rows render in a non-pressable `View` (no mobile detail in v1).

- [ ] **Step 1: Create the card**

Create `src/features/listings/components/UnifiedListingCard.tsx`:

```typescript
import { Image, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { formatCurrency } from '@/lib/format/currency';
import { useThemeColor, type ColorToken } from '@theme';
import {
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
  type BadgeTone,
  type ListingStatus,
  type UnifiedListingRow,
} from '../types';
import { HERO_GRADIENT } from '../lib/visuals';
import { PORTAL_META } from '../lib/filters';

const STATUS_ACCENT: Record<BadgeTone, { token: ColorToken; textClass: string; icon: IconName }> = {
  successSoft: { token: '--success', textClass: 'text-success', icon: 'CircleCheck' },
  infoSoft: { token: '--info', textClass: 'text-info', icon: 'Clock' },
  warningSoft: { token: '--warning', textClass: 'text-warning', icon: 'TriangleAlert' },
  destructiveSoft: { token: '--destructive', textClass: 'text-destructive', icon: 'CircleX' },
  mutedSoft: { token: '--muted-foreground', textClass: 'text-muted-foreground', icon: 'Circle' },
};

function isKnownStatus(status: string): status is ListingStatus {
  return status in STATUS_LABEL;
}

function StatusBadge({ status }: Readonly<{ status: string }>) {
  const tone: BadgeTone = isKnownStatus(status) ? STATUS_BADGE_VARIANT[status] : 'mutedSoft';
  const label = isKnownStatus(status) ? STATUS_LABEL[status] : status;
  const accent = STATUS_ACCENT[tone];
  const color = useThemeColor(accent.token);
  return (
    <View className="flex-row items-center gap-1">
      <Icon name={accent.icon} size={13} color={color} />
      <Text className={`text-xs font-semibold ${accent.textClass}`}>{label}</Text>
    </View>
  );
}

function Stat({ icon, value }: Readonly<{ icon: IconName; value: string }>) {
  const mutedFg = useThemeColor('--muted-foreground');
  return (
    <View className="min-w-0 shrink flex-row items-center gap-1">
      <Icon name={icon} size={14} color={mutedFg} />
      <Text className="shrink text-xs text-muted-foreground" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function PortalPills({ portals }: Readonly<{ portals: UnifiedListingRow['portals'] }>) {
  if (!portals || portals.length === 0) return null;
  return (
    <View className="mt-2 flex-row gap-1">
      {portals.map((p) => {
        const meta = PORTAL_META[p];
        return (
          <View
            key={p}
            className="h-5 w-7 items-center justify-center rounded"
            style={{ backgroundColor: meta.bg }}
          >
            <Text className="text-[10px] font-bold text-white">{meta.mark}</Text>
          </View>
        );
      })}
    </View>
  );
}

function CardBody({ row }: Readonly<{ row: UnifiedListingRow }>) {
  const mutedFg = useThemeColor('--muted-foreground');
  const upColor = useThemeColor('--success');
  const downColor = useThemeColor('--destructive');
  const price = formatCurrency(row.price);
  const size = row.sizeSqft ? `${row.sizeSqft.toLocaleString()} sqft` : null;
  const trendIcon: IconName | null =
    row.priceTrend === 'up' ? 'TrendingUp' : row.priceTrend === 'down' ? 'TrendingDown' : null;
  const trendColor = row.priceTrend === 'up' ? upColor : downColor;

  return (
    <>
      <View className="h-[76px] w-[76px] overflow-hidden rounded-2xl bg-muted">
        {row.heroImageUrl ? (
          <Image
            source={{ uri: row.heroImageUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : (
          <LinearGradient
            colors={HERO_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: '100%', height: '100%' }}
          >
            <View className="flex-1 items-center justify-center">
              <Icon name="Building2" size={26} color="rgba(255,255,255,0.4)" />
            </View>
          </LinearGradient>
        )}
      </View>

      <View className="min-w-0 flex-1">
        <View className="flex-row items-start gap-2">
          <Text className="flex-1 text-sm font-bold leading-tight text-foreground" numberOfLines={1}>
            {row.title}
          </Text>
          <StatusBadge status={row.status} />
        </View>

        <View className="mt-1 flex-row items-center gap-2">
          <View className="rounded bg-muted px-1.5 py-0.5">
            <Text className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {row.kind === 'primary' ? 'Primary' : 'Secondary'}
            </Text>
          </View>
          {row.propertyType ? (
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {row.propertyType}
            </Text>
          ) : null}
        </View>

        {row.location ? (
          <View className="mt-1 flex-row items-center gap-1">
            <Icon name="MapPin" size={12} color={mutedFg} />
            <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
              {row.location}
            </Text>
          </View>
        ) : null}

        <View className="mt-2 flex-row items-center gap-3">
          {Number.isFinite(row.bedrooms) ? <Stat icon="Bed" value={String(row.bedrooms)} /> : null}
          {Number.isFinite(row.bathrooms) ? (
            <Stat icon="Bath" value={String(row.bathrooms)} />
          ) : null}
          {size ? <Stat icon="Maximize2" value={size} /> : null}
          {price ? (
            <View className="ml-auto flex-row items-center gap-1">
              {trendIcon ? <Icon name={trendIcon} size={13} color={trendColor} /> : null}
              <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
                {price}
              </Text>
            </View>
          ) : null}
        </View>

        {row.agentName || row.permitNumber ? (
          <View className="mt-1 flex-row items-center gap-3">
            {row.agentName ? (
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                Agent: <Text className="font-medium text-foreground">{row.agentName}</Text>
              </Text>
            ) : null}
            {row.permitNumber ? (
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                Permit: {row.permitNumber}
              </Text>
            ) : null}
          </View>
        ) : null}

        <PortalPills portals={row.portals} />
      </View>
    </>
  );
}

const CARD_CLASS = 'flex-row gap-3 rounded-3xl border border-border bg-card p-3';
const CARD_SHADOW = {
  shadowColor: '#101827',
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

export function UnifiedListingCard({ row }: Readonly<{ row: UnifiedListingRow }>) {
  if (row.kind === 'secondary') {
    return (
      <Pressable
        onPress={() => router.push(`/listings/${row.id}`)}
        className={`${CARD_CLASS} active:opacity-95`}
        style={CARD_SHADOW}
      >
        <CardBody row={row} />
      </Pressable>
    );
  }
  return (
    <View className={CARD_CLASS} style={CARD_SHADOW}>
      <CardBody row={row} />
    </View>
  );
}
```

- [ ] **Step 2: Typecheck, lint, commit**

> If `tsc` flags any `IconName` (e.g. `'TrendingUp'`, `'TrendingDown'`) as not assignable, the lucide key is valid (these exist in `lucide-react-native`); if the project's `IconName` union is generated/narrowed, pick the nearest existing arrow icon from `src/components/atoms/Icon` and use it instead.

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/features/listings/components/UnifiedListingCard.tsx
git commit -m "feat(listings): add unified listing card"
```

---

### Task 8: Unified filters sheet

**Files:**

- Create: `src/features/listings/components/UnifiedListingsFiltersSheet.tsx`

**Interfaces:**

- Consumes: `UnifiedFilterDraft` (Task 5), `STATUS_FILTER_OPTIONS`/`ROOM_PILLS`/`PRICE_OPTIONS`/`PORTAL_META`/`PORTAL_ORDER` (Task 1), `useListingAgents` (existing), `useDeveloperOptions` (Task 4), `Select`/`Input`/`Button`/`Icon`/`Text` atoms.
- Produces: `UnifiedListingsFiltersSheet({ visible, initial, propertyTypeOptions, onClose, onApply })`.

> Pattern note: copy the Modal + nested `GestureHandlerRootView` + `BottomSheetModalProvider` wrapper from the existing `ListingsFiltersSheet.tsx` verbatim (required so the `Select` gorhom sheet portals inside the native Modal). Only the sections change.

- [ ] **Step 1: Create the sheet**

Create `src/features/listings/components/UnifiedListingsFiltersSheet.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { vars } from 'nativewind';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/Select';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useTheme } from '@theme';
import { tokens } from '@theme/tokens';
import { useListingAgents } from '../hooks/use-listing-agents';
import { useDeveloperOptions } from '../hooks/use-developers';
import { PORTAL_META, PORTAL_ORDER, PRICE_OPTIONS, ROOM_PILLS, STATUS_FILTER_OPTIONS } from '../lib/filters';
import type { ListingPortal } from '../types';
import type { UnifiedFilterDraft } from '../hooks/use-sell-listings';

function Section({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <View className="mb-5">
      <Text className="mb-2 text-sm font-semibold text-foreground">{title}</Text>
      {children}
    </View>
  );
}

function Pill({
  label,
  active,
  onPress,
}: Readonly<{ label: string; active: boolean; onPress: () => void }>) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'rounded-full px-3.5 py-2',
        active ? 'bg-brand' : 'border border-border bg-card',
      )}
    >
      <Text
        className={cn('text-xs font-semibold', active ? 'text-brand-foreground' : 'text-foreground')}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface Props {
  visible: boolean;
  initial: UnifiedFilterDraft;
  propertyTypeOptions: string[];
  onClose: () => void;
  onApply: (next: UnifiedFilterDraft) => void;
}

export function UnifiedListingsFiltersSheet({
  visible,
  initial,
  propertyTypeOptions,
  onClose,
  onApply,
}: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const palette = vars(tokens[colorScheme]);
  const [draft, setDraft] = useState<UnifiedFilterDraft>(initial);
  const { data: agents, isLoading: agentsLoading } = useListingAgents();
  const { data: developers, isLoading: developersLoading } = useDeveloperOptions();

  useEffect(() => {
    if (visible) setDraft(initial);
  }, [visible, initial]);

  const reset = () => setDraft({});

  const statusValue = STATUS_FILTER_OPTIONS.find((o) => o.value === (draft.status ?? ''));
  const priceValue = PRICE_OPTIONS.find((o) => o.value === (draft.priceValue ?? ''));
  const agentValue =
    draft.agentId && draft.agentLabel ? { value: draft.agentId, label: draft.agentLabel } : undefined;
  const developerValue =
    draft.developerId && draft.developerLabel
      ? { value: draft.developerId, label: draft.developerLabel }
      : undefined;
  const propertyTypeValue = draft.propertyType
    ? { value: draft.propertyType, label: draft.propertyType }
    : undefined;

  const togglePortal = (p: ListingPortal) => {
    const set = new Set(draft.portals ?? []);
    if (set.has(p)) set.delete(p);
    else set.add(p);
    setDraft({ ...draft, portals: set.size ? [...set] : undefined });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          <View className="flex-1 bg-background" style={[palette, { paddingTop: insets.top }]}>
            <View className="flex-row items-center justify-between border-b border-border px-5 py-3">
              <Pressable onPress={onClose} hitSlop={8}>
                <Icon name="X" size={22} />
              </Pressable>
              <Text className="text-base font-semibold text-foreground">Filters</Text>
              <Pressable onPress={reset} hitSlop={8}>
                <Text className="text-sm font-medium text-brand">Reset</Text>
              </Pressable>
            </View>

            <ScrollView
              className="flex-1"
              contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            >
              <Section title="Status">
                <Select
                  value={statusValue?.value ? { value: statusValue.value, label: statusValue.label } : undefined}
                  onValueChange={(opt) => setDraft({ ...draft, status: opt?.value || undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent title="Status">
                    {STATUS_FILTER_OPTIONS.filter((o) => o.value !== '').map((o) => (
                      <SelectItem key={o.value} value={o.value} label={o.label} />
                    ))}
                  </SelectContent>
                </Select>
              </Section>

              <Section title="Property Type">
                <Select
                  value={propertyTypeValue}
                  onValueChange={(opt) => setDraft({ ...draft, propertyType: opt?.value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent title="Property Type">
                    {propertyTypeOptions.map((t) => (
                      <SelectItem key={t} value={t} label={t} />
                    ))}
                  </SelectContent>
                </Select>
              </Section>

              <Section title="Rooms">
                <View className="flex-row flex-wrap gap-2">
                  {ROOM_PILLS.map((r) => (
                    <Pill
                      key={r.value}
                      label={r.label}
                      active={draft.rooms === r.value}
                      onPress={() =>
                        setDraft({ ...draft, rooms: draft.rooms === r.value ? undefined : r.value })
                      }
                    />
                  ))}
                </View>
              </Section>

              <Section title="Price">
                <Select
                  value={priceValue?.value ? { value: priceValue.value, label: priceValue.label } : undefined}
                  onValueChange={(opt) => setDraft({ ...draft, priceValue: opt?.value || undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any price" />
                  </SelectTrigger>
                  <SelectContent title="Price">
                    {PRICE_OPTIONS.filter((o) => o.value !== '').map((o) => (
                      <SelectItem key={o.value} value={o.value} label={o.label} />
                    ))}
                  </SelectContent>
                </Select>
              </Section>

              <Section title="Developer">
                <Select
                  value={developerValue}
                  onValueChange={(opt) =>
                    setDraft({ ...draft, developerId: opt?.value, developerLabel: opt?.label })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={developersLoading ? 'Loading…' : 'All developers'} />
                  </SelectTrigger>
                  <SelectContent title="Developer" loading={developersLoading}>
                    {developers.map((d) => (
                      <SelectItem key={d.value} value={d.value} label={d.label} />
                    ))}
                  </SelectContent>
                </Select>
              </Section>

              <Section title="Unit Number">
                <Input
                  value={draft.unitNumber ?? ''}
                  onChangeText={(v) => setDraft({ ...draft, unitNumber: v })}
                  placeholder="Unit number…"
                  returnKeyType="search"
                />
              </Section>

              <Section title="Portals">
                <View className="flex-row flex-wrap gap-2">
                  {PORTAL_ORDER.map((p) => (
                    <Pill
                      key={p}
                      label={PORTAL_META[p].label}
                      active={(draft.portals ?? []).includes(p)}
                      onPress={() => togglePortal(p)}
                    />
                  ))}
                </View>
              </Section>

              <Section title="Agent">
                <Select
                  value={agentValue}
                  onValueChange={(opt) =>
                    setDraft({ ...draft, agentId: opt?.value, agentLabel: opt?.label })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={agentsLoading ? 'Loading agents…' : 'All agents'} />
                  </SelectTrigger>
                  <SelectContent title="Agent" loading={agentsLoading}>
                    {(agents ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id} label={a.name} />
                    ))}
                  </SelectContent>
                </Select>
              </Section>
            </ScrollView>

            <View
              className="border-t border-border bg-background px-5 py-3"
              style={{ paddingBottom: 12 + insets.bottom }}
            >
              <Button
                onPress={() => {
                  onApply({
                    ...draft,
                    unitNumber: draft.unitNumber?.trim() ? draft.unitNumber.trim() : undefined,
                  });
                  onClose();
                }}
              >
                <Text>Apply Filters</Text>
              </Button>
            </View>
          </View>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </Modal>
  );
}
```

- [ ] **Step 2: Typecheck, lint, commit**

> If `tsc` flags the `Select` `value`/`onValueChange` option shape, match it to the exact prop types already used in `ListingsFiltersSheet.tsx` (it uses `{ value, label }` objects and `opt?.value`/`opt?.label`). Adjust only to satisfy the existing `Select` API.

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/features/listings/components/UnifiedListingsFiltersSheet.tsx
git commit -m "feat(listings): add unified filters sheet (all 8 web filters)"
```

---

### Task 9: Unified listings list

**Files:**

- Create: `src/features/listings/components/UnifiedListingsList.tsx`

**Interfaces:**

- Consumes: `SellListingsState` fields via props, `UnifiedListingRow` (Task 1), `UnifiedListingCard` (Task 7), `ListingsSearchRow` (existing), `ListingsLifecycleTabs`/`ListingsMarketSegment` (Task 6), `EmptyState`/`Text` atoms, `useBottomTabBarSpace`, `useThemeColor`.
- Produces: `UnifiedListingsList(props)`.

> Modeled on the existing `AllListingsList.tsx` (sticky header + FlatList + count row + footer spinner + pull-to-refresh + onEndReached), but the sticky header carries lifecycle tabs + market segment + search instead of status pills, and rows are `UnifiedListingRow`.

- [ ] **Step 1: Create the list**

Create `src/features/listings/components/UnifiedListingsList.tsx`:

```typescript
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { EmptyState } from '@/components/atoms/EmptyState';
import { Text } from '@/components/atoms/Text';
import { useBottomTabBarSpace } from '@/features/new-projects/components/BottomTabBar';
import { useThemeColor } from '@theme';
import type { ListingMarket, ListingsLifecycle, UnifiedListingRow } from '../types';
import { ListingsLifecycleTabs } from './ListingsLifecycleTabs';
import { ListingsMarketSegment } from './ListingsMarketSegment';
import { ListingsSearchRow } from './ListingsSearchRow';
import { UnifiedListingCard } from './UnifiedListingCard';

type Row =
  | { kind: 'sticky' }
  | { kind: 'count'; total: number }
  | { kind: 'loading' }
  | { kind: 'empty'; isError: boolean }
  | { kind: 'listing'; row: UnifiedListingRow };

const STICKY_INDEX = 0;

function keyExtractor(row: Row): string {
  switch (row.kind) {
    case 'sticky':
      return '__sticky__';
    case 'count':
      return '__count__';
    case 'loading':
      return '__loading__';
    case 'empty':
      return '__empty__';
    case 'listing':
      return `${row.row.kind}:${row.row.id}`;
  }
}

interface StickyHeaderProps {
  withBorder: boolean;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onOpenFilters: () => void;
  filterCount: number;
  lifecycle: ListingsLifecycle;
  onLifecycleChange: (l: ListingsLifecycle) => void;
  market: ListingMarket;
  onMarketChange: (m: ListingMarket) => void;
}

function StickyHeader({
  withBorder,
  searchValue,
  onSearchChange,
  onOpenFilters,
  filterCount,
  lifecycle,
  onLifecycleChange,
  market,
  onMarketChange,
}: Readonly<StickyHeaderProps>) {
  return (
    <View className={`bg-background pb-3 pt-1 ${withBorder ? 'border-b border-border' : ''}`}>
      <ListingsLifecycleTabs value={lifecycle} onChange={onLifecycleChange} />
      <ListingsMarketSegment value={market} onChange={onMarketChange} />
      <View className="mt-1">
        <ListingsSearchRow
          value={searchValue}
          onChange={onSearchChange}
          onOpenFilters={onOpenFilters}
          filterCount={filterCount}
        />
      </View>
    </View>
  );
}

function CountRow({ total }: Readonly<{ total: number }>) {
  return (
    <View className="px-4 pb-1 pt-3">
      <Text className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {total.toLocaleString()} {total === 1 ? 'Listing' : 'Listings'}
      </Text>
    </View>
  );
}

function EmptyRow({ isError }: Readonly<{ isError: boolean }>) {
  return (
    <EmptyState
      icon="Building2"
      title={isError ? 'Could not load listings' : 'No listings found'}
      description={
        isError ? 'Pull down to refresh.' : 'Try adjusting your search, tabs, or filters.'
      }
    />
  );
}

export interface UnifiedListingsListProps {
  rows: UnifiedListingRow[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  onLoadMore: () => void;
  onRefresh: () => void;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onOpenFilters: () => void;
  filterCount: number;
  lifecycle: ListingsLifecycle;
  onLifecycleChange: (l: ListingsLifecycle) => void;
  market: ListingMarket;
  onMarketChange: (m: ListingMarket) => void;
}

export function UnifiedListingsList({
  rows,
  total,
  isLoading,
  isError,
  isRefetching,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
  onRefresh,
  searchValue,
  onSearchChange,
  onOpenFilters,
  filterCount,
  lifecycle,
  onLifecycleChange,
  market,
  onMarketChange,
}: Readonly<UnifiedListingsListProps>) {
  const tabBarSpace = useBottomTabBarSpace();
  const brand = useThemeColor('--brand');
  const [scrolled, setScrolled] = useState(false);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    setScrolled((prev) => {
      const next = y > 4;
      return prev === next ? prev : next;
    });
  }, []);

  const listRows = useMemo<Row[]>(() => {
    const out: Row[] = [{ kind: 'sticky' }];
    out.push({ kind: 'count', total });
    if (rows.length === 0) {
      if (isLoading) out.push({ kind: 'loading' });
      else out.push({ kind: 'empty', isError });
    } else {
      for (const row of rows) out.push({ kind: 'listing', row });
    }
    return out;
  }, [rows, total, isLoading, isError]);

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) onLoadMore();
  };

  const listFooter = isFetchingNextPage ? (
    <View className="py-6">
      <ActivityIndicator color={brand} />
    </View>
  ) : null;

  const renderRow = ({ item }: { item: Row }) => {
    switch (item.kind) {
      case 'sticky':
        return (
          <StickyHeader
            withBorder={scrolled}
            searchValue={searchValue}
            onSearchChange={onSearchChange}
            onOpenFilters={onOpenFilters}
            filterCount={filterCount}
            lifecycle={lifecycle}
            onLifecycleChange={onLifecycleChange}
            market={market}
            onMarketChange={onMarketChange}
          />
        );
      case 'count':
        return <CountRow total={item.total} />;
      case 'loading':
        return (
          <View className="items-center py-12">
            <ActivityIndicator color={brand} />
          </View>
        );
      case 'empty':
        return <EmptyRow isError={item.isError} />;
      case 'listing':
        return (
          <View className="px-4 pb-4">
            <UnifiedListingCard row={item.row} />
          </View>
        );
    }
  };

  return (
    <FlatList
      data={listRows}
      keyExtractor={keyExtractor}
      renderItem={renderRow}
      stickyHeaderIndices={[STICKY_INDEX]}
      ListFooterComponent={listFooter}
      contentContainerStyle={{ paddingBottom: tabBarSpace + 80 }}
      showsVerticalScrollIndicator={false}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      onEndReachedThreshold={0.5}
      onEndReached={handleEndReached}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching && !isFetchingNextPage}
          onRefresh={onRefresh}
          tintColor={brand}
        />
      }
    />
  );
}
```

- [ ] **Step 2: Typecheck, lint, commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/features/listings/components/UnifiedListingsList.tsx
git commit -m "feat(listings): add unified listings list"
```

---

### Task 10: Sell listings screen

**Files:**

- Create: `src/features/listings/components/SellListingsScreen.tsx`

**Interfaces:**

- Consumes: `useSellListings`/`countActiveFilters`/`propertyTypeOptionsFromRows`/`UnifiedFilterDraft` (Task 5), `UnifiedListingsList` (Task 9), `UnifiedListingsFiltersSheet` (Task 8), `useDebouncedValue` (existing), `MAIN_HEADER_HEIGHT` (existing).
- Produces: `SellListingsScreen()`.

- [ ] **Step 1: Create the screen**

Create `src/features/listings/components/SellListingsScreen.tsx`:

```typescript
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAIN_HEADER_HEIGHT } from '@/components/organisms';
import { Text } from '@/components/atoms/Text';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import {
  countActiveFilters,
  propertyTypeOptionsFromRows,
  useSellListings,
  type UnifiedFilterDraft,
} from '../hooks/use-sell-listings';
import type { ListingMarket, ListingsLifecycle } from '../types';
import { UnifiedListingsFiltersSheet } from './UnifiedListingsFiltersSheet';
import { UnifiedListingsList } from './UnifiedListingsList';

export function SellListingsScreen() {
  const insets = useSafeAreaInsets();

  const [lifecycle, setLifecycle] = useState<ListingsLifecycle>('active');
  const [market, setMarket] = useState<ListingMarket>('all');
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<UnifiedFilterDraft>({});
  const [sheetVisible, setSheetVisible] = useState(false);

  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300);
  const filterCount = countActiveFilters(filters);

  const state = useSellListings({
    lifecycle,
    market,
    search: debouncedSearch,
    filters,
  });

  const propertyTypeOptions = useMemo(
    () => propertyTypeOptionsFromRows(state.rows),
    [state.rows],
  );

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top + MAIN_HEADER_HEIGHT }}>
      <View className="px-4 pb-1 pt-2">
        <Text className="text-[11px] font-semibold uppercase tracking-[3px] text-brand/60">
          For Sale
        </Text>
        <Text className="mt-0.5 text-[28px] font-bold leading-tight tracking-tight text-foreground">
          Listings
        </Text>
      </View>

      <UnifiedListingsList
        rows={state.rows}
        total={state.total}
        isLoading={state.isLoading}
        isError={state.isError}
        isRefetching={state.isRefetching}
        isFetchingNextPage={state.isFetchingNextPage}
        hasNextPage={state.hasNextPage}
        onLoadMore={state.loadMore}
        onRefresh={state.refetch}
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        onOpenFilters={() => setSheetVisible(true)}
        filterCount={filterCount}
        lifecycle={lifecycle}
        onLifecycleChange={setLifecycle}
        market={market}
        onMarketChange={setMarket}
      />

      <UnifiedListingsFiltersSheet
        visible={sheetVisible}
        initial={filters}
        propertyTypeOptions={propertyTypeOptions}
        onClose={() => setSheetVisible(false)}
        onApply={setFilters}
      />
    </View>
  );
}
```

- [ ] **Step 2: Typecheck, lint, commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/features/listings/components/SellListingsScreen.tsx
git commit -m "feat(listings): add sell listings screen"
```

---

### Task 11: Route + nav registration + wire the Sell card

**Files:**

- Create: `app/(app)/listings/sell.tsx`
- Modify: `app/(app)/_layout.tsx`
- Modify: `src/features/listings/components/ListingsLandingScreen.tsx`

**Interfaces:**

- Consumes: `SellListingsScreen` (Task 10), `PERMISSIONS`/`useRequirePermission` (existing), `router` (expo-router).

- [ ] **Step 1: Create the route (mirror `listings/index.tsx` permission gate)**

Create `app/(app)/listings/sell.tsx`:

```typescript
import { Redirect } from 'expo-router';
import { SellListingsScreen } from '@/features/listings/components/SellListingsScreen';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';

export default function SellListingsRoute() {
  const state = useRequirePermission(PERMISSIONS.OPPORTUNITY_LISTING_READ);
  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/listings" />;
  return <SellListingsScreen />;
}
```

- [ ] **Step 2: Register the screen in the Stack**

In `app/(app)/_layout.tsx`, add this line immediately after the `listings/index` screen (line 43):

```typescript
      <Stack.Screen name="listings/sell" />
```

(Default slide animation — it is a detail/push screen, not a tab root.)

- [ ] **Step 3: Wire the Sell card**

In `src/features/listings/components/ListingsLandingScreen.tsx`:

Add the router import at the top (after the existing `react-native` import):

```typescript
import { router } from 'expo-router';
```

Replace the no-op `onSell` (line 47):

```typescript
const onSell = () => router.push('/listings/sell');
```

(Leave `onRent` and `onCreate` as no-ops for now.)

- [ ] **Step 4: Typecheck, lint, commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add "app/(app)/listings/sell.tsx" "app/(app)/_layout.tsx" src/features/listings/components/ListingsLandingScreen.tsx
git commit -m "feat(listings): wire Sell card to sell listings route"
```

- [ ] **Step 5: Manual QA**

Run the app (`pnpm ios` or `pnpm android`). Verify:

1. Listings tab → tap **Sell** → Sell screen opens.
2. Lifecycle tabs switch Active/Inactive/Sold and the list reloads.
3. Market segment All/Primary/Secondary changes which rows show.
4. Search filters by name/community after ~300ms.
5. Filters sheet: each of Status, Property Type, Rooms, Price, Developer, Unit Number, Portals, Agent applies; badge count reflects active filters; Reset clears.
6. Infinite scroll loads more; pull-to-refresh works.
7. Tapping a **Secondary** card opens its detail; a **Primary** card does nothing.
8. **Confirm the primary endpoint:** if Primary/All shows no rows but Secondary does, check the network call to `/api/v1/listings` — fix `PRIMARY_BASE` in `services.primary.ts` if the prefix differs.

---

## Self-Review

**Spec coverage:**

- Unified data (both APIs) → Tasks 2,3,5. ✔
- Lifecycle tabs replacing status pills → Task 6 (`ListingsLifecycleTabs`), used in Task 9 list; old status pills not used on this screen. ✔
- All 8 filters → Task 8 (status, property type, rooms, price, developer, unit number, portals, agent). ✔
- Search → Task 10 (debounced) + Task 9 search row. ✔
- Market segment → Tasks 6, 9, 10. ✔
- Per-card web fields → Task 7 (thumbnail, title, kind, status, price+trend, beds/baths/size, location, type, permit, agent, portals). ✔
- Primary non-tappable, secondary → detail → Task 7. ✔
- Entry wiring → Task 11. ✔
- Compare / stage / inline edit / delete excluded → not implemented. ✔

**Placeholder scan:** No TBD/TODO. Two `> NOTE` blocks are real implementer guidance (endpoint-prefix verification, Select/Icon API matching), not deferred work.

**Type consistency:** `UnifiedFilterDraft` defined in Task 5, consumed in Tasks 8 & 10. `UnifiedListingRow` defined Task 1, used Tasks 2,5,7,9. `usePrimaryListingsInfinite`/`useListingsInfinite` signatures match callers in Task 5. `priceValue`/`rooms`/`portals` keys consistent between draft (Task 5), client filters (Task 5), and sheet (Task 8). `SellListingsState` produced Task 5, consumed Task 9 props in Task 10. Status string handling consistent (Task 7 `isKnownStatus` guard).

**Note on existing code:** `useListingsInfinite` (existing) accepts the extended `ListingsParams` because Task 1 widened `ListingsQuery` with `purpose`/`lifecycle`/`stageId`; the existing `AllListingsScreen` keeps working (it passes a subset). No change needed to `services.ts` — axios forwards the new params.
