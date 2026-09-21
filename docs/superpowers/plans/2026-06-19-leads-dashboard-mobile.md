# Unified Leads Dashboard (Mobile, Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the staff home screen into a unified Leads dashboard that ports the web `/manage-leads` value to mobile — 6 KPI cards with sparklines + trends, Today's Priorities, and a 2×2 Buy/Sell/Rent/Portal category grid with count badges routing to stub screens.

**Architecture:** New presentational components under `src/features/leads/components/dashboard/` consume the **already-built** `useLeadsOverview` hook (`GET /leads/overview`). A new thin `usePortalOverview` hook supplies the Portal category count. `LeadsScreen` (root `/` for staff) is rewired to render the dashboard sections, keeping the Attendance widget and dropping Recent Listings. Four stub routes are registered for category deep-links.

**Tech Stack:** React Native 0.81 / Expo SDK 54, Expo Router (typed routes), TanStack Query, NativeWind v4 + Tailwind, `react-native-svg@15.12.1`, CVA atoms (`Card`, `Badge`, `Text`, `Icon`).

## Global Constraints

- **No test runner.** Verification per task = `pnpm exec tsc --noEmit` clean + `pnpm lint` clean + manual QA. Never add a test runner or `.test.tsx` files.
- **No hard-coded hex.** Use semantic Tailwind tokens (`bg-card`, `text-foreground`, `text-success`, etc.); for native color _values_ use `useThemeColor('--token')`.
- **Strict TS** (`strict: true`); prop types use `Readonly<{...}>`.
- **Merge classes with `cn(...)`** from `@/lib/utils`. Don't fight `prettier-plugin-tailwindcss` class sorting.
- **Path aliases:** `@/*` → `src/*`, `@theme` → `theme`.
- **Package manager is pnpm.** Run scripts with `pnpm` / `pnpm exec`.
- **Commit after each task** once tsc + lint pass.
- Actual route tree is flat `app/(app)/leads/*` (the CLAUDE.md `(tabs)/(leads)` description is stale — trust the tree).

## Already exists — do NOT recreate

- `src/features/leads/services.ts` → `getLeadsOverview(params: OverviewQuery): Promise<LeadsOverview>` (calls `/api/v1/leads/overview`).
- `src/features/leads/hooks/use-leads-overview.ts` → `useLeadsOverview(params?: OverviewQuery)`, key `['leads','overview',params]`, `staleTime: 30_000`.
- `src/features/leads/types.ts` → `LeadsOverview`, `OverviewKpi`, `OverviewQuery`, `PriorityItem`, `TabCount`, `PipelineCount`, `TrendDirection`, `STATUS_BADGE_VARIANT`, `PRIORITY_BADGE_VARIANT`, `BadgeTone`.
- Atoms: `Card` (variants incl. `infoSoft`/`successSoft`/`warningSoft`/`destructiveSoft`/`mutedSoft`/`brandSoft`), `Badge` (same soft variants), `Text`, `Icon` (lucide wrapper, `name`+`size`+`color`), `Skeleton`, `EmptyState`, `Avatar`.
- `useThemeColor('--token')` from `@theme`; `useCan` / `PERMISSIONS` from `@/lib/rbac`.

## File map

| Path                                                            | Create/Modify | Responsibility                                |
| --------------------------------------------------------------- | ------------- | --------------------------------------------- |
| `src/features/leads/components/dashboard/Sparkline.tsx`         | Create        | SVG polyline mini-chart                       |
| `src/features/leads/components/dashboard/KpiCard.tsx`           | Create        | one KPI: count, trend arrow, sparkline        |
| `src/features/leads/components/dashboard/KpiGrid.tsx`           | Create        | 2-col grid of KpiCard + skeleton              |
| `src/features/leads/components/dashboard/action-cta.ts`         | Create        | actionType → tone+label map                   |
| `src/features/leads/components/dashboard/PriorityRow.tsx`       | Create        | one priority row, taps → detail               |
| `src/features/leads/components/dashboard/TodaysPriorities.tsx`  | Create        | priorities section + states                   |
| `src/features/leads/components/dashboard/CategoryCard.tsx`      | Create        | one category tile → route                     |
| `src/features/leads/components/dashboard/CategoryCardsGrid.tsx` | Create        | 2×2 grid + count wiring                       |
| `src/features/leads/components/dashboard/DateRangeChip.tsx`     | Create        | preset range selector                         |
| `src/features/leads/components/dashboard/LeadsDashboard.tsx`    | Create        | assembles all sections                        |
| `src/features/leads/types.ts`                                   | Modify        | fix `PriorityItem.property`, add portal types |
| `src/features/leads/services.ts`                                | Modify        | add `getPortalOverview`                       |
| `src/features/leads/hooks/use-portal-overview.ts`               | Create        | `usePortalOverview` hook                      |
| `app/(app)/leads/buy.tsx`,`sell.tsx`,`rent.tsx`,`portal.tsx`    | Create        | "Coming soon" stub screens                    |
| `app/(app)/_layout.tsx`                                         | Modify        | register 4 stub routes                        |
| `src/features/leads/components/LeadsScreen.tsx`                 | Modify        | render dashboard; drop Recent Listings        |

