# Buy / Sell / Rent / Portal Leads — Mobile Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Buy/Sell/Rent/Portal dashboard cards open real mobile leads screens — a stage-chips + vertical list + move/assign sheets pattern replacing the web's drag-drop kanban.

**Architecture:** One config-driven `LeadsBrowseScreen` (intent vs portal) renders all 4 routes; vertical infinite list of `LeadCard` filtered by horizontal stage chips; moving/assigning via bottom sheets. Filter/tab state is local `useReducer`. Data via a new `useBrowseLeads` infinite hook over `GET /leads`.

**Tech Stack:** Expo Router, React Native, TanStack Query (infinite), NativeWind, existing CVA atoms + `LeadCard` + mutation hooks.

## Global Constraints

- **No test runner in this repo.** Verification per task = `pnpm exec tsc --noEmit` clean AND `pnpm lint` clean (+ manual QA on the final task). Never add tests / TDD / `.test.tsx`.
- **Strict TS**; prop types `Readonly<{...}>`; merge classes with `cn(...)`; no hard-coded hex (semantic tokens / `useThemeColor`).
- **pnpm**; aliases `@/*`→`src/*`, `@theme`→`theme`. Commit after each task once tsc+lint pass.
- Route tree is flat `app/(app)/leads/*`. Branch: `feat/leads-dashboard`.

## Existing assets (do NOT recreate)

- Hooks: `useAllLeadsInfinite` (`hooks/use-all-leads.ts`, PAGE_SIZE 20), `useUpdateLeadStatus` + `useAssignLead` (`hooks/use-lead-mutations.ts`, `mutate({id,status})` / `mutate({id,assigneeId})`), `useAgentsList(search?)` (`hooks/use-agents-list.ts`, `data.items: {id,firstName,lastName,email}[]`), `usePortalOverview(params?)` (`hooks/use-portal-overview.ts` → `{channelCounts:{all,whatsapp,calls,emails}, cards:{key,label,count}[]}`). NOTE: there is **no** generic debounce hook — `use-search-debounce.ts` exports only `useSearchDebounceSync` (bound to the global filter store, no params). This plan adds a generic `useDebouncedValue` in Task 1.
- `getLeads(params: LeadsQuery): Promise<PaginatedLeads>` (`services.ts`).
- `constants/board.ts`: `BOARD_STAGE_ORDER: LeadStatus[]` (New, Contacted, Qualified, Viewing_Scheduled, Working_Deal, Closed_Deal, Lost_Deal, Did_Not_Respond, Future_Prospect, Unqualified).
- `types.ts`: `LeadStatus`, `LeadPriority`, `LeadListItem`, `PaginatedLeads`, `LeadsQuery` (has `intentBucket`), `STATUS_LABEL`, `PRIORITY_LABEL`, `PRIORITY_FILTERS`.
- `LeadCard` (`components/LeadCard.tsx`): props `{ lead: LeadListItem }`; bottom row has call + chat buttons.
- `EmptyState`, `Text`, `Icon`, `Badge`, `cn`, `useThemeColor`, `useBottomTabBarSpace`, `MAIN_HEADER_HEIGHT`.

## File map

| Path                                                                 | Create/Modify | Responsibility                                                                          |
| -------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------- |
| `src/features/leads/types.ts`                                        | Modify        | add `isPortal`/`hasLink`/`pfChannel` to `LeadsQuery`; add `BrowseConfig`, `BrowseState` |
| `src/features/leads/components/browse/browseQuery.ts`                | Create        | `buildBrowseQuery`, `channelTabToPf`, reducer                                           |
| `src/features/leads/hooks/use-browse-leads.ts`                       | Create        | infinite query from config+state                                                        |
| `src/features/leads/components/browse/StageChips.tsx`                | Create        | All + stage chips                                                                       |
| `src/features/leads/components/browse/MarketTabs.tsx`                | Create        | All/Primary/Secondary                                                                   |
| `src/features/leads/components/browse/MoveStageSheet.tsx`            | Create        | move-to-stage sheet                                                                     |
| `src/features/leads/components/browse/AssignAgentSheet.tsx`          | Create        | assign sheet                                                                            |
| `src/features/leads/components/browse/LeadActionSheet.tsx`           | Create        | card ⋮ → Move/Assign/Detail                                                             |
| `src/features/leads/components/browse/BrowseFilterSheet.tsx`         | Create        | prop-driven priority/assignment/assignee                                                |
| `src/features/leads/components/LeadCard.tsx`                         | Modify        | optional `onKebab` + ⋮ button                                                           |
| `src/features/leads/components/browse/portal/PortalChannelTabs.tsx`  | Create        | channel tabs + counts                                                                   |
| `src/features/leads/components/browse/portal/PortalSummaryCards.tsx` | Create        | 4 summary cards                                                                         |
| `src/features/leads/components/browse/portal/PortalSourceFilter.tsx` | Create        | source selector                                                                         |
| `src/features/leads/components/browse/LeadsBrowseScreen.tsx`         | Create        | shell, reducer, orchestration                                                           |
| `app/(app)/leads/{buy,sell,rent,portal}.tsx`                         | Modify        | render `LeadsBrowseScreen`                                                              |

---

### Task 1: Data layer — query params, types, query builder, hook

**Files:**

