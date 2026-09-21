# Areas Feature + More Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the web Areas list page into boh-mobile and replace the Profile bottom tab with a More tab that opens a bottom sheet linking to the new Areas screen.

**Architecture:** New `src/features/areas/` feature (models → service → TanStack `useInfiniteQuery` hooks → components → screen) reachable at route `app/(app)/areas.tsx`. A store-driven gorhom `BottomSheetModal` (`MoreSheet`) is mounted globally in `app/_layout.tsx`; the `BottomTabBar` `more` tab presents it instead of navigating. Profile stays reachable via the header avatar.

**Tech Stack:** Expo Router v6, React Native 0.81, TanStack Query v5, Zustand, NativeWind v4, `@gorhom/bottom-sheet` v5, axios (`apiClient`), lucide-react-native.

## Global Constraints

- **No unit tests / no TDD** (project rule — see memory `no-unit-tests-boh-mobile`). Verify every task with `pnpm exec tsc --noEmit` + `pnpm lint` + manual QA. No test files.
- **No new dependencies.** Everything needed is already installed.
- Package manager is **pnpm**.
- API base is `apiClient` (`src/lib/api.ts`), base URL `CONFIG.API_BASE_URL`. All location/property-type routes are under `/api/v1/...`. The response interceptor **auto-unwraps** the `{success, data}` envelope, so `response.data` is already the payload (`{items, meta}` for paginated, or a bare array).
- Styling: NativeWind semantic tokens (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-muted`), theme colors via `useThemeColor('--token')` from `@theme`, atoms from `@/components/atoms/*`, icons via lucide / `@/components/atoms/Icon`, `cn` from `@/lib/utils`.
- Permission gating uses `useCan(PERMISSIONS.AREAS_READ)` from `@/lib/rbac` (`'areas:read'`, already mirrored).
- Bottom-sheet pattern reference: `src/features/leads/components/selectors/PrioritySelector.tsx` (modalRef, `renderBackdrop`, `enablePanDownToClose`, `enableDynamicSizing`, theme `--popover` bg). Screen-with-FlatList + BackButton reference: `src/features/attendance/components/AttendanceListScreen.tsx`.

---

### Task 1: Areas data layer (models + service)

**Files:**

- Create: `src/features/areas/models/area.ts`
- Create: `src/features/areas/services.ts`

**Interfaces:**

- Produces:
  - `interface Area { id; name; slug; state: AreaState; image?: string|null; imageAltText?: string|null; counts: AreaCounts; }`
  - `interface AreaState { id: string; name: string; slug: string; }`
  - `interface AreaCounts { new: number; sell: number; rent: number; }`
  - `interface AreasMeta { page: number; limit: number; total: number; totalPages: number; }`
  - `interface AreasPage { items: Area[]; meta: AreasMeta; }`
  - `interface AreaPropertyTypeOption { value: string; label: string; }`
  - `interface NeighbourhoodsPageParams { page: number; limit?: number; search?: string; stateId?: string; propertyType?: string; }`
  - `getNeighbourhoodsPage(params: NeighbourhoodsPageParams): Promise<AreasPage>`
  - `getAreaStates(search?: string): Promise<AreaState[]>`
  - `getAreaPropertyTypes(): Promise<AreaPropertyTypeOption[]>`

- [ ] **Step 1: Create the models file**

Create `src/features/areas/models/area.ts`:

```ts
/**
 * Areas (neighbourhoods) models. Mirrors the web `Neighbourhood` shape from
 * `boh-lead-magnet/src/features/locations/models/neighbourhood.ts`, kept full
 * (counts + image + state) because the Areas grid renders all of it — unlike
 * the leads City/Area selects which only need id+name.
 */
export interface AreaState {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export interface AreaCounts {
  readonly new: number;
  readonly sell: number;
  readonly rent: number;
}

export interface Area {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly state: AreaState;
  readonly image?: string | null;
  readonly imageAltText?: string | null;
  readonly counts: AreaCounts;
}

export interface AreasMeta {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface AreasPage {
  readonly items: Area[];
  readonly meta: AreasMeta;
}

export interface AreaPropertyTypeOption {
  readonly value: string;
  readonly label: string;
}

export interface NeighbourhoodsPageParams {
  readonly page: number;
  readonly limit?: number;
  readonly search?: string;
  readonly stateId?: string;
  readonly propertyType?: string;
}
```

- [ ] **Step 2: Create the service file**

Create `src/features/areas/services.ts`:

```ts
/**
 * Areas data access. Hits the same NestJS endpoints the web app uses:
 *   GET /api/v1/locations/neighbourhoods  (paginated, includes per-area counts)
 *   GET /api/v1/locations/states
 *   GET /api/v1/property-types            (authenticated-only; for the filter)
 * The shared apiClient interceptor unwraps the {success,data} envelope, so the
 * resolved `data` is already the payload.
 */
import { apiClient } from '@/lib/api';

import type {
  Area,
  AreaPropertyTypeOption,
  AreaState,
  AreasMeta,
  AreasPage,
  NeighbourhoodsPageParams,
} from './models/area';

const DEFAULT_LIMIT = 100;

function toState(raw: unknown): AreaState {
  const r = (raw ?? {}) as Partial<AreaState>;
  return { id: String(r.id ?? ''), name: String(r.name ?? ''), slug: String(r.slug ?? '') };
}

function toArea(raw: unknown): Area | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r.id !== 'string' || typeof r.name !== 'string') return null;
  const counts = (r.counts ?? {}) as Partial<Area['counts']>;
  return {
    id: r.id,
    name: r.name,
    slug: typeof r.slug === 'string' ? r.slug : '',
    state: toState(r.state),
    image: (r.image as string | null | undefined) ?? null,
    imageAltText: (r.imageAltText as string | null | undefined) ?? null,
    counts: {
      new: Number(counts.new ?? 0),
      sell: Number(counts.sell ?? 0),
      rent: Number(counts.rent ?? 0),
    },
  };
}

export async function getNeighbourhoodsPage(params: NeighbourhoodsPageParams): Promise<AreasPage> {
  const { page, limit = DEFAULT_LIMIT, search, stateId, propertyType } = params;
  const { data } = await apiClient.get('/api/v1/locations/neighbourhoods', {
    params: {
      page,
      limit,
      sortOrder: 'asc',
      ...(search ? { search } : {}),
      ...(stateId ? { stateId } : {}),
      ...(propertyType ? { propertyType } : {}),
    },
  });
  const body = (data ?? {}) as { items?: unknown[]; meta?: Partial<AreasMeta> };
  const items = (body.items ?? []).map(toArea).filter((a): a is Area => a !== null);
  const meta: AreasMeta = {
    page: Number(body.meta?.page ?? page),
    limit: Number(body.meta?.limit ?? limit),
    total: Number(body.meta?.total ?? items.length),
    totalPages: Number(body.meta?.totalPages ?? 1),
  };
  return { items, meta };
}

export async function getAreaStates(search?: string): Promise<AreaState[]> {
  const { data } = await apiClient.get('/api/v1/locations/states', {
    params: { limit: DEFAULT_LIMIT, sortOrder: 'asc', ...(search ? { search } : {}) },
  });
  const rows = Array.isArray(data) ? data : ((data as { items?: unknown[] })?.items ?? []);
  return rows.map(toState).filter((s) => s.id && s.name);
}

export async function getAreaPropertyTypes(): Promise<AreaPropertyTypeOption[]> {
  const { data } = await apiClient.get('/api/v1/property-types');
  const rows = (Array.isArray(data) ? data : []) as Array<{
    name?: string;
    slug?: string;
    isActive?: boolean;
  }>;
  return rows
    .filter((r) => r.isActive !== false && typeof r.slug === 'string' && typeof r.name === 'string')
    .map((r) => ({ value: r.slug as string, label: r.name as string }));
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `pnpm exec eslint src/features/areas`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/areas/models/area.ts src/features/areas/services.ts
git commit -m "feat(areas): add areas models and data service"
```

---

### Task 2: Areas query hooks

**Files:**

- Create: `src/features/areas/hooks/use-neighbourhoods-infinite.ts`
- Create: `src/features/areas/hooks/use-area-states.ts`
- Create: `src/features/areas/hooks/use-area-property-types.ts`

**Interfaces:**

- Consumes: `getNeighbourhoodsPage`, `getAreaStates`, `getAreaPropertyTypes`, `AreasPage`, `AreaState`, `AreaPropertyTypeOption` (Task 1).
- Produces:
  - `interface AreasFilters { search?: string; stateId?: string; propertyType?: string; }`
  - `useNeighbourhoodsInfinite(filters: AreasFilters)` → TanStack `UseInfiniteQueryResult<InfiniteData<AreasPage>>`.
  - `useAreaStates()` → `UseQueryResult<AreaState[]>`.
  - `useAreaPropertyTypes()` → `UseQueryResult<AreaPropertyTypeOption[]>`.

- [ ] **Step 1: Create the infinite neighbourhoods hook**

Create `src/features/areas/hooks/use-neighbourhoods-infinite.ts`:

```ts
import { useInfiniteQuery } from '@tanstack/react-query';

import { getNeighbourhoodsPage } from '../services';
import type { AreasPage } from '../models/area';

const PAGE_LIMIT = 100;

export interface AreasFilters {
  readonly search?: string;
  readonly stateId?: string;
  readonly propertyType?: string;
}

/**
 * Paginated neighbourhoods for the Areas grid. Replaces the web
 * IntersectionObserver infinite scroll with TanStack `useInfiniteQuery`; the
 * screen's FlatList `onEndReached` drives `fetchNextPage`. Filter values live
 * in the query key so changing any filter refetches from page 1.
 */
export function useNeighbourhoodsInfinite(filters: AreasFilters) {
  const { search, stateId, propertyType } = filters;
  return useInfiniteQuery<AreasPage>({
    queryKey: [
      'areas',
      'neighbourhoods',
      { search: search ?? '', stateId: stateId ?? '', propertyType: propertyType ?? '' },
    ],
    queryFn: ({ pageParam }) =>
      getNeighbourhoodsPage({
        page: pageParam as number,
        limit: PAGE_LIMIT,
        search,
        stateId,
        propertyType,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages ? lastPage.meta.page + 1 : undefined,
    staleTime: 60_000,
  });
}
```

- [ ] **Step 2: Create the states hook**

Create `src/features/areas/hooks/use-area-states.ts`:

```ts
import { useQuery } from '@tanstack/react-query';

import { getAreaStates } from '../services';
import type { AreaState } from '../models/area';

/** Cities (emirates) for the Areas City filter. Small set; fetched once. */
export function useAreaStates() {
  return useQuery<AreaState[], Error>({
    queryKey: ['areas', 'states'],
    queryFn: () => getAreaStates(),
    staleTime: 5 * 60_000,
  });
}
```

- [ ] **Step 3: Create the property-types hook**

Create `src/features/areas/hooks/use-area-property-types.ts`:

```ts
import { useQuery } from '@tanstack/react-query';

import { getAreaPropertyTypes } from '../services';
import type { AreaPropertyTypeOption } from '../models/area';

/** Property-type options for the Areas filter (admin-managed list). */
export function useAreaPropertyTypes() {
  return useQuery<AreaPropertyTypeOption[], Error>({
    queryKey: ['areas', 'property-types'],
    queryFn: () => getAreaPropertyTypes(),
    staleTime: 5 * 60_000,
  });
}
```

- [ ] **Step 4: Type-check + lint**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/features/areas`
Expected: clean. (If `pageParam as number` triggers a lint rule, the type-check confirms it is correct; leave as-is.)

- [ ] **Step 5: Commit**

```bash
git add src/features/areas/hooks
git commit -m "feat(areas): add neighbourhoods infinite-scroll, states, and property-type hooks"
```

---

### Task 3: AreaCard component

**Files:**

- Create: `src/features/areas/components/AreaCard.tsx`

**Interfaces:**

- Consumes: `Area` (Task 1).
- Produces: `AreaCard({ area }: { area: Area })` — non-interactive grid cell.

- [ ] **Step 1: Create the card**

Create `src/features/areas/components/AreaCard.tsx`:

```tsx
import { Image, View } from 'react-native';

import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';

import type { Area } from '../models/area';

function CountChip({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <View className={cn('flex-1 items-center rounded-lg bg-muted px-1 py-1.5', className)}>
      <Text className="text-sm font-semibold text-foreground">{value}</Text>
      <Text className="text-[11px] text-muted-foreground">{label}</Text>
    </View>
  );
}

/**
 * Areas grid cell: image (16:9), name, and New/Sell/Rent count chips. Mirrors
 * web's NeighbourhoodCard. Non-interactive for now (area detail is out of scope).
 */
export function AreaCard({ area }: { area: Area }) {
  return (
    <View className="overflow-hidden rounded-2xl bg-card">
      <View className="aspect-[16/9] w-full bg-muted">
        {area.image ? (
          <Image source={{ uri: area.image }} className="h-full w-full" resizeMode="cover" />
        ) : null}
      </View>
      <View className="gap-2 p-3">
        <Text numberOfLines={1} className="text-base font-semibold text-foreground">
          {area.name}
        </Text>
        <View className="flex-row gap-1.5">
          <CountChip label="New" value={area.counts.new} />
          <CountChip label="Sell" value={area.counts.sell} />
          <CountChip label="Rent" value={area.counts.rent} />
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/features/areas/components/AreaCard.tsx`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/areas/components/AreaCard.tsx
git commit -m "feat(areas): add AreaCard grid cell"
```

---

### Task 4: AreaFilters (search + City sheet + Property-type sheet + reset)

**Files:**

- Create: `src/features/areas/components/AreaOptionSheet.tsx`
- Create: `src/features/areas/components/AreaFilters.tsx`

**Interfaces:**

- Consumes: `AreaState`, `AreaPropertyTypeOption` (Task 1); `useAreaStates`, `useAreaPropertyTypes` (Task 2); `AreasFilters` (Task 2).
- Produces:
  - `AreaOptionSheet` — generic single-select bottom sheet. Props: `{ title: string; options: { value: string; label: string }[]; selectedValue: string; onSelect: (value: string) => void; sheetRef: React.RefObject<BottomSheetModal> }`. An empty-string option value means "All".
  - `AreaFilters({ filters, onChange }: { filters: AreasFilters; onChange: (next: AreasFilters) => void })`.

- [ ] **Step 1: Create the generic option sheet**

Create `src/features/areas/components/AreaOptionSheet.tsx`:

```tsx
import * as React from 'react';
import { Pressable } from 'react-native';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { useThemeColor } from '@theme';

import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';

export interface AreaOption {
  readonly value: string;
  readonly label: string;
}

export interface AreaOptionSheetProps {
  readonly title: string;
  readonly options: AreaOption[];
  readonly selectedValue: string;
  readonly onSelect: (value: string) => void;
  readonly sheetRef: React.RefObject<BottomSheetModal>;
}

/** Single-select bottom sheet for the City / Property-type filters. */
export function AreaOptionSheet({
  title,
  options,
  selectedValue,
  onSelect,
  sheetRef,
}: AreaOptionSheetProps) {
  const insets = useSafeAreaInsets();
  const sheetBg = useThemeColor('--popover');
  const handleColor = useThemeColor('--muted-foreground');
  const brand = useThemeColor('--brand');

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.45}
      />
    ),
    [],
  );

  const handleSelect = React.useCallback(
    (value: string) => {
      sheetRef.current?.dismiss();
      onSelect(value);
    },
    [onSelect, sheetRef],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      enablePanDownToClose
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: sheetBg }}
      handleIndicatorStyle={{ backgroundColor: handleColor, opacity: 0.4, width: 40 }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
      >
        <Text className="pb-2 pt-1 text-center text-base font-semibold text-popover-foreground">
          {title}
        </Text>
        {options.map((opt) => {
          const isSelected = opt.value === selectedValue;
          return (
            <Pressable
              key={opt.value || '__all__'}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => handleSelect(opt.value)}
              className={cn(
                'min-h-12 flex-row items-center justify-between rounded-xl px-3 py-2.5 active:bg-muted',
                isSelected && 'bg-brand/10',
              )}
            >
              <Text className="text-base text-popover-foreground">{opt.label}</Text>
              {isSelected ? <Check size={20} strokeWidth={3} color={brand} /> : null}
            </Pressable>
          );
        })}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
```

- [ ] **Step 2: Create the filters toolbar**

Create `src/features/areas/components/AreaFilters.tsx`:

```tsx
import * as React from 'react';
import { Pressable, View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { ChevronDown, X } from 'lucide-react-native';
import { useThemeColor } from '@theme';

import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';

import type { AreasFilters } from '../hooks/use-neighbourhoods-infinite';
import { useAreaPropertyTypes } from '../hooks/use-area-property-types';
import { useAreaStates } from '../hooks/use-area-states';
import { AreaOptionSheet, type AreaOption } from './AreaOptionSheet';

const ALL_OPTION: AreaOption = { value: '', label: 'All' };

function FilterTrigger({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
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
 * Areas toolbar: debounced text search, City selector, Property-type selector,
 * and a reset button shown when any filter is active. Mirrors the web toolbar.
 */
export function AreaFilters({
  filters,
  onChange,
}: {
  filters: AreasFilters;
  onChange: (next: AreasFilters) => void;
}) {
  const cityRef = React.useRef<BottomSheetModal>(null);
  const typeRef = React.useRef<BottomSheetModal>(null);
  const [searchText, setSearchText] = React.useState(filters.search ?? '');

  const { data: states = [] } = useAreaStates();
  const { data: propertyTypes = [] } = useAreaPropertyTypes();

  // Debounce search → filters so each keystroke doesn't refetch.
  React.useEffect(() => {
    const id = setTimeout(() => {
      onChange({ ...filters, search: searchText.trim() || undefined });
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const cityOptions: AreaOption[] = [
    ALL_OPTION,
    ...states.map((s) => ({ value: s.id, label: s.name })),
  ];
  const typeOptions: AreaOption[] = [ALL_OPTION, ...propertyTypes];

  const cityLabel = states.find((s) => s.id === filters.stateId)?.name ?? 'City';
  const typeLabel =
    propertyTypes.find((t) => t.value === filters.propertyType)?.label ?? 'Property type';
  const hasActive = Boolean(filters.search || filters.stateId || filters.propertyType);

  const reset = () => {
    setSearchText('');
    onChange({});
  };

  return (
    <View className="gap-2">
      <Input
        placeholder="Search areas"
        value={searchText}
        onChangeText={setSearchText}
        returnKeyType="search"
      />
      <View className="flex-row gap-2">
        <FilterTrigger
          label={cityLabel}
          active={Boolean(filters.stateId)}
          onPress={() => cityRef.current?.present()}
        />
        <FilterTrigger
          label={typeLabel}
          active={Boolean(filters.propertyType)}
          onPress={() => typeRef.current?.present()}
        />
      </View>
      {hasActive ? (
        <Pressable
          onPress={reset}
          accessibilityRole="button"
          className="flex-row items-center gap-1 self-start active:opacity-70"
        >
          <X size={14} color={useThemeColor('--brand')} />
          <Text className="text-sm font-medium text-brand">Reset filters</Text>
        </Pressable>
      ) : null}

      <AreaOptionSheet
        title="Select city"
        options={cityOptions}
        selectedValue={filters.stateId ?? ''}
        onSelect={(value) => onChange({ ...filters, stateId: value || undefined })}
        sheetRef={cityRef}
      />
      <AreaOptionSheet
        title="Select property type"
        options={typeOptions}
        selectedValue={filters.propertyType ?? ''}
        onSelect={(value) => onChange({ ...filters, propertyType: value || undefined })}
        sheetRef={typeRef}
      />
    </View>
  );
}
```

> Note: `useThemeColor` is called inside the reset `Pressable` block and `FilterTrigger`. If lint flags conditional hook usage in the reset block, hoist `const brand = useThemeColor('--brand');` to the top of `AreaFilters` and use `brand` in both places. Verify in Step 3.

- [ ] **Step 3: Type-check + lint (fix hook ordering if flagged)**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/features/areas/components`
Expected: clean. If `react-hooks/rules-of-hooks` fires on the inline `useThemeColor('--brand')` inside the `hasActive` JSX block, hoist it to a top-level `const brand = useThemeColor('--brand');` in `AreaFilters` and replace the inline call with `brand`. Re-run until clean.

- [ ] **Step 4: Commit**

```bash
git add src/features/areas/components/AreaOptionSheet.tsx src/features/areas/components/AreaFilters.tsx
git commit -m "feat(areas): add filters toolbar with city and property-type sheets"
```

---

### Task 5: AreasScreen + route + Stack registration + permission gate

**Files:**

- Create: `src/features/areas/components/AreasScreen.tsx`
- Create: `app/(app)/areas.tsx`
- Modify: `app/(app)/_layout.tsx` (add `<Stack.Screen name="areas" />`)

**Interfaces:**

- Consumes: `useNeighbourhoodsInfinite`, `AreasFilters` (Task 2); `AreaCard` (Task 3); `AreaFilters` (Task 4); `useCan`, `PERMISSIONS` (`@/lib/rbac`); `useBottomTabBarSpace` (`@/features/new-projects/components/BottomTabBar`).
- Produces: `AreasScreen` default-exportable screen; route `/(app)/areas`.

- [ ] **Step 1: Create the screen**

Create `src/features/areas/components/AreasScreen.tsx`:

```tsx
import * as React from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/atoms/BackButton';
import { EmptyState } from '@/components/atoms/EmptyState';
import { Skeleton } from '@/components/atoms/Skeleton';
import { Text } from '@/components/atoms/Text';
import { useBottomTabBarSpace } from '@/features/new-projects/components/BottomTabBar';
import { PERMISSIONS, useCan } from '@/lib/rbac';

import type { Area } from '../models/area';
import type { AreasFilters } from '../hooks/use-neighbourhoods-infinite';
import { useNeighbourhoodsInfinite } from '../hooks/use-neighbourhoods-infinite';
import { AreaCard } from './AreaCard';
import { AreaFilters } from './AreaFilters';

function ScreenHeader() {
  const { top } = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: top }} className="bg-background">
      <View className="flex-row items-center gap-3 px-4 pb-2 pt-2">
        <BackButton />
        <Text className="text-xl font-bold text-foreground">Areas</Text>
      </View>
    </View>
  );
}

export function AreasScreen() {
  const canAccess = useCan(PERMISSIONS.AREAS_READ);
  const [filters, setFilters] = React.useState<AreasFilters>({});
  const bottomSpace = useBottomTabBarSpace(16);

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useNeighbourhoodsInfinite(filters);

  const items: Area[] = React.useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  if (!canAccess) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader />
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState title="No access" description="You don't have permission to view Areas." />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader />
      <FlatList
        data={items}
        keyExtractor={(a) => a.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 12, paddingTop: 12, paddingBottom: bottomSpace }}
        ListHeaderComponent={
          <View className="px-4 pb-1">
            <AreaFilters filters={filters} onChange={setFilters} />
          </View>
        }
        renderItem={({ item }) => (
          <View className="flex-1">
            <AreaCard area={item} />
          </View>
        )}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        ListEmptyComponent={
          isLoading ? (
            <View className="gap-3 px-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40 w-full rounded-2xl" />
              ))}
            </View>
          ) : isError ? (
            <View className="items-center px-8 pt-10">
              <EmptyState
                title="Couldn't load areas"
                description="Pull to retry."
                actionLabel="Retry"
                onAction={() => refetch()}
              />
            </View>
          ) : (
            <View className="items-center px-8 pt-10">
              <EmptyState title="No areas found" description="Try adjusting your filters." />
            </View>
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="flex-row items-center justify-center gap-2 py-4">
              <ActivityIndicator />
              <Text className="text-sm text-muted-foreground">Loading more areas…</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
```

> Before implementing, confirm the `EmptyState` atom's prop names (`title`, `description`, `actionLabel`, `onAction`) by reading `src/components/atoms/EmptyState.tsx`. If they differ, adjust the three `EmptyState` usages to match the real props. Same for `Skeleton` (`className` for sizing) — read `src/components/atoms/Skeleton.tsx` and adapt if it takes `width`/`height` props instead.

- [ ] **Step 2: Create the route**

Create `app/(app)/areas.tsx`:

```tsx
export { AreasScreen as default } from '@/features/areas/components/AreasScreen';
```

- [ ] **Step 3: Register the Stack screen**

In `app/(app)/_layout.tsx`, add this line inside the `<Stack>` block (a detail screen — keep the default push slide, so no `animation: 'none'`):

```tsx
<Stack.Screen name="areas" />
```

Place it alongside the other detail screens (e.g. after the `calls/[uuid]` line).

- [ ] **Step 4: Type-check + lint**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/features/areas app/\(app\)/areas.tsx app/\(app\)/_layout.tsx`
Expected: clean. Fix any `EmptyState`/`Skeleton` prop mismatches found in Step 1.

- [ ] **Step 5: Manual QA**

Run the app (`pnpm start`, open on device/simulator). Temporarily navigate to the screen by adding a deep link or by temporarily wiring it — OR defer this QA to Task 7 once the More tab exists. Verify: grid renders 2 columns, counts show, search filters, City + Property-type sheets open and filter, reset clears, scrolling to the bottom loads more.

- [ ] **Step 6: Commit**

```bash
git add src/features/areas/components/AreasScreen.tsx app/\(app\)/areas.tsx app/\(app\)/_layout.tsx
git commit -m "feat(areas): add Areas screen, route, and stack registration"
```

---

### Task 6: More-sheet store + MoreSheet component + global mount

**Files:**

- Create: `src/store/more-sheet.store.ts`
- Create: `src/features/more/components/MoreSheet.tsx`
- Modify: `app/_layout.tsx` (mount `<MoreSheet />` next to `GlobalTabBar`)

**Interfaces:**

- Consumes: `useCan`, `PERMISSIONS` (`@/lib/rbac`); gorhom `BottomSheetModal`.
- Produces:
  - `useMoreSheetStore` zustand store: `{ isOpen: boolean; present: () => void; dismiss: () => void; }` plus a registration channel so the mounted sheet can be driven imperatively (see implementation).
  - `MoreSheet()` component, mounted once globally.

> Design note: zustand holds an internal ref-callback so `present()`/`dismiss()` can drive the mounted `BottomSheetModal` without prop drilling, mirroring how `useAuthPromptStore` decouples trigger from UI.

- [ ] **Step 1: Create the store**

Create `src/store/more-sheet.store.ts`:

```ts
import { create } from 'zustand';

type Presenter = { present: () => void; dismiss: () => void };

interface MoreSheetState {
  /** Registered by the mounted MoreSheet so any caller can drive it. */
  _presenter: Presenter | null;
  register: (presenter: Presenter | null) => void;
  present: () => void;
  dismiss: () => void;
}

/**
 * Drives the global More bottom sheet from anywhere (e.g. the bottom tab bar)
 * without prop drilling. Mirrors the decoupling in `useAuthPromptStore`.
 */
export const useMoreSheetStore = create<MoreSheetState>((set, get) => ({
  _presenter: null,
  register: (presenter) => set({ _presenter: presenter }),
  present: () => get()._presenter?.present(),
  dismiss: () => get()._presenter?.dismiss(),
}));
```

- [ ] **Step 2: Create the MoreSheet**

Create `src/features/more/components/MoreSheet.tsx`:

```tsx
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, MapPin } from 'lucide-react-native';
import { useThemeColor } from '@theme';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { PERMISSIONS, useCan } from '@/lib/rbac';
import { useMoreSheetStore } from '@/store/more-sheet.store';

interface MoreRow {
  readonly key: string;
  readonly label: string;
  readonly icon: typeof MapPin;
  readonly href: string;
  readonly visible: boolean;
}

/**
 * Global "More" bottom sheet. Presented by the bottom-tab More button via
 * `useMoreSheetStore`. Lists navigation rows; the Areas row is gated by
 * `areas:read`. Built as a simple row list so future links drop straight in.
 */
export function MoreSheet() {
  const modalRef = React.useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const register = useMoreSheetStore((s) => s.register);

  const sheetBg = useThemeColor('--popover');
  const handleColor = useThemeColor('--muted-foreground');
  const chevron = useThemeColor('--muted-foreground');

  const canAreas = useCan(PERMISSIONS.AREAS_READ);

  React.useEffect(() => {
    register({
      present: () => modalRef.current?.present(),
      dismiss: () => modalRef.current?.dismiss(),
    });
    return () => register(null);
  }, [register]);

  const rows: MoreRow[] = [
    { key: 'areas', label: 'Areas', icon: MapPin, href: '/(app)/areas', visible: canAreas },
  ];

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.45}
      />
    ),
    [],
  );

  const go = (href: string) => {
    modalRef.current?.dismiss();
    router.push(href as Parameters<typeof router.push>[0]);
  };

  return (
    <BottomSheetModal
      ref={modalRef}
      enablePanDownToClose
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: sheetBg }}
      handleIndicatorStyle={{ backgroundColor: handleColor, opacity: 0.4, width: 40 }}
    >
      <BottomSheetView style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}>
        <Text className="pb-2 pt-1 text-center text-base font-semibold text-popover-foreground">
          More
        </Text>
        {rows
          .filter((r) => r.visible)
          .map((row) => (
            <Pressable
              key={row.key}
              accessibilityRole="button"
              onPress={() => go(row.href)}
              className="min-h-14 flex-row items-center justify-between rounded-xl px-3 py-3 active:bg-muted"
            >
              <View className="flex-row items-center gap-3">
                <row.icon size={20} color={chevron} />
                <Text className="text-base text-popover-foreground">{row.label}</Text>
              </View>
              <ChevronRight size={18} color={chevron} />
            </Pressable>
          ))}
      </BottomSheetView>
    </BottomSheetModal>
  );
}
```

> Note: the unused `Icon` import above is a guard — remove it if lint flags `no-unused-vars` (rows use lucide icons directly via `row.icon`). Confirm in Step 4.

- [ ] **Step 3: Mount it globally**

In `app/_layout.tsx`, import `MoreSheet` and render it next to `<BottomTabBar />` inside `GlobalTabBar`, OR directly inside the existing `BottomSheetModalProvider` block. Recommended: render it once near `GlobalTabBar`. Add the import:

```tsx
import { MoreSheet } from '@/features/more/components/MoreSheet';
```

Then place `<MoreSheet />` just before the `</BottomSheetModalProvider>` closing tag (around line 217), so it lives inside both the gesture-handler root and the bottom-sheet modal provider and is always mounted while authed routes are active.

- [ ] **Step 4: Type-check + lint**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/features/more src/store/more-sheet.store.ts app/_layout.tsx`
Expected: clean. Remove the unused `Icon` import if flagged.

- [ ] **Step 5: Commit**

```bash
git add src/store/more-sheet.store.ts src/features/more/components/MoreSheet.tsx app/_layout.tsx
git commit -m "feat(more): add store-driven More bottom sheet with Areas link"
```

---

### Task 7: Swap Profile tab for More tab

**Files:**

- Modify: `src/features/new-projects/components/BottomTabBar.tsx`

**Interfaces:**

- Consumes: `useMoreSheetStore` (Task 6).

- [ ] **Step 1: Replace the AUTHED_TABS profile entry**

In `src/features/new-projects/components/BottomTabBar.tsx`, change the last entry of `AUTHED_TABS` from:

```tsx
  { key: 'profile', label: 'Profile', icon: 'User', href: '/profile' },
```

to:

```tsx
  { key: 'more', label: 'More', icon: 'Menu', href: '/more' },
```

Leave `PUBLIC_TABS` and `CUSTOMER_TABS` unchanged (they keep Profile).

- [ ] **Step 2: Import the store**

Add near the other store imports at the top of the file:

```tsx
import { useMoreSheetStore } from '@/store/more-sheet.store';
```

- [ ] **Step 3: Special-case the More tab in onPress**

In the `TABS.map(...)` render, update the `onPress` handler so the `more` tab presents the sheet instead of navigating. Replace:

```tsx
          onPress={() => {
            if (!isAuthenticated && tab.requiresAuth) {
              openAuthPrompt();
              return;
            }
            setOptimisticTab(tab.key);
            router.navigate(tab.href as Parameters<typeof router.navigate>[0]);
          }}
```

with:

```tsx
          onPress={() => {
            if (!isAuthenticated && tab.requiresAuth) {
              openAuthPrompt();
              return;
            }
            if (tab.key === 'more') {
              useMoreSheetStore.getState().present();
              return;
            }
            setOptimisticTab(tab.key);
            router.navigate(tab.href as Parameters<typeof router.navigate>[0]);
          }}
```

(The `more` tab never sets an optimistic active state and matches no path, so it stays un-highlighted — correct for a transient action.)

- [ ] **Step 4: Type-check + lint**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/features/new-projects/components/BottomTabBar.tsx`
Expected: clean.

- [ ] **Step 5: Manual QA (full flow)**

Run the app as an authed user (one with `areas:read`):

1. Bottom bar shows **More** (hamburger/Menu icon) where Profile was.
2. Tap More → sheet slides up listing **Areas**.
3. Tap Areas → sheet dismisses, Areas screen pushes in with back button.
4. Grid renders 2-col with counts; search, City sheet, Property-type sheet all filter; reset clears; scroll loads more pages.
5. Back returns to previous tab; header avatar still opens Profile.
6. (If testable) As a user **without** `areas:read`: the Areas row is hidden in the sheet; direct nav to `/areas` shows the "No access" state.

- [ ] **Step 6: Commit**

```bash
git add src/features/new-projects/components/BottomTabBar.tsx
git commit -m "feat(nav): replace Profile tab with More tab opening the More sheet"
```

---

## Self-Review Notes

- **Spec coverage:** list grid + counts (Tasks 3,5) ✓; search + city + property-type filters + reset (Task 4) ✓; infinite scroll (Tasks 2,5) ✓; More tab replaces Profile in AUTHED_TABS only (Task 7) ✓; store-driven More sheet w/ Areas row (Task 6) ✓; `areas:read` gating on both sheet row and screen (Tasks 5,6) ✓; same `/api/v1/locations/*` + `/property-types` endpoints (Task 1) ✓; Profile via avatar untouched ✓; no new deps / no unit tests ✓.
- **Property-type fallback:** spec mentioned a static fallback mirroring web `usePropertyTypeOptions`. Simplified to: filter options come from `/api/v1/property-types` (authenticated-only endpoint, always reachable); if it returns empty, the Property-type sheet shows only "All". No hardcoded slug list — avoids guessing slugs that could mismatch the backend. This is a deliberate, documented narrowing.
- **Atom prop verification:** `EmptyState` and `Skeleton` prop names must be confirmed against their source files during Task 5, Step 1 (flagged inline).
- **Hook-ordering risk:** inline `useThemeColor` calls in `AreaFilters` are flagged for hoisting if lint complains (Task 4, Step 3).

```

```