---

### Task 1: Sparkline component

**Files:**

- Create: `src/features/leads/components/dashboard/Sparkline.tsx`

**Interfaces:**

- Produces: `Sparkline({ data, color, width?, height? }: { data: number[]; color: string; width?: number; height?: number }): JSX.Element | null`

- [ ] **Step 1: Implement Sparkline**

```tsx
import { View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

interface SparklineProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}

/**
 * Tiny trend chart. Normalizes `data` into the given box; flat/empty data
 * renders a centered baseline so the card never looks broken.
 */
export function Sparkline({ data, color, width = 64, height = 24 }: Readonly<SparklineProps>) {
  if (!data || data.length === 0) return <View style={{ width, height }} />;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;
  const pad = 2;
  const usableH = height - pad * 2;

  const points = data
    .map((value, i) => {
      const x = i * stepX;
      const y = pad + (1 - (value - min) / span) * usableH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
```

- [ ] **Step 2: Verify types + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/leads/components/dashboard/Sparkline.tsx
git commit -m "feat(leads): add Sparkline svg mini-chart for dashboard KPIs"
```

---

### Task 2: KpiCard + KpiGrid

**Files:**

- Create: `src/features/leads/components/dashboard/KpiCard.tsx`
- Create: `src/features/leads/components/dashboard/KpiGrid.tsx`

**Interfaces:**

- Consumes: `Sparkline` (Task 1); `OverviewKpi`, `TrendDirection` from `../../types`.
- Produces: `KpiCard({ kpi }: { kpi: OverviewKpi })`; `KpiGrid({ kpis, loading }: { kpis: OverviewKpi[]; loading?: boolean })`.

- [ ] **Step 1: Implement KpiCard**

```tsx
import { View } from 'react-native';
import { useThemeColor } from '@theme';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import type { OverviewKpi, TrendDirection } from '../../types';
import { Sparkline } from './Sparkline';

const TREND_ICON: Record<TrendDirection, 'TrendingUp' | 'TrendingDown' | 'Minus'> = {
  up: 'TrendingUp',
  down: 'TrendingDown',
  flat: 'Minus',
};

const TREND_TEXT: Record<TrendDirection, string> = {
  up: 'text-success',
  down: 'text-destructive',
  flat: 'text-muted-foreground',
};