- Modify: `src/features/leads/types.ts`
- Create: `src/features/leads/components/browse/browseQuery.ts`
- Create: `src/features/leads/hooks/use-browse-leads.ts`
- Create: `src/features/leads/hooks/use-debounced-value.ts`

**Interfaces:**

- Produces: `BrowseConfig`, `BrowseState`, `browseInitialState`, `browseReducer`, `BrowseAction`, `channelTabToPf`, `buildBrowseQuery`, `activeFilterCount`, `useBrowseLeads`, `useDebouncedValue`.

- [ ] **Step 1: Extend `LeadsQuery` in `types.ts`**

Add three fields inside `interface LeadsQuery` (after `intentBucket`):

```ts
  isPortal?: boolean;
  hasLink?: boolean;
  pfChannel?: 'whatsapp' | 'call' | 'email';
```

- [ ] **Step 2: Add `BrowseConfig` + `BrowseState` to `types.ts`** (append near the other exported types)

```ts
export type BrowseConfig =
  | { mode: 'intent'; intentBucket: 'buy' | 'sell' | 'rent'; title: string }
  | { mode: 'portal'; title: string };

export type MarketTab = 'all' | 'primary' | 'secondary';
export type ChannelTab = 'all' | 'whatsapp' | 'calls' | 'emails';
export type PortalSource = 'property_finder' | 'bayut' | 'dubizzle';
export type AssignmentFilter = 'all' | 'assigned' | 'unassigned';

export interface BrowseState {
  search: string;
  stage: LeadStatus | null;
  marketTab: MarketTab;
  channelTab: ChannelTab;
  portalSource: PortalSource | null;
  priority: LeadPriority | null;
  assignment: AssignmentFilter;
  assigneeId: string | null;
}
```

- [ ] **Step 3: Create `browseQuery.ts`** (builder + reducer)

```ts
import type {
  BrowseConfig,
  BrowseState,
  ChannelTab,
  LeadPriority,
  LeadStatus,
  LeadsQuery,
  MarketTab,
  PortalSource,
  AssignmentFilter,
} from '../../types';

export const browseInitialState: BrowseState = {
  search: '',
  stage: null,
  marketTab: 'all',
  channelTab: 'all',
  portalSource: null,
  priority: null,
  assignment: 'all',
  assigneeId: null,
};

export function channelTabToPf(tab: ChannelTab): 'whatsapp' | 'call' | 'email' | undefined {
  if (tab === 'whatsapp') return 'whatsapp';
  if (tab === 'calls') return 'call';
  if (tab === 'emails') return 'email';
  return undefined;
}

/** Build the leads list query from config + filter state + the debounced search. */
export function buildBrowseQuery(
  config: BrowseConfig,
  state: BrowseState,
  debouncedSearch: string,
): LeadsQuery {
  const base: LeadsQuery = {
    search: debouncedSearch || undefined,
    status: state.stage ?? undefined,
    priority: state.priority ?? undefined,
    isAssigned: state.assignment === 'all' ? undefined : state.assignment === 'assigned',
    assigneeId: state.assigneeId ?? undefined,
  };
  if (config.mode === 'intent') {
    return {
      ...base,
      intentBucket: config.intentBucket,
      hasLink: state.marketTab === 'all' ? undefined : state.marketTab === 'primary',
    };
  }
  return {
    ...base,
    isPortal: true,
    pfChannel: channelTabToPf(state.channelTab),
    portalSource: state.portalSource ?? undefined,
  };
}

/** Count of non-default filters for the Filters button badge. */
export function activeFilterCount(state: BrowseState): number {
  let n = 0;
  if (state.priority) n++;
  if (state.assignment !== 'all') n++;
  if (state.assigneeId) n++;
  return n;
}

export type BrowseAction =
  | { type: 'search'; value: string }
  | { type: 'stage'; value: LeadStatus | null }
  | { type: 'marketTab'; value: MarketTab }
  | { type: 'channelTab'; value: ChannelTab }
  | { type: 'portalSource'; value: PortalSource | null }
  | { type: 'priority'; value: LeadPriority | null }
  | { type: 'assignment'; value: AssignmentFilter }
  | { type: 'assigneeId'; value: string | null }
  | { type: 'clearFilters' };

export function browseReducer(state: BrowseState, action: BrowseAction): BrowseState {
  switch (action.type) {
    case 'search':
      return { ...state, search: action.value };
    case 'stage':
      return { ...state, stage: action.value };
    case 'marketTab':
      return { ...state, marketTab: action.value };
    case 'channelTab':
      return { ...state, channelTab: action.value };
    case 'portalSource':
      return { ...state, portalSource: action.value };
    case 'priority':
      return { ...state, priority: action.value };
    case 'assignment':
      return { ...state, assignment: action.value };
    case 'assigneeId':
      return { ...state, assigneeId: action.value };
    case 'clearFilters':
      return { ...state, priority: null, assignment: 'all', assigneeId: null };
    default:
      return state;
  }
}
```

- [ ] **Step 4: Create `use-browse-leads.ts`**

```ts
import { useInfiniteQuery } from '@tanstack/react-query';
import { getLeads } from '../services';
import type { BrowseConfig, BrowseState, PaginatedLeads } from '../types';
import { buildBrowseQuery } from '../components/browse/browseQuery';

const PAGE_SIZE = 20;

export function useBrowseLeads(config: BrowseConfig, state: BrowseState, debouncedSearch: string) {
  const query = buildBrowseQuery(config, state, debouncedSearch);
  return useInfiniteQuery<PaginatedLeads, Error>({
    queryKey: ['leads', 'browse', query],
    queryFn: ({ pageParam }) =>
      getLeads({
        ...query,
        page: pageParam as number,
        limit: PAGE_SIZE,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}
```

