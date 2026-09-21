# Mobile Project Listing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only top-level Project Listing screen to boh-mobile (mirroring the web `/my-account/project-management`), reusing the existing `AreaListingCard` and project detail screen, with search + filter only.

**Architecture:** New `ProjectListScreen` under `src/features/projects/`, modeled structurally on `AreasScreen`. It fetches `GET /api/v1/projects` via a new infinite-query hook, maps each project row into the existing `AreaListingItem` shape (so `AreaListingCard` renders it), and adds an optional badge row to the card for Status / Type / Trakheesi QA. A `ProjectFilters` toolbar provides debounced search + four single-select bottom sheets (Status, Type, State, Developer). Entry point is a new "Project List" row in the More sheet; card taps reuse the existing `project-management/[id]` detail.

**Tech Stack:** Expo Router, React Native 0.81, TanStack Query (`useInfiniteQuery`), NativeWind v4, axios (`apiClient`), `@gorhom/bottom-sheet`.

## Global Constraints

- **No test runner** — verify every task with `npx tsc --noEmit` and `pnpm lint`; behavior via manual QA. Do NOT add a test framework or write `*.test.ts` files. (Project rule.)
- **Strict TypeScript** (`strict: true`). Prefer `Readonly<{...}>` on component prop types.
- **Styling:** semantic Tailwind tokens only (`bg-muted`, `text-foreground`, `text-destructive`, `border-input`, etc.) — no hard-coded hex. Merge classes with `cn(...)` from `@/lib/utils`.
- **Path aliases:** `@/*` → `src/*`, `@theme` → `theme/index.ts`.
- **Prettier:** single quotes, semis, trailing commas, 100-col, 2-space. `prettier-plugin-tailwindcss` sorts classes — don't fight it.
- **Read-only feature:** no edit / delete / create UI anywhere on this screen.
- **HTTP envelope:** `apiClient` response interceptor already unwraps `{success,data}` — resolved `data` is the payload (`{ items, total, page, totalPages }`).

---

## Task 1: Extend AreaListingItem + AreaListingCard with the Status / Type / Trakheesi badge row

**Files:**

- Modify: `src/features/areas/models/area-detail.ts` (add optional fields to `AreaListingItem`)
- Modify: `src/features/areas/components/AreaListingCard.tsx` (add `Pill` helper, format helpers, conditional badge row)

**Interfaces:**

- Produces: `AreaListingItem` gains optional `status?: string`, `availabilityType?: string`, `trakheesiPermit?: string`, `trakheesiQrCodeUrl?: string | null` — all RAW enum strings (the card formats + colors them). All optional, so existing Areas mappers (which omit them) are unaffected.

- [ ] **Step 1: Add optional fields to `AreaListingItem`**

In `src/features/areas/models/area-detail.ts`, inside the `AreaListingItem` interface, add after the `projectId` line (line 29):

```ts
  /** Project-listing extras (raw enum strings; card formats/colors them). Omitted by Areas tabs. */
  readonly status?: string;
  readonly availabilityType?: string;
  readonly trakheesiPermit?: string;
  readonly trakheesiQrCodeUrl?: string | null;
```

- [ ] **Step 2: Add `cn` import + `Pill` and label helpers to the card**

In `src/features/areas/components/AreaListingCard.tsx`, add to the imports (after the `formatRelative` import on line 7):

```ts
import { cn } from '@/lib/utils';
```

Then add these module-level helpers below the existing `Field` component (after line 20):

```tsx
function titleCase(raw: string): string {
  return raw.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function Pill({
  label,
  tone = 'default',
}: Readonly<{ label: string; tone?: 'default' | 'danger' }>) {
  return (
    <View
      className={cn(
        'rounded-full px-2 py-0.5',
        tone === 'danger' ? 'bg-destructive/10' : 'bg-muted',
      )}
    >
      <Text
        numberOfLines={1}
        className={cn(
          'text-[11px] font-medium',
          tone === 'danger' ? 'text-destructive' : 'text-foreground',
        )}
      >
        {label}
      </Text>
    </View>
  );
}
```