export function KpiCard({ kpi }: Readonly<{ kpi: OverviewKpi }>) {
  const direction: TrendDirection = kpi.trend?.direction ?? 'flat';
  const sparkColor = useThemeColor(
    direction === 'up'
      ? '--success'
      : direction === 'down'
        ? '--destructive'
        : '--muted-foreground',
  );
  const percent = kpi.trend?.percent ?? 0;

  return (
    <View className="flex-1 rounded-xl border border-border bg-card p-3" style={{ elevation: 1 }}>
      <Text className="text-xs text-muted-foreground" numberOfLines={1}>
        {kpi.label}
      </Text>
      <View className="mt-1 flex-row items-end justify-between">
        <Text className="text-2xl font-bold text-foreground">{kpi.count}</Text>
        <Sparkline data={kpi.trend?.sparkline ?? []} color={sparkColor} />
      </View>
      <View className="mt-1 flex-row items-center gap-1">
        <Icon name={TREND_ICON[direction]} size={12} color={sparkColor} />
        <Text className={`text-xs font-medium ${TREND_TEXT[direction]}`}>{Math.abs(percent)}%</Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Implement KpiGrid (rows of 2, with skeleton)**

```tsx
import { View } from 'react-native';
import { Skeleton } from '@/components/atoms/Skeleton';
import type { OverviewKpi } from '../../types';
import { KpiCard } from './KpiCard';

interface KpiGridProps {
  kpis: OverviewKpi[];
  loading?: boolean;
}

function chunkPairs<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return rows;
}

export function KpiGrid({ kpis, loading }: Readonly<KpiGridProps>) {
  if (loading) {
    return (
      <View className="gap-3 px-4">
        {[0, 1, 2].map((row) => (
          <View key={row} className="flex-row gap-3">
            <Skeleton className="h-24 flex-1 rounded-xl" />
            <Skeleton className="h-24 flex-1 rounded-xl" />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View className="gap-3 px-4">
      {chunkPairs(kpis).map((row, idx) => (
        <View key={row[0]?.key ?? idx} className="flex-row gap-3">
          {row.map((kpi) => (
            <KpiCard key={kpi.key} kpi={kpi} />
          ))}
          {row.length === 1 ? <View className="flex-1" /> : null}
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 3: Verify types + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors. (If `Icon` rejects a name, confirm the lucide key exists and adjust.)

- [ ] **Step 4: Commit**

```bash
git add src/features/leads/components/dashboard/KpiCard.tsx src/features/leads/components/dashboard/KpiGrid.tsx
git commit -m "feat(leads): add KPI card + grid for dashboard overview"
```

---

### Task 3: Today's Priorities (type fix + CTA map + components)

**Files:**

- Modify: `src/features/leads/types.ts` (fix `PriorityItem.property`)
- Create: `src/features/leads/components/dashboard/action-cta.ts`
- Create: `src/features/leads/components/dashboard/PriorityRow.tsx`
- Create: `src/features/leads/components/dashboard/TodaysPriorities.tsx`

**Interfaces:**

- Consumes: `PriorityItem` from `../../types`; `Badge`, `Avatar`, `EmptyState`, `Skeleton` atoms.
- Produces: `actionCta(actionType?: string | null): { label: string; tone: BadgeTone }`; `PriorityRow({ item }: { item: PriorityItem })`; `TodaysPriorities({ items, loading, error })`.

- [ ] **Step 1: Fix `PriorityItem.property` to match backend DTO**

The backend returns `property` as an object `{ thumbnailUrl?, price? }`, not a string. In `src/features/leads/types.ts`, replace:

```ts
export interface PriorityItem {
  leadId: string;
  name: string | null;
  avatarUrl?: string | null;
  reason: string;
  conditionRank?: number;
  property?: string | null;
  actionType?: string | null;
}
```

with:

```ts
export interface PriorityProperty {
  thumbnailUrl?: string | null;
  price?: number | null;
}

export interface PriorityItem {
  leadId: string;
  name: string | null;
  avatarUrl?: string | null;
  reason: string;
  conditionRank?: number;
  property?: PriorityProperty | null;
  actionType?: string | null;
}
```

> VERIFY against a live `GET /leads/overview` response during QA; if backend actually sends a string, render it as text in `PriorityRow` and revert this type.

- [ ] **Step 2: Implement actionCta map**

```ts
import type { BadgeTone } from '../../types';

const CTA_TONE: Record<string, BadgeTone> = {
  'Contact Now': 'destructiveSoft',
  'Follow Up': 'infoSoft',
  'Convert to Deal': 'successSoft',
  Negotiation: 'infoSoft',
  'View Deal': 'infoSoft',
  View: 'infoSoft',
};

/** Maps a backend `actionType` to a CTA chip label + tone, with a safe default. */
export function actionCta(actionType?: string | null): { label: string; tone: BadgeTone } {
  if (!actionType) return { label: 'Follow Up', tone: 'infoSoft' };
  return { label: actionType, tone: CTA_TONE[actionType] ?? 'infoSoft' };
}
```

- [ ] **Step 3: Implement PriorityRow**

```tsx
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar } from '@/components/atoms/Avatar';
import { Badge } from '@/components/atoms/Badge';
import { Text } from '@/components/atoms/Text';
import type { PriorityItem } from '../../types';
import { actionCta } from './action-cta';

function formatPrice(price?: number | null): string | null {
  if (price == null) return null;
  return `AED ${price.toLocaleString('en-US')}`;
}

export function PriorityRow({ item }: Readonly<{ item: PriorityItem }>) {
  const cta = actionCta(item.actionType);
  const price = formatPrice(item.property?.price);

  return (
    <Pressable
      onPress={() => router.push(`/leads/${item.leadId}`)}
      className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-3 active:opacity-80"
    >
      <Avatar
        source={item.avatarUrl ? { uri: item.avatarUrl } : undefined}
        fallback={item.name ?? '?'}
        size={40}
      />
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
          {item.name ?? 'Unknown lead'}
        </Text>
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {item.reason}
        </Text>
        {price ? <Text className="mt-0.5 text-xs font-medium text-foreground">{price}</Text> : null}
      </View>
      <Badge variant={cta.tone}>
        <Text>{cta.label}</Text>
      </Badge>
    </Pressable>
  );
}
```

> Confirm the `Avatar` atom's prop names (`source`/`fallback`/`size`) in `src/components/atoms/Avatar.tsx` and adjust this call if they differ.

- [ ] **Step 4: Implement TodaysPriorities**

```tsx
import { View } from 'react-native';
import { EmptyState } from '@/components/atoms/EmptyState';
import { Skeleton } from '@/components/atoms/Skeleton';
import { Text } from '@/components/atoms/Text';
import type { PriorityItem } from '../../types';
import { PriorityRow } from './PriorityRow';

interface TodaysPrioritiesProps {
  items: PriorityItem[];
  loading?: boolean;
  error?: Error | null;
}

export function TodaysPriorities({ items, loading, error }: Readonly<TodaysPrioritiesProps>) {
  return (
    <View>
      <Text className="px-4 text-base font-bold text-foreground">Today&apos;s Priorities</Text>
      <View className="mt-3 gap-3 px-4">
        {loading ? (
          <>
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </>
        ) : null}

        {!loading && error ? (
          <View className="rounded-xl bg-destructive/10 px-3 py-2">
            <Text className="text-xs text-destructive">{error.message}</Text>
          </View>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <EmptyState
            icon="ListChecks"
            title="No priorities right now"
            description="New high-priority leads will appear here."
          />
        ) : null}

        {!loading && !error
          ? [...items]
              .sort((a, b) => (a.conditionRank ?? 99) - (b.conditionRank ?? 99))
              .map((item) => <PriorityRow key={item.leadId} item={item} />)
          : null}
      </View>
    </View>
  );
}
```

> Confirm `EmptyState` prop names (`icon`/`title`/`description`) in `src/components/atoms/EmptyState.tsx` and adjust.

- [ ] **Step 5: Verify types + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/leads/types.ts src/features/leads/components/dashboard/action-cta.ts src/features/leads/components/dashboard/PriorityRow.tsx src/features/leads/components/dashboard/TodaysPriorities.tsx
git commit -m "feat(leads): add Today's Priorities section + actionType CTA map"
```

---

### Task 4: Portal overview data (types + service + hook)

**Files:**

- Modify: `src/features/leads/types.ts` (add portal types)
- Modify: `src/features/leads/services.ts` (add `getPortalOverview`)
- Create: `src/features/leads/hooks/use-portal-overview.ts`

**Interfaces:**

- Produces: `PortalOverview`, `PortalOverviewQuery` types; `getPortalOverview(params?: PortalOverviewQuery): Promise<PortalOverview>`; `usePortalOverview()`.

- [ ] **Step 1: Add portal types to `types.ts`**

```ts
// ---- Portal overview ----
export interface PortalChannelCounts {
  all: number;
  whatsapp: number;
  calls: number;
  emails: number;
}

export interface PortalOverview {
  channelCounts: PortalChannelCounts;
  cards: TabCount[];
}

export interface PortalOverviewQuery {
  tab?: 'all' | 'whatsapp' | 'calls' | 'emails';
  portalSource?: 'bayut' | 'property_finder' | 'dubizzle';
  dateFrom?: string;
  dateTo?: string;
}
```

- [ ] **Step 2: Add `getPortalOverview` to `services.ts`**

Add the import to the existing type import block (`PortalOverview`, `PortalOverviewQuery`) and append:

```ts
export async function getPortalOverview(params: PortalOverviewQuery = {}): Promise<PortalOverview> {
  const { data } = await apiClient.get<PortalOverview>('/api/v1/leads/portal-overview', {
    params,
  });
  return data;
}
```

- [ ] **Step 3: Create the hook**

```ts
import { useQuery } from '@tanstack/react-query';
import { getPortalOverview } from '../services';
import type { PortalOverviewQuery } from '../types';

export function usePortalOverview(params: PortalOverviewQuery = {}) {
  return useQuery({
    queryKey: ['leads', 'portal-overview', params],
    queryFn: () => getPortalOverview(params),
    staleTime: 30_000,
  });
}
```

- [ ] **Step 4: Verify types + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/leads/types.ts src/features/leads/services.ts src/features/leads/hooks/use-portal-overview.ts
git commit -m "feat(leads): add portal-overview service + hook for Portal category count"
```

---

### Task 5: Category stub routes + layout registration

**Files:**

- Create: `app/(app)/leads/buy.tsx`, `app/(app)/leads/sell.tsx`, `app/(app)/leads/rent.tsx`, `app/(app)/leads/portal.tsx`
- Modify: `app/(app)/_layout.tsx`

**Interfaces:**

- Produces: routes `/leads/buy`, `/leads/sell`, `/leads/rent`, `/leads/portal`.

- [ ] **Step 1: Create a shared stub via 4 thin route files**

`app/(app)/leads/buy.tsx`:

```tsx
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { EmptyState } from '@/components/atoms/EmptyState';

export default function BuyLeadsRoute() {
  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Buy Leads', headerShown: true }} />
      <EmptyState
        icon="Home"
        title="Buy Leads"
        description="Coming soon — buyer leads will live here."
      />
    </View>
  );
}
```

`app/(app)/leads/sell.tsx` — identical but `BuyLeadsRoute`→`SellLeadsRoute`, title `'Sell Leads'`, icon `'Tag'`, description "Coming soon — seller leads will live here."

`app/(app)/leads/rent.tsx` — `RentLeadsRoute`, title `'Rent Leads'`, icon `'KeyRound'`, description "Coming soon — rental leads will live here."

`app/(app)/leads/portal.tsx` — `PortalLeadsRoute`, title `'Portal Leads'`, icon `'Globe'`, description "Coming soon — portal leads (Bayut, Property Finder, Dubizzle) will live here."

> Confirm each icon name is a valid lucide key via the existing `Icon` usage; swap if `tsc` complains.

- [ ] **Step 2: Register routes in `app/(app)/_layout.tsx`**

Find the block of `<Stack.Screen name="leads/..." .../>` entries (near `leads/all`, `leads/[id]`) and add, matching the existing slide-transition style used by `leads/all`:

```tsx
<Stack.Screen name="leads/buy" />
<Stack.Screen name="leads/sell" />
<Stack.Screen name="leads/rent" />
<Stack.Screen name="leads/portal" />
```

> Match whatever `options` the sibling `leads/all` screen uses (e.g. `options={{ animation: 'slide_from_right' }}`); copy that prop set onto these four.

- [ ] **Step 3: Verify types + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors. Typed-routes should now know `/leads/buy` etc.

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/leads/buy.tsx app/\(app\)/leads/sell.tsx app/\(app\)/leads/rent.tsx app/\(app\)/leads/portal.tsx app/\(app\)/_layout.tsx
git commit -m "feat(leads): add Buy/Sell/Rent/Portal stub routes + register in layout"
```