- [ ] **Step 5: Create `use-debounced-value.ts`** (generic; the existing `useSearchDebounceSync` is store-bound and unusable here)

```ts
import { useEffect, useState } from 'react';

/** Generic value debounce — returns `value` after `delayMs` of no change. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
```

- [ ] **Step 6: Verify** — `pnpm exec tsc --noEmit && pnpm lint` (clean).
- [ ] **Step 7: Commit**

```bash
git add src/features/leads/types.ts src/features/leads/components/browse/browseQuery.ts src/features/leads/hooks/use-browse-leads.ts src/features/leads/hooks/use-debounced-value.ts
git commit -m "feat(leads): browse query params, state reducer, debounce + useBrowseLeads hooks"
```

---

### Task 2: StageChips

**Files:** Create `src/features/leads/components/browse/StageChips.tsx`

**Interfaces:**

- Consumes: `BOARD_STAGE_ORDER`, `STATUS_LABEL`, `LeadStatus`.
- Produces: `StageChips({ value, onChange }: { value: LeadStatus | null; onChange: (s: LeadStatus | null) => void })`.

- [ ] **Step 1: Implement**

```tsx
import { Pressable, ScrollView } from 'react-native';
import { BOARD_STAGE_ORDER } from '@/features/leads/constants/board';
import { STATUS_LABEL, type LeadStatus } from '@/features/leads/types';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';

interface StageChipsProps {
  value: LeadStatus | null;
  onChange: (stage: LeadStatus | null) => void;
}

function Chip({
  label,
  active,
  onPress,
}: Readonly<{ label: string; active: boolean; onPress: () => void }>) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
      className={cn(
        'mr-2 rounded-full border px-3.5 py-2',
        active ? 'border-brand bg-brand' : 'border-border bg-card',
      )}
    >
      <Text
        className={cn(
          'text-xs font-bold',
          active ? 'text-brand-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function StageChips({ value, onChange }: Readonly<StageChipsProps>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16 }}
    >
      <Chip label="All" active={value === null} onPress={() => onChange(null)} />
      {BOARD_STAGE_ORDER.map((st) => (
        <Chip
          key={st}
          label={STATUS_LABEL[st]}
          active={value === st}
          onPress={() => onChange(st)}
        />
      ))}
    </ScrollView>
  );
}
```

- [ ] **Step 2: Verify** — `pnpm exec tsc --noEmit && pnpm lint`.
- [ ] **Step 3: Commit**

```bash
git add src/features/leads/components/browse/StageChips.tsx
git commit -m "feat(leads): stage chips selector"
```

---

### Task 3: MarketTabs

**Files:** Create `src/features/leads/components/browse/MarketTabs.tsx`

**Interfaces:**

- Consumes: `MarketTab`.
- Produces: `MarketTabs({ value, onChange }: { value: MarketTab; onChange: (t: MarketTab) => void })`.

- [ ] **Step 1: Implement**

```tsx
import { Pressable, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import type { MarketTab } from '@/features/leads/types';
import { cn } from '@/lib/utils';

const TABS: { key: MarketTab; label: string }[] = [
  { key: 'all', label: 'All Leads' },
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
];

export function MarketTabs({
  value,
  onChange,
}: Readonly<{ value: MarketTab; onChange: (t: MarketTab) => void }>) {
  return (
    <View className="mx-4 flex-row rounded-2xl bg-muted p-1">
      {TABS.map((t) => {
        const active = t.key === value;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.85 }]}
            className={cn('items-center rounded-xl py-2', active && 'bg-card shadow-sm')}
          >
            <Text
              className={cn('text-xs font-bold', active ? 'text-brand' : 'text-muted-foreground')}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 2: Verify** — tsc + lint.
- [ ] **Step 3: Commit**

```bash
git add src/features/leads/components/browse/MarketTabs.tsx
git commit -m "feat(leads): market tabs (all/primary/secondary)"
```

---

### Task 4: MoveStageSheet

**Files:** Create `src/features/leads/components/browse/MoveStageSheet.tsx`

**Interfaces:**

- Consumes: `useUpdateLeadStatus`, `BOARD_STAGE_ORDER`, `STATUS_LABEL`, `LeadStatus`.
- Produces: `MoveStageSheet({ leadId, visible, onClose }: { leadId: string | null; visible: boolean; onClose: () => void })`.

- [ ] **Step 1: Implement** (Viewing sets status directly — no scheduler)

```tsx
import { Modal, Pressable, ScrollView } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { useUpdateLeadStatus } from '@/features/leads/hooks/use-lead-mutations';
import { BOARD_STAGE_ORDER } from '@/features/leads/constants/board';
import { STATUS_LABEL, type LeadStatus } from '@/features/leads/types';

