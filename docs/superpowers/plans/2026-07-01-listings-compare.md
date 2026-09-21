# Listings Compare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 2–4 listing side-by-side comparison feature to the Sell and Rent screens, mirroring the existing mobile Projects compare feature.

**Architecture:** A zustand store holds compare-mode + selected `UnifiedListingRow` snapshots. The list screen gains a Compare/Done header toggle and selectable cards; a floating bar opens a full-screen route rendering a frozen-label horizontal grid. Amenities hydrate lazily for secondary listings via `useQueries`.

**Tech Stack:** React Native 0.81, Expo Router (file-based, typed routes), zustand, TanStack Query v5, NativeWind v4.

## Global Constraints

- Package manager: **pnpm** only. Run scripts via `pnpm ...`.
- No test runner exists. Per-task verification = `pnpm exec tsc --noEmit` + `pnpm lint` (+ manual QA noted per task). Do NOT add jest/vitest.
- Strict TypeScript. Prop types use `Readonly<{...}>`.
- Styling: semantic NativeWind tokens only (`bg-card`, `text-foreground`, `border-border`, `bg-primary`, `text-brand`, etc.) — no hard-coded hex except the existing overlay pattern (`#fff`).
- Merge classes with `cn(...)` from `@/lib/utils`.
- Reuse the Projects compare visuals verbatim — do not invent new UI.
- Commit after each task. End commit messages with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Current git branch: `feat/add-listing`.

## Reference files (read before starting)

- `src/features/projects/store/compare.store.ts`
- `src/features/projects/compare/compare-rows.ts`
- `src/features/projects/hooks/use-compare-data.ts`
- `src/features/projects/components/CompareBar.tsx`
- `src/features/projects/components/ProjectCompareScreen.tsx`
- `src/features/projects/components/ProjectListScreen.tsx` (header toggle + selectable card wiring)
- `src/features/areas/components/AreaListingCard.tsx` (`selectable`/`selected`/`onToggleSelect` checkbox pattern)

## File structure

New:

- `src/features/listings/store/compare.store.ts` — selection state + `compareKey` + `COMPARE_MAX`.
- `src/features/listings/compare/compare-rows.ts` — row defs, sections, `bestColumnIndex` (min/max), `visibleRows`.
- `src/features/listings/hooks/use-listing-compare-amenities.ts` — secondary amenities via `useQueries`.
- `src/features/listings/components/ListingCompareBar.tsx` — floating bar.
- `src/features/listings/components/ListingCompareScreen.tsx` — the grid.
- `app/(app)/listings/compare.tsx` — route.

Modified:

- `src/features/listings/components/UnifiedListingCard.tsx` — selection props.
- `src/features/listings/components/UnifiedListingsList.tsx` — thread selection props + bottom padding.
- `src/features/listings/components/ListingsBrowseScreen.tsx` — header toggle + mount bar.
- `app/(app)/_layout.tsx` — register `listings/compare` screen.

---

### Task 1: Compare selection store

**Files:**

- Create: `src/features/listings/store/compare.store.ts`

**Interfaces:**

- Produces:
  - `COMPARE_MAX: number` (= 4)
  - `compareKey(row: Pick<UnifiedListingRow, 'kind' | 'id'>): string`
  - `useListingCompareStore` zustand hook with state:
    `compareMode: boolean`, `items: UnifiedListingRow[]`,
    `setCompareMode(on: boolean): void`, `toggle(row: UnifiedListingRow): void`,
    `remove(key: string): void`, `clear(): void`

- [ ] **Step 1: Create the store**

```typescript
import { create } from 'zustand';

import type { UnifiedListingRow } from '../types';

export const COMPARE_MAX = 4;

/**
 * Selection identity. Primary and secondary feeds can reuse ids, so the list
 * keys rows by `kind:id` — compare selection uses the same composite key.
 */
export function compareKey(row: Pick<UnifiedListingRow, 'kind' | 'id'>): string {
  return `${row.kind}:${row.id}`;
}

interface CompareState {
  /** Whether the listings list is in "select to compare" mode. */
  compareMode: boolean;
  /** Selected listing rows, insertion order, capped at COMPARE_MAX. */
  items: UnifiedListingRow[];
  setCompareMode: (on: boolean) => void;
  /** Add when absent (and under the cap); remove when already selected. */
  toggle: (row: UnifiedListingRow) => void;
  remove: (key: string) => void;
  clear: () => void;
}

/**
 * Listings comparison selection. Lives in a store (not screen state) so the
 * selection survives list refetches and the navigation to the compare screen.
 * Turning compare mode off also clears the selection.
 */
export const useListingCompareStore = create<CompareState>((set) => ({
  compareMode: false,
  items: [],
  setCompareMode: (on) => set(on ? { compareMode: true } : { compareMode: false, items: [] }),
  toggle: (row) =>
    set((state) => {
      const key = compareKey(row);
      const exists = state.items.some((i) => compareKey(i) === key);
      if (exists) return { items: state.items.filter((i) => compareKey(i) !== key) };
      if (state.items.length >= COMPARE_MAX) return state;
      return { items: [...state.items, row] };
    }),
  remove: (key) => set((state) => ({ items: state.items.filter((i) => compareKey(i) !== key) })),
  clear: () => set({ items: [] }),
}));
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (no errors referencing the new file).

- [ ] **Step 3: Commit**

```bash
git add src/features/listings/store/compare.store.ts
git commit -m "feat(listings): add compare selection store

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Compare rows + best-value logic