---

### Task 6: Category cards grid

**Files:**

- Create: `src/features/leads/components/dashboard/CategoryCard.tsx`
- Create: `src/features/leads/components/dashboard/CategoryCardsGrid.tsx`

**Interfaces:**

- Consumes: `usePortalOverview` (Task 4); `LeadsOverview['tabCounts']`; routes from Task 5; `Card`, `Badge`, `Icon`, `Text` atoms.
- Produces: `CategoryCardsGrid({ tabCounts }: { tabCounts: TabCount[] })`.

- [ ] **Step 1: Implement CategoryCard**

```tsx
import { Pressable, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useThemeColor } from '@theme';
import { Badge } from '@/components/atoms/Badge';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';

interface CategoryCardProps {
  label: string;
  count: number;
  icon: IconName;
  href: Href;
}

export function CategoryCard({ label, count, icon, href }: Readonly<CategoryCardProps>) {
  const fg = useThemeColor('--foreground');
  return (
    <Pressable
      onPress={() => router.push(href)}
      className="flex-1 flex-row items-center justify-between rounded-xl border border-border bg-card p-4 active:opacity-80"
      style={{ elevation: 1 }}
    >
      <View className="flex-row items-center gap-2">
        <Icon name={icon} size={18} color={fg} />
        <Text className="text-sm font-semibold text-foreground">{label}</Text>
      </View>
      <Badge variant="mutedSoft">
        <Text>{count}</Text>
      </Badge>
    </Pressable>
  );
}
```