export function MoveStageSheet({
  leadId,
  visible,
  onClose,
}: Readonly<{ leadId: string | null; visible: boolean; onClose: () => void }>) {
  const update = useUpdateLeadStatus();
  if (!leadId) return null;
  const pick = (status: LeadStatus) =>
    update.mutate({ id: leadId, status }, { onSuccess: onClose });
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 justify-end bg-black/40">
        <Pressable onPress={() => {}} className="max-h-[70%] rounded-t-3xl bg-card p-5">
          <Text className="mb-3 text-lg font-extrabold text-foreground">Move to stage</Text>
          <ScrollView>
            {BOARD_STAGE_ORDER.map((st) => (
              <Pressable
                key={st}
                disabled={update.isPending}
                onPress={() => pick(st)}
                className="border-b border-border py-4"
              >
                <Text className="text-[15px] font-semibold text-foreground">
                  {STATUS_LABEL[st]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 2: Verify** — tsc + lint.
- [ ] **Step 3: Commit**

```bash
git add src/features/leads/components/browse/MoveStageSheet.tsx
git commit -m "feat(leads): move-to-stage sheet"
```

---

### Task 5: AssignAgentSheet + LeadActionSheet

**Files:**

- Create: `src/features/leads/components/browse/AssignAgentSheet.tsx`
- Create: `src/features/leads/components/browse/LeadActionSheet.tsx`

**Interfaces:**

- Consumes: `useAgentsList`, `useAssignLead`, `LeadListItem`.
- Produces: `AssignAgentSheet({ leadId, visible, onClose })`; `LeadActionSheet({ lead, visible, onClose, onMoveStage, onAssign })`.

- [ ] **Step 1: AssignAgentSheet**

```tsx
import { Modal, Pressable, ScrollView } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { useAgentsList } from '@/features/leads/hooks/use-agents-list';
import { useAssignLead } from '@/features/leads/hooks/use-lead-mutations';

export function AssignAgentSheet({
  leadId,
  visible,
  onClose,
}: Readonly<{ leadId: string | null; visible: boolean; onClose: () => void }>) {
  const { data } = useAgentsList();
  const assign = useAssignLead();
  if (!leadId) return null;
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 justify-end bg-black/40">
        <Pressable onPress={() => {}} className="max-h-[70%] rounded-t-3xl bg-card p-5">
          <Text className="mb-3 text-lg font-extrabold text-foreground">Assign to</Text>
          <ScrollView>
            {(data?.items ?? []).map((a) => {
              const name =
                [a.firstName, a.lastName].filter(Boolean).join(' ') || a.email || 'Agent';
              return (
                <Pressable
                  key={a.id}
                  disabled={assign.isPending}
                  onPress={() =>
                    assign.mutate({ id: leadId, assigneeId: a.id }, { onSuccess: onClose })
                  }
                  className="border-b border-border py-4"
                >
                  <Text className="text-[15px] font-semibold text-foreground">{name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 2: LeadActionSheet** (Move / Assign / Open detail)

```tsx
import { Modal, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Text } from '@/components/atoms/Text';
import type { LeadListItem } from '@/features/leads/types';

export function LeadActionSheet({
  lead,
  visible,
  onClose,
  onMoveStage,
  onAssign,
}: Readonly<{
  lead: LeadListItem | null;
  visible: boolean;
  onClose: () => void;
  onMoveStage: (lead: LeadListItem) => void;
  onAssign: (lead: LeadListItem) => void;
}>) {
  if (!lead) return null;
  const rows: { label: string; run: () => void }[] = [
    { label: 'Move stage', run: () => onMoveStage(lead) },
    { label: 'Assign', run: () => onAssign(lead) },
    { label: 'Open detail', run: () => router.push(`/leads/${lead.id}`) },
  ];
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 justify-end bg-black/40">
        <Pressable className="rounded-t-3xl bg-card p-4 pb-8" onPress={() => {}}>
          <Text className="mb-2 text-base font-extrabold text-foreground">
            {lead.name ?? 'Lead'}
          </Text>
          {rows.map((r) => (
            <Pressable
              key={r.label}
              onPress={() => {
                onClose();
                r.run();
              }}
              style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
              className="border-b border-border py-4"
            >
              <Text className="text-[15px] font-semibold text-foreground">{r.label}</Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 3: Verify** — tsc + lint.
- [ ] **Step 4: Commit**

```bash
git add src/features/leads/components/browse/AssignAgentSheet.tsx src/features/leads/components/browse/LeadActionSheet.tsx
git commit -m "feat(leads): assign-agent + lead-action sheets"
```

---

### Task 6: BrowseFilterSheet (prop-driven)

**Files:** Create `src/features/leads/components/browse/BrowseFilterSheet.tsx`

**Interfaces:**

- Consumes: `useAgentsList`, `PRIORITY_FILTERS`, `PRIORITY_LABEL`, `LeadPriority`, `AssignmentFilter`.
- Produces: `BrowseFilterSheet({ visible, onClose, priority, assignment, assigneeId, onPriority, onAssignment, onAssigneeId, onClear })`.

- [ ] **Step 1: Implement** (priority + assignment + assignee; prop-driven, no global store)

```tsx
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { useAgentsList } from '@/features/leads/hooks/use-agents-list';
import {
  PRIORITY_FILTERS,
  PRIORITY_LABEL,
  type AssignmentFilter,
  type LeadPriority,
} from '@/features/leads/types';
import { cn } from '@/lib/utils';

function Chip({
  label,
  active,
  onPress,
}: Readonly<{ label: string; active: boolean; onPress: () => void }>) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
      className={cn(
        'mb-2 mr-2 rounded-full border px-3.5 py-2',
        active ? 'border-brand bg-brand' : 'border-border bg-card',
      )}
    >
      <Text
        className={cn(
          'text-xs font-bold',
          active ? 'text-brand-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface BrowseFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  priority: LeadPriority | null;
  assignment: AssignmentFilter;
  assigneeId: string | null;
  onPriority: (p: LeadPriority | null) => void;
  onAssignment: (a: AssignmentFilter) => void;
  onAssigneeId: (id: string | null) => void;
  onClear: () => void;
}

const ASSIGNMENTS: AssignmentFilter[] = ['all', 'assigned', 'unassigned'];

export function BrowseFilterSheet({
  visible,
  onClose,
  priority,
  assignment,
  assigneeId,
  onPriority,
  onAssignment,
  onAssigneeId,
  onClear,
}: Readonly<BrowseFilterSheetProps>) {
  const { data: agents } = useAgentsList();
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="max-h-[85%] rounded-t-3xl bg-card p-5">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-extrabold text-foreground">Filters</Text>
            <Pressable onPress={onClear}>
              <Text className="text-sm font-bold text-brand">Clear all</Text>
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text className="mb-2 mt-2 text-xs font-extrabold uppercase text-muted-foreground">
              Assignment
            </Text>
            <View className="flex-row flex-wrap">
              {ASSIGNMENTS.map((a) => (
                <Chip
                  key={a}
                  label={a[0].toUpperCase() + a.slice(1)}
                  active={assignment === a}
                  onPress={() => onAssignment(a)}
                />
              ))}
            </View>

            <Text className="mb-2 mt-3 text-xs font-extrabold uppercase text-muted-foreground">
              Priority
            </Text>
            <View className="flex-row flex-wrap">
              {PRIORITY_FILTERS.map((p) => (
                <Chip
                  key={p}
                  label={PRIORITY_LABEL[p]}
                  active={priority === p}
                  onPress={() => onPriority(priority === p ? null : p)}
                />
              ))}
            </View>

            <Text className="mb-2 mt-3 text-xs font-extrabold uppercase text-muted-foreground">
              Assignee
            </Text>
            <View className="flex-row flex-wrap">
              {(agents?.items ?? []).map((a) => {
                const name =
                  [a.firstName, a.lastName].filter(Boolean).join(' ') || a.email || 'Agent';
                return (
                  <Chip
                    key={a.id}
                    label={name}
                    active={assigneeId === a.id}
                    onPress={() => onAssigneeId(assigneeId === a.id ? null : a.id)}
                  />
                );
              })}
            </View>
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => (pressed ? { opacity: 0.9 } : null)}
            className="mt-4 items-center rounded-2xl bg-brand py-3.5"
          >
            <Text className="text-base font-extrabold text-brand-foreground">Apply</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: Verify** — tsc + lint.
- [ ] **Step 3: Commit**

```bash
git add src/features/leads/components/browse/BrowseFilterSheet.tsx
git commit -m "feat(leads): prop-driven browse filter sheet"
```

---

### Task 7: LeadCard kebab

**Files:** Modify `src/features/leads/components/LeadCard.tsx`

**Interfaces:**

- Produces: `LeadCard` now accepts optional `onKebab?: (lead: LeadListItem) => void`.

- [ ] **Step 1: Add prop + button**

In `LeadCard`, change the signature to:

```tsx
export function LeadCard({ lead, onKebab }: Readonly<{ lead: LeadListItem; onKebab?: (lead: LeadListItem) => void }>) {
```

Then, inside the bottom action row `<View className="flex-row gap-2">` (the one holding the call/chat buttons), append a kebab button as the last child, before the closing `</View>`:

```tsx
{
  onKebab ? (
    <Pressable
      onPress={() => onKebab(lead)}
      accessibilityRole="button"
      accessibilityLabel="Lead actions"
      className="h-9 w-9 items-center justify-center rounded-xl bg-muted active:opacity-70"
    >
      <Icon name="EllipsisVertical" size={16} />
    </Pressable>
  ) : null;
}
```

(`Pressable`, `Icon` are already imported in this file.)

- [ ] **Step 2: Verify** — `pnpm exec tsc --noEmit && pnpm lint`. If `EllipsisVertical` is not a valid lucide key, use `MoreVertical`.
- [ ] **Step 3: Commit**

```bash
git add src/features/leads/components/LeadCard.tsx
git commit -m "feat(leads): optional kebab action button on LeadCard"
```

---

### Task 8: LeadsBrowseScreen (shell + intent path)

**Files:** Create `src/features/leads/components/browse/LeadsBrowseScreen.tsx`

**Interfaces:**

- Consumes: everything from Tasks 1-7 + `useBrowseLeads`, `useSearchDebounce`, `LeadCard`, portal pieces (Task 9 — imported but rendered only in portal mode; create portal files in Task 9 BEFORE this task compiles, so do Task 9 first if building strictly in order — see note).
- Produces: `LeadsBrowseScreen({ config }: { config: BrowseConfig })`.

> Build order note: this task imports the portal components from Task 9. Implement Task 9's three portal files first (they have no dependency on this screen), then this task. The plan lists them after for narrative flow; the implementer should create Task 9 files before wiring them here, or stub the portal branch and fill in Task 9. Recommended: do Task 9 then Task 8.

- [ ] **Step 1: Implement the shell**

```tsx
import { useMemo, useReducer, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useThemeColor } from '@theme';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { EmptyState } from '@/components/atoms/EmptyState';
import { useBottomTabBarSpace } from '@/features/new-projects/components/BottomTabBar';
import { useDebouncedValue } from '@/features/leads/hooks/use-debounced-value';
import { useBrowseLeads } from '@/features/leads/hooks/use-browse-leads';
import { PERMISSIONS, useCan } from '@/lib/rbac';
import type { BrowseConfig, LeadListItem } from '@/features/leads/types';
import { LeadCard } from '../LeadCard';
import { StageChips } from './StageChips';
import { MarketTabs } from './MarketTabs';
import { LeadActionSheet } from './LeadActionSheet';
import { MoveStageSheet } from './MoveStageSheet';
import { AssignAgentSheet } from './AssignAgentSheet';
import { BrowseFilterSheet } from './BrowseFilterSheet';
import { PortalChannelTabs } from './portal/PortalChannelTabs';
import { PortalSummaryCards } from './portal/PortalSummaryCards';
import { PortalSourceFilter } from './portal/PortalSourceFilter';
import { browseInitialState, browseReducer, activeFilterCount } from './browseQuery';

export function LeadsBrowseScreen({ config }: Readonly<{ config: BrowseConfig }>) {
  const insets = useSafeAreaInsets();
  const tabBarSpace = useBottomTabBarSpace();
  const mutedFg = useThemeColor('--muted-foreground');
  const brandFg = useThemeColor('--brand-foreground');
  const canCreate = useCan(PERMISSIONS.LEADS_CREATE);

  const [state, dispatch] = useReducer(browseReducer, browseInitialState);
  const debouncedSearch = useDebouncedValue(state.search, 300);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionLead, setActionLead] = useState<LeadListItem | null>(null);
  const [moveLeadId, setMoveLeadId] = useState<string | null>(null);
  const [assignLeadId, setAssignLeadId] = useState<string | null>(null);

  const isPortal = config.mode === 'portal';
  const deferredPortal =
    isPortal && (state.portalSource === 'bayut' || state.portalSource === 'dubizzle');

  const q = useBrowseLeads(config, state, debouncedSearch);
  const leads = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  const filterCount = activeFilterCount(state);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-2">
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="h-9 w-9 items-center justify-center rounded-full"
          >
            <Icon name="ChevronLeft" size={22} />
          </Pressable>
          <Text className="text-xl font-extrabold text-foreground">{config.title}</Text>
        </View>
        <Pressable
          onPress={() => setFiltersOpen(true)}
          className="flex-row items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2"
        >
          <Icon name="SlidersHorizontal" size={15} />
          <Text className="text-xs font-bold text-foreground">
            Filters{filterCount ? ` (${filterCount})` : ''}
          </Text>
        </Pressable>
      </View>

      {/* Mode-specific top region */}
      {config.mode === 'intent' ? (
        <MarketTabs
          value={state.marketTab}
          onChange={(v) => dispatch({ type: 'marketTab', value: v })}
        />
      ) : (
        <>
          <PortalChannelTabs
            value={state.channelTab}
            portalSource={state.portalSource}
            onChange={(v) => dispatch({ type: 'channelTab', value: v })}
          />
          <PortalSummaryCards channelTab={state.channelTab} portalSource={state.portalSource} />
          <PortalSourceFilter
            value={state.portalSource}
            onChange={(v) => dispatch({ type: 'portalSource', value: v })}
          />
        </>
      )}

      {/* Search */}
      <View className="mx-4 mb-2 mt-2 flex-row items-center gap-2 rounded-xl border border-border bg-card px-3">
        <Icon name="Search" size={18} color={mutedFg} />
        <TextInput
          value={state.search}
          onChangeText={(v) => dispatch({ type: 'search', value: v })}
          placeholder="Search name, phone, email"
          placeholderTextColor={mutedFg}
          className="h-11 flex-1 text-base text-foreground"
        />
      </View>

      <View className="mb-2">
        <StageChips value={state.stage} onChange={(v) => dispatch({ type: 'stage', value: v })} />
      </View>

      {/* List */}
      {deferredPortal ? (
        <EmptyState
          icon="PlugZap"
          title="Not connected yet"
          description="This portal integration isn't available yet."
        />
      ) : q.isLoading ? (
        <View className="items-center py-10">
          <ActivityIndicator />
        </View>
      ) : q.isError ? (
        <View className="mx-4 rounded-xl bg-destructive/10 px-3 py-2">
          <Text className="text-xs text-destructive">
            {q.error?.message ?? 'Failed to load leads.'}
          </Text>
        </View>
      ) : leads.length === 0 ? (
        <EmptyState icon="Inbox" title="No leads" description="No leads match this view." />
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(l) => l.id}
          renderItem={({ item }) => <LeadCard lead={item} onKebab={setActionLead} />}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: tabBarSpace + 80,
            gap: 12,
          }}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
          }}
          ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator className="py-4" /> : null}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
        />
      )}

      {/* Create FAB */}
      {canCreate ? (
        <Pressable
          onPress={() => router.push('/leads/create')}
          accessibilityRole="button"
          accessibilityLabel="Create lead"
          style={{
            position: 'absolute',
            right: 16,
            bottom: tabBarSpace,
            elevation: 6,
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          }}
          className="h-14 w-14 items-center justify-center rounded-full bg-brand"
        >
          <Icon name="Plus" size={24} color={brandFg} />
        </Pressable>
      ) : null}

      {/* Sheets */}
      <BrowseFilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        priority={state.priority}
        assignment={state.assignment}
        assigneeId={state.assigneeId}
        onPriority={(p) => dispatch({ type: 'priority', value: p })}
        onAssignment={(a) => dispatch({ type: 'assignment', value: a })}
        onAssigneeId={(id) => dispatch({ type: 'assigneeId', value: id })}
        onClear={() => dispatch({ type: 'clearFilters' })}
      />
      <LeadActionSheet
        lead={actionLead}
        visible={!!actionLead}
        onClose={() => setActionLead(null)}
        onMoveStage={(l) => {
          setActionLead(null);
          setMoveLeadId(l.id);
        }}
        onAssign={(l) => {
          setActionLead(null);
          setAssignLeadId(l.id);
        }}
      />
      <MoveStageSheet
        leadId={moveLeadId}
        visible={!!moveLeadId}
        onClose={() => setMoveLeadId(null)}
      />
      <AssignAgentSheet
        leadId={assignLeadId}
        visible={!!assignLeadId}
        onClose={() => setAssignLeadId(null)}
      />
    </View>
  );
}
```

- [ ] **Step 2: Verify** — `pnpm exec tsc --noEmit && pnpm lint`. (Requires Task 9 portal files to exist — build Task 9 first.) If `ChevronLeft`/`PlugZap` icon keys are invalid, swap to `ArrowLeft` / `Plug`.
- [ ] **Step 3: Commit**

```bash
git add src/features/leads/components/browse/LeadsBrowseScreen.tsx
git commit -m "feat(leads): LeadsBrowseScreen shell with stage chips, list, sheets, FAB"
```

---

### Task 9: Portal pieces (build BEFORE Task 8 wiring)

**Files:**

- Create: `src/features/leads/components/browse/portal/PortalChannelTabs.tsx`
- Create: `src/features/leads/components/browse/portal/PortalSummaryCards.tsx`
- Create: `src/features/leads/components/browse/portal/PortalSourceFilter.tsx`

**Interfaces:**

- Consumes: `usePortalOverview`, `ChannelTab`, `PortalSource`.
- Produces: `PortalChannelTabs({ value, portalSource, onChange })`; `PortalSummaryCards({ channelTab, portalSource })`; `PortalSourceFilter({ value, onChange })`.

- [ ] **Step 1: PortalChannelTabs**

```tsx
import { Pressable, View } from 'react-native';
import { Badge } from '@/components/atoms/Badge';
import { Text } from '@/components/atoms/Text';
import { usePortalOverview } from '@/features/leads/hooks/use-portal-overview';
import type { ChannelTab, PortalSource } from '@/features/leads/types';
import { cn } from '@/lib/utils';

const TABS: { key: ChannelTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'calls', label: 'Calls' },
  { key: 'emails', label: 'Emails' },
];

export function PortalChannelTabs({
  value,
  portalSource,
  onChange,
}: Readonly<{
  value: ChannelTab;
  portalSource: PortalSource | null;
  onChange: (t: ChannelTab) => void;
}>) {
  const { data } = usePortalOverview({ tab: value, portalSource: portalSource ?? undefined });
  const counts = data?.channelCounts;
  const countFor = (k: ChannelTab) => (counts ? counts[k] : undefined);

  return (
    <View className="mx-4 flex-row rounded-2xl bg-muted p-1">
      {TABS.map((t) => {
        const active = t.key === value;
        const c = countFor(t.key);
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.85 }]}
            className={cn(
              'flex-row items-center justify-center gap-1 rounded-xl py-2',
              active && 'bg-card shadow-sm',
            )}
          >
            <Text
              className={cn('text-xs font-bold', active ? 'text-brand' : 'text-muted-foreground')}
            >
              {t.label}
            </Text>
            {c !== undefined ? (
              <Badge variant="mutedSoft">
                <Text>{c}</Text>
              </Badge>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 2: PortalSummaryCards**

```tsx
import { View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { usePortalOverview } from '@/features/leads/hooks/use-portal-overview';
import type { ChannelTab, PortalSource } from '@/features/leads/types';

export function PortalSummaryCards({
  channelTab,
  portalSource,
}: Readonly<{ channelTab: ChannelTab; portalSource: PortalSource | null }>) {
  const { data } = usePortalOverview({ tab: channelTab, portalSource: portalSource ?? undefined });
  const cards = data?.cards ?? [];
  if (cards.length === 0) return null;
  return (
    <View className="mx-4 mt-3 flex-row flex-wrap gap-3">
      {cards.map((c) => (
        <View
          key={c.key}
          className="min-w-[45%] flex-1 rounded-2xl border border-border bg-card p-3"
        >
          <Text className="text-xl font-extrabold text-foreground">{c.count}</Text>
          <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
            {c.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 3: PortalSourceFilter** (segmented; bayut/dubizzle deferred but still selectable to show coming-soon)

```tsx
import { Pressable, ScrollView } from 'react-native';
import { Text } from '@/components/atoms/Text';
import type { PortalSource } from '@/features/leads/types';
import { cn } from '@/lib/utils';

const SOURCES: { key: PortalSource; label: string }[] = [
  { key: 'property_finder', label: 'Property Finder' },
  { key: 'bayut', label: 'Bayut' },
  { key: 'dubizzle', label: 'Dubizzle' },
];

export function PortalSourceFilter({
  value,
  onChange,
}: Readonly<{ value: PortalSource | null; onChange: (s: PortalSource | null) => void }>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}
    >
      <Pressable
        onPress={() => onChange(null)}
        className={cn(
          'mr-2 rounded-full border px-3.5 py-2',
          value === null ? 'border-brand bg-brand' : 'border-border bg-card',
        )}
      >
        <Text
          className={cn(
            'text-xs font-bold',
            value === null ? 'text-brand-foreground' : 'text-muted-foreground',
          )}
        >
          All sources
        </Text>
      </Pressable>
      {SOURCES.map((s) => {
        const active = value === s.key;
        return (
          <Pressable
            key={s.key}
            onPress={() => onChange(active ? null : s.key)}
            className={cn(
              'mr-2 rounded-full border px-3.5 py-2',
              active ? 'border-brand bg-brand' : 'border-border bg-card',
            )}
          >
            <Text
              className={cn(
                'text-xs font-bold',
                active ? 'text-brand-foreground' : 'text-muted-foreground',
              )}
            >
              {s.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
```

- [ ] **Step 4: Verify** — tsc + lint.
- [ ] **Step 5: Commit**

```bash
git add src/features/leads/components/browse/portal/
git commit -m "feat(leads): portal channel tabs, summary cards, source filter"
```

---

### Task 10: Wire the four routes

**Files:** Modify `app/(app)/leads/buy.tsx`, `sell.tsx`, `rent.tsx`, `portal.tsx`

**Interfaces:** Consumes `LeadsBrowseScreen`.

- [ ] **Step 1: Replace each stub** — `buy.tsx`:

```tsx
import { Stack } from 'expo-router';
import { LeadsBrowseScreen } from '@/features/leads/components/browse/LeadsBrowseScreen';

export default function BuyRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LeadsBrowseScreen config={{ mode: 'intent', intentBucket: 'buy', title: 'Buy Leads' }} />
    </>
  );
}
```

`sell.tsx` → `SellRoute`, `intentBucket: 'sell'`, title `'Sell Leads'`.
`rent.tsx` → `RentRoute`, `intentBucket: 'rent'`, title `'Rent Leads'`.
`portal.tsx`:

```tsx
import { Stack } from 'expo-router';
import { LeadsBrowseScreen } from '@/features/leads/components/browse/LeadsBrowseScreen';

export default function PortalRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LeadsBrowseScreen config={{ mode: 'portal', title: 'Portal Leads' }} />
    </>
  );
}
```

- [ ] **Step 2: Verify** — `pnpm exec tsc --noEmit && pnpm lint`.

- [ ] **Step 3: Manual QA** — `pnpm ios` (or android). For each of Buy/Sell/Rent/Portal (reach via dashboard category cards):
  - List loads leads scoped to the category; back button returns.
  - Stage chips filter the list; search filters; market tabs (intent) change results; channel tabs (portal) change results + counts; summary cards render (portal).
  - Card ⋮ → action sheet → Move (status updates, list refreshes) and Assign (agent assigned).
  - Call/chat buttons + tap-to-detail work.
  - Filters sheet (priority/assignment/assignee) narrows results; Clear all resets; badge count correct.
  - Portal source Bayut/Dubizzle → "Not connected yet" empty state.
  - Infinite scroll + pull-to-refresh; empty/error/loading states.

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/leads/buy.tsx app/\(app\)/leads/sell.tsx app/\(app\)/leads/rent.tsx app/\(app\)/leads/portal.tsx
git commit -m "feat(leads): wire Buy/Sell/Rent/Portal routes to LeadsBrowseScreen"
```

---

## Self-Review

**Spec coverage:**

- Config-driven shared screen + 4 routes → Tasks 8, 10. ✓
- Stage chips + list + move sheet → Tasks 2, 4, 8. ✓
- Market tabs (intent) → Task 3, 8. ✓
- Filter sheet (priority/assignment/assignee) → Task 6, 8. ✓
- Move + assign + contact + detail → Tasks 4, 5, 7 (kebab), LeadCard call/chat. ✓
- Portal channel tabs + counts + summary cards + source filter (PF live / Bayut-Dubizzle coming-soon) → Task 9, 8. ✓
- Data params `isPortal`/`hasLink`/`pfChannel` + `useBrowseLeads` → Task 1. ✓
- Labels-only chips; Move→Viewing sets status directly → Tasks 2, 4. ✓
- States (loading/empty/error/infinite/refresh) → Task 8. ✓

**Build-order caveat:** Task 8 imports Task 9's portal files — **implement Task 9 before Task 8's verify step** (noted in both tasks).

**Type consistency:** `BrowseConfig`/`BrowseState`/`MarketTab`/`ChannelTab`/`PortalSource`/`AssignmentFilter` defined in Task 1, consumed consistently in Tasks 3,6,8,9. Hook names `useBrowseLeads`/`usePortalOverview`/`useUpdateLeadStatus`/`useAssignLead`/`useAgentsList` match existing exports. `buildBrowseQuery` maps to real `LeadsQuery` fields (Task 1 Step 1 adds the new ones).

**Icon fallbacks flagged:** `EllipsisVertical`→`MoreVertical`, `ChevronLeft`→`ArrowLeft`, `PlugZap`→`Plug`, `SlidersHorizontal` (used already, valid).

**Out of scope honored:** no board/list toggle, no viewing scheduler, no date range, no notes sheet, no per-chip counts.