**Files:**

- Create: `src/features/listings/compare/compare-rows.ts`

**Interfaces:**

- Consumes: `UnifiedListingRow` from `../types`; `formatCurrency` from `@/lib/format/currency`.
- Produces:
  - `type CompareSection = 'key_facts' | 'amenities'`
  - `interface CompareRow { key; label; section: CompareSection; value(row): { raw: number | string | null; display: string }; best?: 'min' | 'max'; bestTag?: string }`
  - `SECTIONS: { key: CompareSection; title: string }[]`
  - `COMPARE_ROWS: CompareRow[]`
  - `bestColumnIndex(row: CompareRow, rows: UnifiedListingRow[]): number`

**Notes:** Rent price display appends `/yr`. Amenities are rendered specially by the screen (chips), so the `amenities` row's `value` returns only a fallback display string; the screen supplies the chip data.

- [ ] **Step 1: Create the row definitions**

```typescript
import { formatCurrency } from '@/lib/format/currency';

import type { UnifiedListingRow } from '../types';

const DASH = '—';

export type CompareSection = 'key_facts' | 'amenities';

export interface CompareRow {
  readonly key: string;
  readonly label: string;
  readonly section: CompareSection;
  /** Cell value: `raw` drives best-value math, `display` is shown. */
  readonly value: (row: UnifiedListingRow) => { raw: number | string | null; display: string };
  /** Optional best-column highlight strategy. */
  readonly best?: 'min' | 'max';
  readonly bestTag?: string;
}

function titleCase(raw: string | null | undefined): string {
  if (!raw) return DASH;
  return raw.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function text(value: string | null | undefined): { raw: string | null; display: string } {
  const trimmed = value?.trim();
  return trimmed ? { raw: trimmed, display: trimmed } : { raw: null, display: DASH };
}

function num(
  value: number | null | undefined,
  suffix = '',
): { raw: number | null; display: string } {
  return Number.isFinite(value)
    ? { raw: value as number, display: `${value}${suffix}` }
    : { raw: null, display: DASH };
}

export const SECTIONS: { key: CompareSection; title: string }[] = [
  { key: 'key_facts', title: 'Key Facts' },
  { key: 'amenities', title: 'Amenities' },
];

export const COMPARE_ROWS: CompareRow[] = [
  {
    key: 'transaction',
    label: 'Transaction',
    section: 'key_facts',
    value: (r) => {
      const isRent = r.purpose === 'for_rent' || r.purpose === 'rent';
      return { raw: r.purpose ?? null, display: isRent ? 'For Rent' : 'For Sale' };
    },
  },
  {
    key: 'price',
    label: 'Price',
    section: 'key_facts',
    value: (r) => {
      if (!Number.isFinite(r.price)) return { raw: null, display: DASH };
      const isRent = r.purpose === 'for_rent' || r.purpose === 'rent';
      const money = formatCurrency(r.price);
      return { raw: r.price as number, display: isRent ? `${money}/yr` : money };
    },
    best: 'min',
    bestTag: 'Lowest',
  },
  {
    key: 'size',
    label: 'Size',
    section: 'key_facts',
    value: (r) =>
      Number.isFinite(r.sizeSqft)
        ? { raw: r.sizeSqft as number, display: `${(r.sizeSqft as number).toLocaleString()} sqft` }
        : { raw: null, display: DASH },
    best: 'max',
    bestTag: 'Largest',
  },
  {
    key: 'propertyType',
    label: 'Property type',
    section: 'key_facts',
    value: (r) => ({ raw: r.propertyType ?? null, display: titleCase(r.propertyType) }),
  },
  { key: 'bedrooms', label: 'Bedrooms', section: 'key_facts', value: (r) => num(r.bedrooms) },
  { key: 'bathrooms', label: 'Bathrooms', section: 'key_facts', value: (r) => num(r.bathrooms) },
  { key: 'location', label: 'Location', section: 'key_facts', value: (r) => text(r.location) },
  {
    key: 'property',
    label: 'Project / Property',
    section: 'key_facts',
    value: (r) => text(r.projectName ?? r.propertyLabel),
  },
  {
    key: 'developer',
    label: 'Developer',
    section: 'key_facts',
    value: (r) => text(r.developerName),
  },
  {
    // The screen renders amenity chips from hydrated data; this display is the
    // fallback text (also used by the diff-only filter as a stable string).
    key: 'amenities',
    label: 'Amenities',
    section: 'amenities',
    value: () => ({ raw: null, display: DASH }),
  },
];

/**
 * Index of the winning column for a row, or -1 when no single winner (no `best`
 * strategy, all values empty, or a tie). Ties never highlight to avoid misleading.
 */
export function bestColumnIndex(row: CompareRow, rows: UnifiedListingRow[]): number {
  if (!row.best) return -1;
  const scores = rows.map((r) => {
    const { raw } = row.value(r);
    return typeof raw === 'number' ? raw : null;
  });
  let bestIdx = -1;
  let bestVal = row.best === 'min' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  let tie = false;
  scores.forEach((s, i) => {
    if (s === null) return;
    const better = row.best === 'min' ? s < bestVal : s > bestVal;
    if (better) {
      bestVal = s;
      bestIdx = i;
      tie = false;
    } else if (s === bestVal) {
      tie = true;
    }
  });
  return tie ? -1 : bestIdx;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/listings/compare/compare-rows.ts
git commit -m "feat(listings): add compare row definitions and best-value logic

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Amenities hydration hook

**Files:**

- Create: `src/features/listings/hooks/use-listing-compare-amenities.ts`

**Interfaces:**

- Consumes: `useQueries` from `@tanstack/react-query`; `getListingById` from `../services`; `UnifiedListingRow` from `../types`; `compareKey` from `../store/compare.store`.
- Produces: `useListingCompareAmenities(rows: UnifiedListingRow[]): { amenitiesByKey: Record<string, string[]>; isLoading: boolean }`

**Notes:** Only **secondary** rows have a mobile detail endpoint (`getListingById` → `ListingDetail.amenities`). Primary rows are omitted from `amenitiesByKey`; the screen shows `—` for them. Reuses the `['listing', id]` query key so the cache is shared with `useListingDetail`.

- [ ] **Step 1: Create the hook**

```typescript
import { useQueries } from '@tanstack/react-query';