> If `Icon` does not export `IconName`, type `icon` as `React.ComponentProps<typeof Icon>['name']` instead.

- [ ] **Step 2: Implement CategoryCardsGrid**

`tabCounts` from `/leads/overview` carries the intent buckets. Resolve buy/sell/rent by matching `key` (or `label`) case-insensitively, with `0` fallback; Portal count comes from `usePortalOverview().channelCounts.all`.

```tsx
import { View } from 'react-native';
import { usePortalOverview } from '../../hooks/use-portal-overview';
import type { TabCount } from '../../types';
import { Text } from '@/components/atoms/Text';
import { CategoryCard } from './CategoryCard';

function countFor(tabCounts: TabCount[], key: string): number {
  const found = tabCounts.find(
    (t) => t.key?.toLowerCase() === key || t.label?.toLowerCase() === key,
  );
  return found?.count ?? 0;
}

export function CategoryCardsGrid({ tabCounts }: Readonly<{ tabCounts: TabCount[] }>) {
  const { data: portal } = usePortalOverview();
  const portalCount = portal?.channelCounts.all ?? 0;

  return (
    <View>
      <Text className="px-4 text-base font-bold text-foreground">Browse by category</Text>
      <View className="mt-3 gap-3 px-4">
        <View className="flex-row gap-3">
          <CategoryCard
            label="Buy"
            count={countFor(tabCounts, 'buy')}
            icon="Home"
            href="/leads/buy"
          />
          <CategoryCard
            label="Sell"
            count={countFor(tabCounts, 'sell')}
            icon="Tag"
            href="/leads/sell"
          />
        </View>
        <View className="flex-row gap-3">
          <CategoryCard
            label="Rent"
            count={countFor(tabCounts, 'rent')}
            icon="KeyRound"
            href="/leads/rent"
          />
          <CategoryCard label="Portal" count={portalCount} icon="Globe" href="/leads/portal" />
        </View>
      </View>
    </View>
  );
}
```