- [ ] **Step 3: Render the conditional badge row**

In the same file, inside `body`, immediately after the closing `</View>` of the fields grid (after line 77, the `</View>` that closes the `flex-row flex-wrap` block), add:

```tsx
{
  item.status || item.availabilityType || item.trakheesiPermit ? (
    <View className="flex-row flex-wrap items-center gap-2">
      {item.status ? <Pill label={titleCase(item.status)} /> : null}
      {item.availabilityType ? <Pill label={titleCase(item.availabilityType)} /> : null}
      {item.trakheesiPermit ? (
        <View className="flex-row items-center gap-1">
          <Pill
            label={`Trakheesi: ${titleCase(item.trakheesiPermit)}`}
            tone={item.trakheesiPermit === 'expired' ? 'danger' : 'default'}
          />
          {item.trakheesiQrCodeUrl ? (
            <Image
              source={{ uri: item.trakheesiQrCodeUrl }}
              className="h-8 w-8 rounded"
              resizeMode="contain"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  ) : null;
}
```

(`Image`, `View`, `Text` are already imported in this file.)

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: no errors. (Areas screen still compiles because the new fields are optional and its mappers don't set them.)

- [ ] **Step 5: Commit**

```bash
git add src/features/areas/models/area-detail.ts src/features/areas/components/AreaListingCard.tsx
git commit -m "feat(card): optional status/type/trakheesi badge row on AreaListingCard"
```

---

## Task 2: Extend the mobile Project model + mapper with status & trakheesi fields

**Files:**

- Modify: `src/features/projects/models.ts` (add fields to `Project`)
- Modify: `src/features/projects/services.ts` (set them in `toProject`)

**Interfaces:**

- Produces: `Project` gains `status: string | null`, `trakheesiPermitStatus: string | null`, `trakheesiQrCodeUrl: string | null`. (`availability` already exists on the model.)

- [ ] **Step 1: Add fields to the `Project` interface**

In `src/features/projects/models.ts`, inside `interface Project`, add after the `availability` line (line 31):

```ts
  readonly status: string | null;
  readonly trakheesiPermitStatus: string | null;
  readonly trakheesiQrCodeUrl: string | null;
```

- [ ] **Step 2: Map them in `toProject`**

In `src/features/projects/services.ts`, inside `toProject`'s returned object, add after the `availability: str(r.availability),` line (line 69):

```ts
    status: str(r.status),
    trakheesiPermitStatus: str(r.trakheesiPermitStatus),
    trakheesiQrCodeUrl: str(r.trakheesiQrCodeUrl),
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/projects/models.ts src/features/projects/services.ts
git commit -m "feat(projects): add status + trakheesi fields to Project model/mapper"
```

---

## Task 3: Add the project-list service (`getProjectsPage`) + developers fetch

**Files:**

- Modify: `src/features/projects/services.ts`

**Interfaces:**

- Consumes: `AreaListingItem`, `AreaListingsPage` from `@/features/areas/models/area-detail`; `AreaOption` from `@/features/areas/components/AreaOptionSheet`.
- Produces:
  - `ProjectListFilters` — `{ search?: string; status?: string; availability?: string; stateId?: string; developerId?: string }`
  - `getProjectsPage(filters: ProjectListFilters, page: number): Promise<AreaListingsPage>`
  - `getDevelopers(search?: string): Promise<AreaOption[]>` (value = developer id, label = brandName)

- [ ] **Step 1: Add imports**

In `src/features/projects/services.ts`, add after the existing model import block (after line 21):

```ts
import type { AreaListingItem, AreaListingsPage } from '@/features/areas/models/area-detail';
import type { AreaOption } from '@/features/areas/components/AreaOptionSheet';
```

- [ ] **Step 2: Add the filters type + row mapper + page fetch**

In the same file, add at the end of the file:

```ts
// ─── Project listing (top-level read-only list) ──────────────────────────────

const LIST_LIMIT = 12;

export interface ProjectListFilters {
  readonly search?: string;
  readonly status?: string;
  readonly availability?: string;
  readonly stateId?: string;
  readonly developerId?: string;
}

/** GET /api/v1/projects row → rich card shape (with project-listing badge extras). */
function toListingItem(raw: unknown): AreaListingItem | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r.id !== 'string') return null;
  const heroMany = arr(r.heroImageUrls).filter((u): u is string => typeof u === 'string');
  const heroOne = str(r.heroImageUrl);
  const area =
    [str(r.neighbourhoodName) ?? str(r.neighborhood), str(r.stateName)]
      .filter(Boolean)
      .join(', ') || '—';
  const developer = (r.developer ?? {}) as Record<string, unknown>;
  const startingPrice = num(r.startingPrice);
  const handover =
    str(r.handoverDate) ?? (r.developmentStage === 'handed_over' ? 'Handed Over' : 'N/A');
  return {
    id: r.id,
    imageUrls: heroMany.length > 0 ? heroMany : heroOne ? [heroOne] : [],
    tag: (str(r.propertyUse) ?? 'project').replaceAll('_', ' '),
    title: str(r.projectName) ?? '—',
    price:
      startingPrice === null
        ? 'Price on request'
        : `${startingPrice.toLocaleString()} AED Starting`,
    updatedAt: str(r.updatedAt) ?? '',
    area,
    secondaryLabel: 'Developer',
    secondaryValue: str(developer.brandName) ?? '—',
    handover,
    bedrooms: str(r.bedroomRange) ?? 'N/A',
    size: str(r.sizeRange) ?? 'N/A',
    serviceCharge: 'N/A',
    listingId: null,
    projectId: r.id,
    status: str(r.status) ?? undefined,
    availabilityType: str(r.availability) ?? undefined,
    trakheesiPermit: str(r.trakheesiPermitStatus) ?? undefined,
    trakheesiQrCodeUrl: str(r.trakheesiQrCodeUrl),
  };
}

interface ListEnvelope {
  items?: unknown[];
  total?: number;
  totalPages?: number;
  page?: number;
}

export async function getProjectsPage(
  filters: ProjectListFilters,
  page: number,
): Promise<AreaListingsPage> {
  const { search, status, availability, stateId, developerId } = filters;
  const { data } = await apiClient.get('/api/v1/projects', {
    params: {
      page,
      limit: LIST_LIMIT,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
      ...(availability ? { availability } : {}),
      ...(stateId ? { stateId } : {}),
      ...(developerId ? { developerId } : {}),
    },
  });
  const body = (data ?? {}) as ListEnvelope;
  return {
    items: (body.items ?? []).map(toListingItem).filter((x): x is AreaListingItem => x !== null),
    page: Number(body.page ?? page),
    totalPages: Number(body.totalPages ?? 1),
    total: Number(body.total ?? 0),
  };
}

/** GET /api/v1/developers — options for the Developer filter (id → brandName). */
export async function getDevelopers(search?: string): Promise<AreaOption[]> {
  const { data } = await apiClient.get('/api/v1/developers', {
    params: {
      page: 1,
      limit: 100,
      sortBy: 'brandName',
      sortOrder: 'asc',
      ...(search ? { search } : {}),
    },
  });
  const rows = itemsOf(data) as Record<string, unknown>[];
  return rows
    .filter((r) => typeof r.id === 'string')
    .map((r) => ({ value: r.id as string, label: str(r.brandName) ?? '—' }));
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: no errors. (`num`, `str`, `arr`, `itemsOf`, `apiClient` are already defined/imported in this file.)

- [ ] **Step 4: Commit**

```bash
git add src/features/projects/services.ts
git commit -m "feat(projects): add getProjectsPage + getDevelopers services"
```

---

## Task 4: Add the infinite-query + developers hooks

**Files:**

- Create: `src/features/projects/hooks/use-projects-infinite.ts`
- Create: `src/features/projects/hooks/use-developers.ts`

**Interfaces:**

- Consumes: `getProjectsPage`, `getDevelopers`, `ProjectListFilters` from `../services`; `AreaListingsPage` from `@/features/areas/models/area-detail`; `AreaOption` from `@/features/areas/components/AreaOptionSheet`.
- Produces: `useProjectsInfinite(filters, options?)`, `useDevelopers()`.

- [ ] **Step 1: Create `use-projects-infinite.ts`**

```ts
import { useInfiniteQuery } from '@tanstack/react-query';

import type { AreaListingsPage } from '@/features/areas/models/area-detail';

import { getProjectsPage, type ProjectListFilters } from '../services';

/**
 * Paginated top-level project list. Filter values live in the query key so
 * changing any filter refetches from page 1; the screen's FlatList
 * `onEndReached` drives `fetchNextPage`.
 */
export function useProjectsInfinite(filters: ProjectListFilters, options?: { enabled?: boolean }) {
  const { search, status, availability, stateId, developerId } = filters;
  return useInfiniteQuery<AreaListingsPage, Error>({
    queryKey: [
      'projects',
      'list',
      {
        search: search ?? '',
        status: status ?? '',
        availability: availability ?? '',
        stateId: stateId ?? '',
        developerId: developerId ?? '',
      },
    ],
    queryFn: ({ pageParam }) => getProjectsPage(filters, pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  });
}
```

- [ ] **Step 2: Create `use-developers.ts`**

```ts
import { useQuery } from '@tanstack/react-query';

import type { AreaOption } from '@/features/areas/components/AreaOptionSheet';

import { getDevelopers } from '../services';

/** Developers for the project-list Developer filter. Small set; cached 5 min. */
export function useDevelopers() {
  return useQuery<AreaOption[], Error>({
    queryKey: ['projects', 'developers'],
    queryFn: () => getDevelopers(),
    staleTime: 5 * 60_000,
  });
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/projects/hooks/use-projects-infinite.ts src/features/projects/hooks/use-developers.ts
git commit -m "feat(projects): add useProjectsInfinite + useDevelopers hooks"
```

---

## Task 5: Build the ProjectFilters toolbar

**Files:**

- Create: `src/features/projects/components/ProjectFilters.tsx`

**Interfaces:**

- Consumes: `ProjectListFilters` from `../services`; `useDevelopers` from `../hooks/use-developers`; `useAreaStates` from `@/features/areas/hooks/use-area-states`; `AreaOptionSheet`, `AreaOption` from `@/features/areas/components/AreaOptionSheet`.
- Produces: `<ProjectFilters filters={...} onChange={...} />`.

- [ ] **Step 1: Create `ProjectFilters.tsx`**

```tsx
import * as React from 'react';
import { Pressable, View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { ChevronDown, X } from 'lucide-react-native';
import { useThemeColor } from '@theme';

import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { useAreaStates } from '@/features/areas/hooks/use-area-states';
import { AreaOptionSheet, type AreaOption } from '@/features/areas/components/AreaOptionSheet';
import { cn } from '@/lib/utils';

import { useDevelopers } from '../hooks/use-developers';
import type { ProjectListFilters } from '../services';

const ALL_OPTION: AreaOption = { value: '', label: 'All' };

const STATUS_OPTIONS: AreaOption[] = [
  ALL_OPTION,
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

const TYPE_OPTIONS: AreaOption[] = [
  ALL_OPTION,
  { value: 'off_plan', label: 'Off Plan' },
  { value: 'ready', label: 'Ready' },
  { value: 'sold_out', label: 'Sold Out' },
];

function FilterTrigger({
  label,
  active,
  onPress,
}: Readonly<{ label: string; active: boolean; onPress: () => void }>) {
  const iconColor = useThemeColor('--muted-foreground');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={cn(
        'h-11 flex-1 flex-row items-center justify-between rounded-lg border border-input bg-background px-3 active:opacity-70',
        active && 'border-brand',
      )}
    >
      <Text
        numberOfLines={1}
        className={cn('text-base', active ? 'text-foreground' : 'text-muted-foreground')}
      >
        {label}
      </Text>
      <ChevronDown size={16} color={iconColor} />
    </Pressable>
  );
}

/**
 * Project-list toolbar: debounced text search + Status / Type / State / Developer
 * single-select bottom sheets, with a reset when any filter is active. Read-only
 * — no create/edit/delete actions.
 */
export function ProjectFilters({
  filters,
  onChange,
}: Readonly<{ filters: ProjectListFilters; onChange: (next: ProjectListFilters) => void }>) {
  const statusRef = React.useRef<BottomSheetModal>(null);
  const typeRef = React.useRef<BottomSheetModal>(null);
  const stateRef = React.useRef<BottomSheetModal>(null);
  const developerRef = React.useRef<BottomSheetModal>(null);
  const [searchText, setSearchText] = React.useState(filters.search ?? '');

  const brand = useThemeColor('--brand');

  const { data: states = [] } = useAreaStates();
  const { data: developers = [] } = useDevelopers();

  React.useEffect(() => {
    const id = setTimeout(() => {
      onChange({ ...filters, search: searchText.trim() || undefined });
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const stateOptions: AreaOption[] = [
    ALL_OPTION,
    ...states.map((s) => ({ value: s.id, label: s.name })),
  ];
  const developerOptions: AreaOption[] = [ALL_OPTION, ...developers];

  const statusLabel = STATUS_OPTIONS.find((o) => o.value === filters.status)?.label ?? 'Status';
  const typeLabel = TYPE_OPTIONS.find((o) => o.value === filters.availability)?.label ?? 'Type';
  const stateLabel = states.find((s) => s.id === filters.stateId)?.name ?? 'State';
  const developerLabel =
    developers.find((d) => d.value === filters.developerId)?.label ?? 'Developer';

  const hasActive = Boolean(
    filters.search ||
    filters.status ||
    filters.availability ||
    filters.stateId ||
    filters.developerId,
  );

  const reset = () => {
    setSearchText('');
    onChange({});
  };

  return (
    <View className="gap-2">
      <Input
        placeholder="Search projects"
        value={searchText}
        onChangeText={setSearchText}
        returnKeyType="search"
      />
      <View className="flex-row gap-2">
        <FilterTrigger
          label={statusLabel}
          active={Boolean(filters.status)}
          onPress={() => statusRef.current?.present()}
        />
        <FilterTrigger
          label={typeLabel}
          active={Boolean(filters.availability)}
          onPress={() => typeRef.current?.present()}
        />
      </View>
      <View className="flex-row gap-2">
        <FilterTrigger
          label={stateLabel}
          active={Boolean(filters.stateId)}
          onPress={() => stateRef.current?.present()}
        />
        <FilterTrigger
          label={developerLabel}
          active={Boolean(filters.developerId)}
          onPress={() => developerRef.current?.present()}
        />
      </View>
      {hasActive ? (
        <Pressable
          onPress={reset}
          accessibilityRole="button"
          className="flex-row items-center gap-1 self-start active:opacity-70"
        >
          <X size={14} color={brand} />
          <Text className="text-sm font-medium text-brand">Reset filters</Text>
        </Pressable>
      ) : null}

      <AreaOptionSheet
        title="Select status"
        options={STATUS_OPTIONS}
        selectedValue={filters.status ?? ''}
        onSelect={(value) => onChange({ ...filters, status: value || undefined })}
        sheetRef={statusRef}
      />
      <AreaOptionSheet
        title="Select type"
        options={TYPE_OPTIONS}
        selectedValue={filters.availability ?? ''}
        onSelect={(value) => onChange({ ...filters, availability: value || undefined })}
        sheetRef={typeRef}
      />
      <AreaOptionSheet
        title="Select state"
        options={stateOptions}
        selectedValue={filters.stateId ?? ''}
        onSelect={(value) => onChange({ ...filters, stateId: value || undefined })}
        sheetRef={stateRef}
      />
      <AreaOptionSheet
        title="Select developer"
        options={developerOptions}
        selectedValue={filters.developerId ?? ''}
        onSelect={(value) => onChange({ ...filters, developerId: value || undefined })}
        sheetRef={developerRef}
      />
    </View>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/projects/components/ProjectFilters.tsx
git commit -m "feat(projects): ProjectFilters toolbar (search + status/type/state/developer)"
```

---

## Task 6: Build the ProjectListScreen

**Files:**

- Create: `src/features/projects/components/ProjectListScreen.tsx`

**Interfaces:**

- Consumes: `useProjectsInfinite` from `../hooks/use-projects-infinite`; `ProjectListFilters` from `../services`; `ProjectFilters` from `./ProjectFilters`; `AreaListingCard` from `@/features/areas/components/AreaListingCard`; `AreaListingItem` from `@/features/areas/models/area-detail`; `PERMISSIONS`, `useCan` from `@/lib/rbac`.
- Produces: `ProjectListScreen` (named export).

- [ ] **Step 1: Create `ProjectListScreen.tsx`**

```tsx
import * as React from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { EmptyState } from '@/components/atoms/EmptyState';
import { Icon } from '@/components/atoms/Icon';
import { Skeleton } from '@/components/atoms/Skeleton';
import { Text } from '@/components/atoms/Text';
import { AreaListingCard } from '@/features/areas/components/AreaListingCard';
import type { AreaListingItem } from '@/features/areas/models/area-detail';
import { PERMISSIONS, useCan } from '@/lib/rbac';

import { useProjectsInfinite } from '../hooks/use-projects-infinite';
import type { ProjectListFilters } from '../services';
import { ProjectFilters } from './ProjectFilters';

function ScreenHeader() {
  const { top } = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: top }} className="bg-background">
      <View className="flex-row items-center gap-3 px-4 pb-2 pt-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          className="-ml-1 h-9 w-9 items-center justify-center rounded-full active:opacity-70"
        >
          <Icon name="ArrowLeft" size={24} />
        </Pressable>
        <Text className="text-xl font-bold text-foreground">Project List</Text>
      </View>
    </View>
  );
}

function ListEmpty({ isLoading, isError }: Readonly<{ isLoading: boolean; isError: boolean }>) {
  if (isLoading) {
    return (
      <View className="gap-3 px-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-64 w-full rounded-2xl" />
        ))}
      </View>
    );
  }
  if (isError) {
    return (
      <View className="items-center px-8 pt-10">
        <EmptyState
          icon="CircleAlert"
          title="Couldn't load projects"
          description="Pull down to retry."
        />
      </View>
    );
  }
  return (
    <View className="items-center px-8 pt-10">
      <EmptyState
        icon="Building2"
        title="No projects found"
        description="Try adjusting your filters."
      />
    </View>
  );
}

export function ProjectListScreen() {
  const canAccess = useCan(PERMISSIONS.PROJECTS_READ);
  const [filters, setFilters] = React.useState<ProjectListFilters>({});
  const { bottom } = useSafeAreaInsets();
  const bottomSpace = bottom + 16;

  const {
    data,
    isLoading,
    isError,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useProjectsInfinite(filters, { enabled: canAccess });

  const items: AreaListingItem[] = React.useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  if (!canAccess) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader />
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState
            icon="ShieldOff"
            title="No access"
            description="You don't have permission to view Projects."
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader />
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{
          gap: 12,
          paddingTop: 12,
          paddingBottom: bottomSpace,
          paddingHorizontal: 16,
        }}
        ListHeaderComponent={
          <View className="pb-1">
            <ProjectFilters filters={filters} onChange={setFilters} />
          </View>
        }
        renderItem={({ item }) => <AreaListingCard item={item} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        ListEmptyComponent={<ListEmpty isLoading={isLoading} isError={isError} />}
        onRefresh={() => {
          refetch();
        }}
        refreshing={isRefetching}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="flex-row items-center justify-center gap-2 py-4">
              <ActivityIndicator />
              <Text className="text-sm text-muted-foreground">Loading more projects…</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: no errors. (Confirm `EmptyState`, `Skeleton`, `Icon` atoms accept the `icon`/`name` strings used — `Building2`, `CircleAlert`, `ShieldOff`, `ArrowLeft` are Lucide keys already used elsewhere.)

- [ ] **Step 3: Commit**

```bash
git add src/features/projects/components/ProjectListScreen.tsx
git commit -m "feat(projects): ProjectListScreen (infinite list + filters, read-only)"
```

---

## Task 7: Add the route

**Files:**

- Create: `app/(app)/project-management/index.tsx`

**Interfaces:**

- Consumes: `ProjectListScreen` from `@/features/projects/components/ProjectListScreen`.
- Produces: route `/project-management` (the detail route `/project-management/[id]` already exists and is reused on card tap).

- [ ] **Step 1: Create the reexport route**

```tsx
export { ProjectListScreen as default } from '@/features/projects/components/ProjectListScreen';
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/project-management/index.tsx"
git commit -m "feat(projects): /project-management list route"
```

---

## Task 8: Add the "Project List" row to the More sheet

**Files:**

- Modify: `src/features/more/components/MoreSheet.tsx`

**Interfaces:**

- Consumes: `PERMISSIONS.PROJECTS_READ`, `useCan`.

- [ ] **Step 1: Import the `Building2` icon**

In `src/features/more/components/MoreSheet.tsx`, change the lucide import (line 11) from:

```ts
import { ChevronRight, MapPin } from 'lucide-react-native';
```

to:

```ts
import { Building2, ChevronRight, MapPin } from 'lucide-react-native';
```

- [ ] **Step 2: Add the permission check**

After the `canAreas` line (line 41), add:

```ts
const canProjects = useCan(PERMISSIONS.PROJECTS_READ);
```

- [ ] **Step 3: Add the row**

Replace the `rows` array (lines 51–53) with:

```ts
const rows: MoreRow[] = [
  {
    key: 'projects',
    label: 'Project List',
    icon: Building2,
    href: '/(app)/project-management',
    visible: canProjects,
  },
  { key: 'areas', label: 'Areas', icon: MapPin, href: '/(app)/areas', visible: canAreas },
];
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: no errors. (`MoreRow.icon` is typed `typeof MapPin` — `Building2` is the same Lucide component type, so it satisfies it.)

- [ ] **Step 5: Manual QA**

Run the app (`pnpm ios` or `pnpm android`). Verify:

1. More sheet shows **Project List** above **Areas** (when the user has `projects:read`).
2. Tapping it opens the list; cards render hero, title, price, the field grid, and the **Status / Type / Trakheesi** badge row (QR thumbnail shown when present, red "Trakheesi: Expired" pill when expired).
3. Search debounces and filters the list; each of Status / Type / State / Developer sheets filters; Reset clears all.
4. Pull-to-refresh and infinite scroll both work.
5. Tapping a card opens the existing project detail screen.
6. No edit / delete / create controls anywhere.

- [ ] **Step 6: Commit**

```bash
git add src/features/more/components/MoreSheet.tsx
git commit -m "feat(more): add Project List row to the More sheet"
```

---

## Self-Review Notes

- **Spec coverage:** Entry point (Task 8 + 7), screen (Task 6), data layer + model (Tasks 2–4), card extension w/ pill + QR thumbnail (Task 1), all four filters + search (Task 5), read-only (no actions added anywhere). ✅
- **Open items from spec resolved:** developer endpoint = `GET /api/v1/developers` (verified against web/backend); project-read permission = `PERMISSIONS.PROJECTS_READ` (verified in `src/lib/rbac/permissions.ts`).
- **Type consistency:** `ProjectListFilters` is the single filter type (services → hook → screen → toolbar). `AreaListingItem` extra fields are RAW enum strings set by `toListingItem` and formatted by the card's `titleCase`/`Pill`. `getProjectsPage` returns `AreaListingsPage` consumed by `useProjectsInfinite` (`getNextPageParam` uses `page`/`totalPages`).