import { getListingById } from '../services';
import { compareKey } from '../store/compare.store';
import type { UnifiedListingRow } from '../types';

/**
 * Hydrate amenities for the compared listings. Only secondary listings expose a
 * mobile detail endpoint, so one query runs per secondary id (via `useQueries`,
 * dynamic-length safe). Primary listings are absent from the result map and the
 * grid renders `—` for them. Query key matches `useListingDetail` for cache reuse.
 */
export function useListingCompareAmenities(rows: UnifiedListingRow[]): {
  amenitiesByKey: Record<string, string[]>;
  isLoading: boolean;
} {
  const secondary = rows.filter((r) => r.kind === 'secondary');

  const results = useQueries({
    queries: secondary.map((r) => ({
      queryKey: ['listing', r.id],
      queryFn: () => getListingById(r.id),
      staleTime: 60_000,
    })),
  });

  const amenitiesByKey: Record<string, string[]> = {};
  secondary.forEach((r, i) => {
    const detail = results[i]?.data;
    if (!detail) return;
    amenitiesByKey[compareKey(r)] = (detail.amenities ?? [])
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((a) => a.customTitle ?? a.amenity?.name ?? 'Amenity');
  });

  const isLoading = results.some((r) => r.isLoading);
  return { amenitiesByKey, isLoading };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/listings/hooks/use-listing-compare-amenities.ts
git commit -m "feat(listings): hydrate compare amenities for secondary listings

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Floating compare bar

**Files:**

- Create: `src/features/listings/components/ListingCompareBar.tsx`

**Interfaces:**

- Consumes: `useListingCompareStore`, `compareKey` from `../store/compare.store`; `router` from `expo-router`.
- Produces: `ListingCompareBar` (no props).

- [ ] **Step 1: Create the bar**

```tsx
import { Image, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';

import { compareKey, useListingCompareStore } from '../store/compare.store';
import type { UnifiedListingRow } from '../types';

function Thumb({ row, onRemove }: Readonly<{ row: UnifiedListingRow; onRemove: () => void }>) {
  return (
    <View className="relative">
      <View className="h-12 w-12 overflow-hidden rounded-lg border border-border bg-muted">
        {row.heroImageUrl ? (
          <Image source={{ uri: row.heroImageUrl }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Icon name="Building2" size={16} />
          </View>
        )}
      </View>
      <Pressable
        onPress={onRemove}
        hitSlop={8}
        accessibilityLabel={`Remove ${row.title}`}
        className="absolute -right-1.5 -top-1.5 h-5 w-5 items-center justify-center rounded-full bg-foreground"
      >
        <Icon name="X" size={12} color="#fff" strokeWidth={3} />
      </Pressable>
    </View>
  );
}

/**
 * Floating bottom bar shown while compare mode has selections. Lists selected
 * listing thumbnails (each removable), a Clear action, and a primary
 * Compare (N) CTA enabled only when at least 2 are selected.
 */
export function ListingCompareBar() {
  const { bottom } = useSafeAreaInsets();
  const compareMode = useListingCompareStore((s) => s.compareMode);
  const items = useListingCompareStore((s) => s.items);
  const remove = useListingCompareStore((s) => s.remove);
  const clear = useListingCompareStore((s) => s.clear);

  if (!compareMode || items.length === 0) return null;

  const canCompare = items.length >= 2;

  return (
    <View
      className="absolute inset-x-0 bottom-0 border-t border-border bg-card px-4 pt-3"
      style={{ paddingBottom: bottom + 12 }}
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-2">
          {items.map((row) => (
            <Thumb key={compareKey(row)} row={row} onRemove={() => remove(compareKey(row))} />
          ))}
        </View>
        <View className="items-end gap-1.5">
          <Pressable onPress={clear} hitSlop={6} accessibilityLabel="Clear selection">
            <Text className="text-xs font-medium text-muted-foreground">Clear</Text>
          </Pressable>
          <Pressable
            disabled={!canCompare}
            onPress={() => router.push('/listings/compare')}
            accessibilityRole="button"
            accessibilityLabel={`Compare ${items.length} listings`}
            className={cn(
              'h-10 items-center justify-center rounded-full px-5',
              canCompare ? 'bg-brand active:opacity-80' : 'bg-muted',
            )}
          >
            <Text
              className={cn(
                'text-sm font-semibold',
                canCompare ? 'text-brand-foreground' : 'text-muted-foreground',
              )}
            >
              Compare ({items.length})
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/listings/components/ListingCompareBar.tsx
git commit -m "feat(listings): add floating compare bar

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Compare grid screen + route

**Files:**

- Create: `src/features/listings/components/ListingCompareScreen.tsx`
- Create: `app/(app)/listings/compare.tsx`
- Modify: `app/(app)/_layout.tsx` (add one `<Stack.Screen>` line after `listings/create`)

**Interfaces:**

- Consumes: `useListingCompareStore`, `compareKey` from `../store/compare.store`; `useListingCompareAmenities` from `../hooks/use-listing-compare-amenities`; `COMPARE_ROWS`, `SECTIONS`, `bestColumnIndex`, `type CompareRow` from `../compare/compare-rows`; `EmptyState`, `Icon`, `Skeleton`, `Text` atoms.
- Produces: `ListingCompareScreen` (no props); default export at the route file.

- [ ] **Step 1: Create the grid screen**

```tsx
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { EmptyState } from '@/components/atoms/EmptyState';
import { Icon } from '@/components/atoms/Icon';
import { Skeleton } from '@/components/atoms/Skeleton';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';

import { bestColumnIndex, COMPARE_ROWS, SECTIONS, type CompareRow } from '../compare/compare-rows';
import { useListingCompareAmenities } from '../hooks/use-listing-compare-amenities';
import { compareKey, useListingCompareStore } from '../store/compare.store';
import type { UnifiedListingRow } from '../types';

const LABEL_W = 124;
const COL_W = 156;
const HEADER_H = 108;
const SECTION_H = 36;
const MIN_ROW_H = 52;

type VisualRow = { kind: 'section'; title: string } | { kind: 'data'; row: CompareRow };
type ReportHeight = (key: string, h: number) => void;

const VISUAL_ROWS: VisualRow[] = SECTIONS.flatMap((section) => [
  { kind: 'section' as const, title: section.title },
  ...COMPARE_ROWS.filter((r) => r.section === section.key).map((row) => ({
    kind: 'data' as const,
    row,
  })),
]);

/** Rows to render: all, or (diff-only) just those whose values differ across listings. */
function visibleRows(rows: UnifiedListingRow[], diffOnly: boolean): VisualRow[] {
  if (!diffOnly || rows.length < 2) return VISUAL_ROWS;
  const keep = new Set<string>();
  COMPARE_ROWS.forEach((cr) => {
    const values = rows.map((r) => cr.value(r).display);
    if (new Set(values).size > 1) keep.add(cr.key);
  });
  const out: VisualRow[] = [];
  SECTIONS.forEach((section) => {
    const sectionRows = COMPARE_ROWS.filter((r) => r.section === section.key && keep.has(r.key));
    if (sectionRows.length === 0) return;
    out.push({ kind: 'section', title: section.title });
    sectionRows.forEach((row) => out.push({ kind: 'data', row }));
  });
  return out;
}

function ScreenHeader({
  diffOnly,
  onToggleDiff,
}: Readonly<{ diffOnly?: boolean; onToggleDiff?: () => void }>) {
  const { top } = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: top }} className="bg-background">
      <View className="flex-row items-center gap-3 border-b border-border px-4 pb-2 pt-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          className="-ml-1 h-9 w-9 items-center justify-center rounded-full active:opacity-70"
        >
          <Icon name="ArrowLeft" size={24} />
        </Pressable>
        <Text className="flex-1 text-xl font-bold text-foreground">Compare</Text>
        {onToggleDiff ? (
          <Pressable
            onPress={onToggleDiff}
            accessibilityRole="switch"
            accessibilityState={{ checked: Boolean(diffOnly) }}
            accessibilityLabel="Show differences only"
            hitSlop={8}
            className={cn(
              'h-9 flex-row items-center gap-1.5 rounded-full border px-3 active:opacity-70',
              diffOnly ? 'border-brand bg-brand/10' : 'border-border',
            )}
          >
            <Icon name="ListFilter" size={15} />
            <Text
              className={cn('text-sm font-medium', diffOnly ? 'text-brand' : 'text-foreground')}
            >
              Differences
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Chip({ label }: Readonly<{ label: string }>) {
  return (
    <View className="rounded-full border border-border bg-transparent px-2 py-0.5">
      <Text className="text-[11px] font-medium text-foreground">{label}</Text>
    </View>
  );
}

/** Data cell with measured row-height sync so the frozen label column stays aligned. */
function DataCell({
  rowKey,
  rowH,
  reportH,
  className,
  children,
}: Readonly<{
  rowKey: string;
  rowH: number | undefined;
  reportH: ReportHeight;
  className?: string;
  children: React.ReactNode;
}>) {
  return (
    <View
      onLayout={(e) => reportH(rowKey, e.nativeEvent.layout.height)}
      style={{ minHeight: rowH ?? MIN_ROW_H }}
      className={cn('justify-center border-b border-border px-3 py-2', className)}
    >
      {children}
    </View>
  );
}

function LabelColumn({
  rows,
  rowH,
  reportH,
}: Readonly<{ rows: VisualRow[]; rowH: Record<string, number>; reportH: ReportHeight }>) {
  return (
    <View style={{ width: LABEL_W }} className="border-r border-border bg-card">
      <View style={{ height: HEADER_H }} className="justify-end px-3 pb-2">
        <Text className="text-[11px] font-medium text-muted-foreground">
          {rows.filter((v) => v.kind === 'data').length} fields
        </Text>
      </View>
      {rows.map((vr) =>
        vr.kind === 'section' ? (
          <View
            key={`s-${vr.title}`}
            style={{ height: SECTION_H }}
            className="justify-end bg-muted px-3 pb-1.5"
          >
            <Text className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {vr.title}
            </Text>
          </View>
        ) : (
          <DataCell key={vr.row.key} rowKey={vr.row.key} rowH={rowH[vr.row.key]} reportH={reportH}>
            <Text numberOfLines={2} className="text-xs text-muted-foreground">
              {vr.row.label}
            </Text>
          </DataCell>
        ),
      )}
    </View>
  );
}

function ColumnHeader({
  row,
  onRemove,
}: Readonly<{ row: UnifiedListingRow; onRemove: () => void }>) {
  return (
    <View style={{ height: HEADER_H }} className="gap-1.5 border-b border-border p-2">
      <View className="h-12 w-full overflow-hidden rounded-lg bg-muted">
        {row.heroImageUrl ? (
          <Image source={{ uri: row.heroImageUrl }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Icon name="Building2" size={16} />
          </View>
        )}
      </View>
      <Text numberOfLines={2} className="text-[13px] font-bold text-foreground">
        {row.title}
      </Text>
      <View className="mt-auto flex-row items-center justify-between">
        {row.kind === 'secondary' ? (
          <Pressable
            onPress={() => router.push(`/listings/${row.id}`)}
            hitSlop={6}
            accessibilityLabel={`View ${row.title}`}
          >
            <Text className="text-[11px] font-semibold text-brand">View</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable onPress={onRemove} hitSlop={6} accessibilityLabel={`Remove ${row.title}`}>
          <Icon name="X" size={14} />
        </Pressable>
      </View>
    </View>
  );
}

function AmenitiesCell({
  names,
  loading,
}: Readonly<{ names: string[] | undefined; loading: boolean }>) {
  if (names === undefined) {
    if (loading) return <Skeleton className="h-4 w-16 rounded" />;
    return <Text className="text-muted-foreground">—</Text>;
  }
  if (names.length === 0) return <Text className="text-muted-foreground">—</Text>;
  return (
    <View className="flex-row flex-wrap gap-1">
      {names.map((a, i) => (
        <Chip key={`${a}-${i}`} label={a} />
      ))}
    </View>
  );
}

function ListingColumn({
  rows,
  row,
  index,
  allRows,
  amenities,
  amenitiesLoading,
  onRemove,
  rowH,
  reportH,
}: Readonly<{
  rows: VisualRow[];
  row: UnifiedListingRow;
  index: number;
  allRows: UnifiedListingRow[];
  amenities: string[] | undefined;
  amenitiesLoading: boolean;
  onRemove: () => void;
  rowH: Record<string, number>;
  reportH: ReportHeight;
}>) {
  return (
    <View style={{ width: COL_W }} className="border-r border-border">
      <ColumnHeader row={row} onRemove={onRemove} />
      {rows.map((vr) => {
        if (vr.kind === 'section') {
          return <View key={`s-${vr.title}`} style={{ height: SECTION_H }} className="bg-muted" />;
        }
        const isBest = vr.row.best ? bestColumnIndex(vr.row, allRows) === index : false;
        return (
          <DataCell
            key={vr.row.key}
            rowKey={vr.row.key}
            rowH={rowH[vr.row.key]}
            reportH={reportH}
            className={cn('gap-1', isBest ? 'bg-primary/10' : '')}
          >
            {vr.row.key === 'amenities' ? (
              <AmenitiesCell names={amenities} loading={amenitiesLoading} />
            ) : (
              <Text
                numberOfLines={3}
                className="text-[13px] font-medium tabular-nums text-foreground"
              >
                {vr.row.value(row).display}
              </Text>
            )}
            {isBest && vr.row.bestTag ? (
              <View className="self-start rounded-full bg-primary px-1.5 py-0.5">
                <Text className="text-[9px] font-bold text-primary-foreground">
                  {vr.row.bestTag}
                </Text>
              </View>
            ) : null}
          </DataCell>
        );
      })}
    </View>
  );
}

function CompareSkeleton() {
  return (
    <View className="flex-row gap-3 p-4">
      {[0, 1].map((i) => (
        <Skeleton key={i} className="h-96 flex-1 rounded-2xl" />
      ))}
    </View>
  );
}

export function ListingCompareScreen() {
  const items = useListingCompareStore((s) => s.items);
  const remove = useListingCompareStore((s) => s.remove);

  const { amenitiesByKey, isLoading: amenitiesLoading } = useListingCompareAmenities(items);

  const [rowH, setRowH] = React.useState<Record<string, number>>({});
  const reportH = React.useCallback<ReportHeight>((key, h) => {
    setRowH((prev) => (h > (prev[key] ?? 0) ? { ...prev, [key]: h } : prev));
  }, []);

  const [diffOnly, setDiffOnly] = React.useState(false);
  const rows = React.useMemo(() => visibleRows(items, diffOnly), [items, diffOnly]);

  if (items.length < 2) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader />
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState
            icon="Scale"
            title="Nothing to compare"
            description="Pick at least 2 listings to compare."
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader diffOnly={diffOnly} onToggleDiff={() => setDiffOnly((v) => !v)} />
      {amenitiesLoading &&
      Object.keys(amenitiesByKey).length === 0 &&
      items.some((i) => i.kind === 'secondary') ? (
        <CompareSkeleton />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="flex-row">
            <LabelColumn rows={rows} rowH={rowH} reportH={reportH} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={COL_W}
              decelerationRate="fast"
            >
              <View className="flex-row">
                {items.map((row, index) => (
                  <ListingColumn
                    key={compareKey(row)}
                    rows={rows}
                    row={row}
                    index={index}
                    allRows={items}
                    amenities={amenitiesByKey[compareKey(row)]}
                    amenitiesLoading={amenitiesLoading}
                    onRemove={() => remove(compareKey(row))}
                    rowH={rowH}
                    reportH={reportH}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Add the `Image` import**

The screen uses `<Image>` in `ColumnHeader`. Ensure the first import line includes it:

```tsx
import { Image, Pressable, ScrollView, View } from 'react-native';
```

(Replace the `import { Pressable, ScrollView, View } from 'react-native';` line from Step 1.)

- [ ] **Step 3: Create the route file**

Create `app/(app)/listings/compare.tsx`:

```tsx
export { ListingCompareScreen as default } from '@/features/listings/components/ListingCompareScreen';
```

- [ ] **Step 4: Register the screen in the stack**

In `app/(app)/_layout.tsx`, add this line immediately after the `listings/create` screen (line ~46):

```tsx
<Stack.Screen name="listings/compare" />
```

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/listings/components/ListingCompareScreen.tsx "app/(app)/listings/compare.tsx" "app/(app)/_layout.tsx"
git commit -m "feat(listings): add compare grid screen and route

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Selectable listing card

**Files:**

- Modify: `src/features/listings/components/UnifiedListingCard.tsx`

**Interfaces:**

- Produces: `UnifiedListingCard` gains optional props `selectable?: boolean`, `selected?: boolean`, `onToggleSelect?: () => void`.
- Behavior: when `selectable`, the whole card is a Pressable that toggles selection (no navigation, no kebab); a check circle appears top-right of the thumbnail; the card border turns `border-primary` when `selected`.

- [ ] **Step 1: Add a selection checkbox overlay to the thumbnail**

Replace the `Thumbnail` component (lines 95–114) with a version that overlays a checkbox when selectable:

```tsx
function Thumbnail({
  uri,
  selectable,
  selected,
}: Readonly<{ uri: string | null | undefined; selectable?: boolean; selected?: boolean }>) {
  return (
    <View className="h-[72px] w-[72px] overflow-hidden rounded-xl bg-muted">
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={HERO_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: '100%', height: '100%' }}
        >
          <View className="flex-1 items-center justify-center">
            <Icon name="Building2" size={24} color="rgba(255,255,255,0.4)" />
          </View>
        </LinearGradient>
      )}
      {selectable ? (
        <View
          className={cn(
            'absolute left-1 top-1 h-6 w-6 items-center justify-center rounded-full border-2',
            selected ? 'border-primary bg-primary' : 'border-white bg-black/40',
          )}
        >
          {selected ? <Icon name="Check" size={14} color="#fff" strokeWidth={3} /> : null}
        </View>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2: Add the `cn` import**

At the top of the file, add (alongside the existing imports):

```tsx
import { cn } from '@/lib/utils';
```

- [ ] **Step 3: Thread `selectable`/`selected` into `CardBody`**

Change the `CardBody` signature and its `<Thumbnail>` usage. Update the props type (line ~129-133) to:

```tsx
function CardBody({
  row,
  canManage,
  onManage,
  selectable,
  selected,
}: Readonly<{
  row: UnifiedListingRow;
  canManage: boolean;
  onManage: () => void;
  selectable?: boolean;
  selected?: boolean;
}>) {
```

And its `<Thumbnail uri={row.heroImageUrl} />` (line ~146) becomes:

```tsx
<Thumbnail uri={row.heroImageUrl} selectable={selectable} selected={selected} />
```

Also suppress the kebab in compare mode — change the kebab guard (line ~157) from `canManage ?` to:

```tsx
            {canManage && !selectable ? (
```

- [ ] **Step 3b: Update `UnifiedListingCard` to accept and route the new props**

Replace the component (lines ~235-279) with:

```tsx
export function UnifiedListingCard({
  row,
  stages,
  selectable = false,
  selected = false,
  onToggleSelect,
}: Readonly<{
  row: UnifiedListingRow;
  stages: ListingStage[];
  /** When true, tapping the card toggles compare selection instead of navigating. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}>) {
  const [sheetVisible, setSheetVisible] = useState(false);
  const canManage = useCan(
    row.kind === 'primary'
      ? [PERMISSIONS.LISTINGS_UPDATE, PERMISSIONS.LISTINGS_CREATE]
      : [PERMISSIONS.OPPORTUNITY_LISTING_UPDATE, PERMISSIONS.OPPORTUNITY_LISTING_CREATE],
  );
  const onManage = () => setSheetVisible(true);

  const body = (
    <CardBody
      row={row}
      canManage={canManage}
      onManage={onManage}
      selectable={selectable}
      selected={selected}
    />
  );

  if (selectable) {
    return (
      <Pressable
        onPress={onToggleSelect}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`Select ${row.title}`}
        style={({ pressed }) => [CARD_SHADOW, pressed && { opacity: 0.96 }]}
        className={cn(CARD_CLASS, selected ? 'border-primary' : '')}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <>
      {/* Secondary listings open the detail screen; primary listings have no
          mobile detail yet (v1), so they render as a non-pressable card. */}
      {row.kind === 'secondary' ? (
        <Pressable
          onPress={() => router.push(`/listings/${row.id}`)}
          // `pressed` style (not the `active:` variant) — the latter stalls the
          // native UI thread on rapidly-tapped list rows (see project memory).
          style={({ pressed }) => [CARD_SHADOW, pressed && { opacity: 0.96 }]}
          className={CARD_CLASS}
        >
          {body}
        </Pressable>
      ) : (
        <View className={CARD_CLASS} style={CARD_SHADOW}>
          {body}
        </View>
      )}

      {canManage ? (
        <ListingActionsSheet
          visible={sheetVisible}
          row={row}
          stages={stages}
          onClose={() => setSheetVisible(false)}
        />
      ) : null}
    </>
  );
}
```

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/listings/components/UnifiedListingCard.tsx
git commit -m "feat(listings): support compare selection on listing card

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Wire compare mode into the list + browse screen

**Files:**

- Modify: `src/features/listings/components/UnifiedListingsList.tsx`
- Modify: `src/features/listings/components/ListingsBrowseScreen.tsx`

**Interfaces:**

- Consumes: `useListingCompareStore`, `compareKey` from `../store/compare.store`; `ListingCompareBar` from `./ListingCompareBar`; `UnifiedListingCard` new props from Task 6.

- [ ] **Step 1: Read compare state inside the list and pass it to each card**

In `UnifiedListingsList.tsx`:

1. Add imports near the other feature imports (after line 17):

```tsx
import { compareKey, useListingCompareStore } from '../store/compare.store';
```

2. Inside `UnifiedListingsList`, after `const [scrolled, setScrolled] = useState(false);` (line ~148), add:

```tsx
const compareMode = useListingCompareStore((s) => s.compareMode);
const selectedItems = useListingCompareStore((s) => s.items);
const toggle = useListingCompareStore((s) => s.toggle);
const selectedKeys = useMemo(
  () => new Set(selectedItems.map((i) => compareKey(i))),
  [selectedItems],
);
const barVisible = compareMode && selectedItems.length > 0;
```

3. Update the `'listing'` case of `renderRow` (lines ~206-211) to:

```tsx
      case 'listing':
        return (
          <View className="px-4 pb-3">
            <UnifiedListingCard
              row={item.row}
              stages={stages}
              selectable={compareMode}
              selected={selectedKeys.has(compareKey(item.row))}
              onToggleSelect={() => toggle(item.row)}
            />
          </View>
        );
```

4. Give the list room for the floating bar. Change the `contentContainerStyle` (line ~222) to:

```tsx
      contentContainerStyle={{ paddingBottom: tabBarSpace + 80 + (barVisible ? 88 : 0) }}
```

- [ ] **Step 2: Add the header toggle and mount the bar in the browse screen**

In `ListingsBrowseScreen.tsx`:

1. Add imports (after line 16):

```tsx
import { Icon } from '@/components/atoms/Icon';
import { Pressable } from 'react-native';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';
import { useListingCompareStore } from '../store/compare.store';
import { ListingCompareBar } from './ListingCompareBar';
```

(Merge `View` / `Pressable` into the existing `react-native` import rather than duplicating — the file already imports `View`; make it `import { Pressable, View } from 'react-native';`.)

2. Inside `ListingsBrowseScreen`, after `const insets = useSafeAreaInsets();` (line ~20), add:

```tsx
const brand = useThemeColor('--brand');
const compareMode = useListingCompareStore((s) => s.compareMode);
const setCompareMode = useListingCompareStore((s) => s.setCompareMode);
```

3. In the header row, replace the count badge block (lines ~64-70) so the Compare toggle sits alongside it:

```tsx
<View className="flex-row items-center gap-2">
  {state.total > 0 ? (
    <View className="rounded-full bg-brand px-2.5 py-0.5">
      <Text className="text-xs font-bold text-brand-foreground">
        {state.total.toLocaleString()}
      </Text>
    </View>
  ) : null}
  <Pressable
    onPress={() => setCompareMode(!compareMode)}
    accessibilityRole="button"
    accessibilityState={{ selected: compareMode }}
    accessibilityLabel={compareMode ? 'Exit compare mode' : 'Compare listings'}
    hitSlop={8}
    className={cn(
      'h-9 flex-row items-center gap-1.5 rounded-full border px-3 active:opacity-70',
      compareMode ? 'border-brand bg-brand/10' : 'border-border',
    )}
  >
    <Icon name="Scale" size={16} color={compareMode ? brand : undefined} />
    <Text className={cn('text-sm font-medium', compareMode ? 'text-brand' : 'text-foreground')}>
      {compareMode ? 'Done' : 'Compare'}
    </Text>
  </Pressable>
</View>
```

4. Mount the bar just before the closing `</View>` of the root container (after the `<UnifiedListingsFiltersSheet ... />`, line ~102):

```tsx
<ListingCompareBar />
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/listings/components/UnifiedListingsList.tsx src/features/listings/components/ListingsBrowseScreen.tsx
git commit -m "feat(listings): wire compare mode into list and browse header

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Manual QA pass

**Files:** none (verification only).

- [ ] **Step 1: Run the app**

Run: `pnpm start` (then open iOS or Android). Sign in and navigate to Listings → Sell.

- [ ] **Step 2: Verify the select flow**

- Tap **Compare** in the header → label becomes **Done**, cards show a check circle.
- Select 1 listing → floating bar appears with a thumbnail; **Compare** CTA reads `Compare (1)` and is disabled (muted).
- Select a 2nd → CTA enables, reads `Compare (2)`.
- Try to select a 5th → selection stays at 4 (cap enforced).
- Tap a thumbnail's X in the bar → it deselects; **Clear** empties all.

- [ ] **Step 3: Verify the grid**

- Tap **Compare (N)** → grid opens. Label column frozen on the left; listing columns scroll horizontally.
- Price row: lowest-price column shows a green cell + **Lowest** tag. Size row: largest shows **Largest**.
- Toggle **Differences** → rows where all listings match disappear; toggle off → all return.
- Amenities row: secondary listings show amenity chips (or `—` if none); primary listings show `—`.
- Tap a column **X** → that listing drops; at <2 listings the "Nothing to compare" empty state shows.
- Back → returns to the list with compare mode still on and selection intact.
- Tap **Done** → compare mode exits and selection clears.

- [ ] **Step 4: Repeat on the Rent screen**

Navigate to Listings → Rent and repeat Steps 2–3. Confirm rent prices display with a `/yr` suffix.

- [ ] **Step 5: No commit** (QA only). Record any defects as follow-up tasks.

```

```