> VERIFY against a live `tabCounts` payload that buy/sell/rent keys match `'buy'|'sell'|'rent'`. If the keys differ (e.g. `intentBucket` values or label casing), adjust `countFor` keys accordingly.

- [ ] **Step 3: Verify types + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/leads/components/dashboard/CategoryCard.tsx src/features/leads/components/dashboard/CategoryCardsGrid.tsx
git commit -m "feat(leads): add Buy/Sell/Rent/Portal category cards grid"
```

---

### Task 7: DateRangeChip (preset selector)

**Files:**

- Create: `src/features/leads/components/dashboard/DateRangeChip.tsx`

**Interfaces:**

- Produces: `type RangePreset = 'all' | '7d' | '30d'`; `rangeToQuery(preset: RangePreset): { dateFrom?: string; dateTo?: string }`; `DateRangeChip({ value, onChange }: { value: RangePreset; onChange: (p: RangePreset) => void })`.

- [ ] **Step 1: Implement DateRangeChip**

A compact 3-segment toggle. Uses `Date` (available in app runtime) to compute ISO `YYYY-MM-DD` bounds.

```tsx
import { Pressable, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';

export type RangePreset = 'all' | '7d' | '30d';

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
];

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function rangeToQuery(preset: RangePreset): { dateFrom?: string; dateTo?: string } {
  if (preset === 'all') return {};
  const days = preset === '7d' ? 7 : 30;
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { dateFrom: isoDay(from), dateTo: isoDay(to) };
}

interface DateRangeChipProps {
  value: RangePreset;
  onChange: (preset: RangePreset) => void;
}

export function DateRangeChip({ value, onChange }: Readonly<DateRangeChipProps>) {
  return (
    <View className="flex-row rounded-full border border-border bg-card p-0.5">
      {PRESETS.map((p) => {
        const active = p.key === value;
        return (
          <Pressable
            key={p.key}
            onPress={() => onChange(p.key)}
            className={cn('rounded-full px-3 py-1', active ? 'bg-brand' : 'bg-transparent')}
          >
            <Text
              className={cn(
                'text-xs font-medium',
                active ? 'text-brand-foreground' : 'text-muted-foreground',
              )}
            >
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 2: Verify types + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/leads/components/dashboard/DateRangeChip.tsx
git commit -m "feat(leads): add date-range preset chip for dashboard"
```

---

### Task 8: LeadsDashboard assembly component

**Files:**

- Create: `src/features/leads/components/dashboard/LeadsDashboard.tsx`

**Interfaces:**

- Consumes: `useLeadsOverview` (existing); `KpiGrid`, `TodaysPriorities`, `CategoryCardsGrid`, `DateRangeChip`, `rangeToQuery`, `RangePreset` (Tasks 2,3,6,7).
- Produces: `LeadsDashboard(): JSX.Element` — the full stacked leads section (no ScrollView; host screen owns scroll).

- [ ] **Step 1: Implement LeadsDashboard**

```tsx
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { useLeadsOverview } from '../../hooks/use-leads-overview';
import { CategoryCardsGrid } from './CategoryCardsGrid';
import { DateRangeChip, rangeToQuery, type RangePreset } from './DateRangeChip';
import { KpiGrid } from './KpiGrid';
import { TodaysPriorities } from './TodaysPriorities';

export function LeadsDashboard() {
  const [range, setRange] = useState<RangePreset>('all');
  const params = useMemo(() => rangeToQuery(range), [range]);
  const { data, isLoading, error } = useLeadsOverview(params);

  return (
    <View className="gap-6">
      <View className="flex-row items-center justify-between px-4">
        <Text className="text-lg font-bold text-foreground">Leads</Text>
        <DateRangeChip value={range} onChange={setRange} />
      </View>

      <KpiGrid kpis={data?.kpis ?? []} loading={isLoading} />

      <TodaysPriorities
        items={data?.priorities ?? []}
        loading={isLoading}
        error={error as Error | null}
      />

      <CategoryCardsGrid tabCounts={data?.tabCounts ?? []} />
    </View>
  );
}
```

- [ ] **Step 2: Verify types + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/leads/components/dashboard/LeadsDashboard.tsx
git commit -m "feat(leads): assemble LeadsDashboard from KPI/priorities/category sections"
```

---

### Task 9: Wire dashboard into home screen; drop Recent Listings

**Files:**

- Modify: `src/features/leads/components/LeadsScreen.tsx`

**Interfaces:**

- Consumes: `LeadsDashboard` (Task 8).
- Replaces `LeadsHomeStatTiles` with the dashboard; removes `RecentListingsSection`; keeps `AttendanceWidget` + `RecentLeadsSection` + `HomeSearchBar`.

- [ ] **Step 1: Edit the imports**

Remove these two imports:

```tsx
import { RecentListingsSection } from '@/features/listings/components/RecentListingsSection';
import { LeadsHomeStatTiles } from './LeadsHomeStatTiles';
```

Add:

```tsx
import { LeadsDashboard } from './dashboard/LeadsDashboard';
```

`canReadListings` is still used to gate stat fetching — after this change the only listings usage is gone; remove the `canReadListings` const and the `useCan(PERMISSIONS.OPPORTUNITY_LISTING_READ)` line, plus the now-unused `RecentListingsSection` block.

- [ ] **Step 2: Replace the body**

Change the `ScrollView` children from:

```tsx
<HomeSearchBar />
<LeadsHomeStatTiles canReadLeads={canReadLeads} canReadListings={canReadListings} />
<View className="mx-4 mt-6">
  <AttendanceWidget />
</View>
{canReadLeads ? (
  <View className="mt-6">
    <RecentLeadsSection onViewAll={() => router.push('/leads/all')} />
  </View>
) : null}
{canReadListings ? (
  <View className="mt-4">
    <RecentListingsSection onViewAll={() => router.push('/listings')} />
  </View>
) : null}
```

to:

```tsx
<HomeSearchBar />;
{
  canReadLeads ? (
    <View className="mt-4">
      <LeadsDashboard />
    </View>
  ) : null;
}
{
  canReadLeads ? (
    <View className="mt-6">
      <RecentLeadsSection onViewAll={() => router.push('/leads/all')} />
    </View>
  ) : null;
}
<View className="mx-4 mt-6">
  <AttendanceWidget />
</View>;
```

(Leads dashboard first, recent leads next, Attendance last — per the locked ordering. Recent Listings removed.)

- [ ] **Step 3: Verify types + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors, no unused-import warnings (`canReadListings`, `RecentListingsSection` gone).

- [ ] **Step 4: Manual QA on simulator**

Run: `pnpm ios` (or `pnpm android`). With a logged-in staff account against a backend that has leads, confirm:

- KPI grid renders 6 cards with counts, trend arrows (correct color), and sparklines.
- Today's Priorities lists leads ordered by rank; tapping a row opens `/leads/[id]`; CTA chip label/color shows.
- Category grid shows Buy/Sell/Rent/Portal with counts; tapping each opens its "Coming soon" stub; back returns.
- Recent leads (3) + "View All" → `/leads/all` works.
- Attendance widget intact; Recent Listings gone.
- Date chip All/7d/30d refetches and counts change.
- Pull-to-refresh refetches overview (counts update).
- Loading shows skeletons; kill network → error banner in priorities; empty priorities → EmptyState.

- [ ] **Step 5: Commit**

```bash
git add src/features/leads/components/LeadsScreen.tsx
git commit -m "feat(leads): make staff home the unified Leads dashboard; drop Recent Listings"
```

---

## Self-Review

**Spec coverage:**

- Placement (home → dashboard, single source of truth) → Task 9. ✓
- Full KPI parity w/ sparklines + trends → Tasks 1, 2. ✓
- Today's Priorities w/ actionType CTA + tap-through → Task 3. ✓
- 2×2 category cards + counts → Task 6; Portal count source → Task 4. ✓
- Stub routes / nav placeholders → Task 5. ✓
- Keep Attendance, drop Recent Listings → Task 9. ✓
- Loading/error/empty + pull-to-refresh → Tasks 2,3 (states) + Task 9 (existing `qc.invalidateQueries()` covers `['leads']` keys incl. overview & portal-overview). ✓
- Date-range preset (spec: default + couple presets) → Task 7. ✓
- Status/priority/trend colors reuse existing maps → Tasks 2,3. ✓
- Actions = web overview (no inline status/assign on dashboard) → honored; none added. ✓

**Open verification items (flagged inline, resolve during Task 3/6 QA against live data):**

1. `PriorityItem.property` shape (object vs string) — Task 3 Step 1.
2. `tabCounts` key casing for buy/sell/rent — Task 6 Step 2.
3. Atom prop names (`Avatar`, `EmptyState`, `Icon` name/`IconName` export) — noted in Tasks 2,3,6.

**Type consistency:** `OverviewKpi`, `PriorityItem`, `TabCount`, `LeadsOverview`, `OverviewQuery`, `BadgeTone`, `PortalOverview` all sourced from `../../types`; hook names (`useLeadsOverview`, `usePortalOverview`) and service names (`getLeadsOverview`, `getPortalOverview`) consistent across tasks. ✓

**Note:** `LeadsHomeStatTiles.tsx` and `use-funnel-stats.ts` are left in the repo (no longer imported by home). Leave them; a later cleanup can delete if no other consumer. Confirm no other importer before deleting (`grep -rn LeadsHomeStatTiles src`).
