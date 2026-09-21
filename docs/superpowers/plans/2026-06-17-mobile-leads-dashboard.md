# Mobile Leads Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the web `/my-account/manage-leads` dashboard to `boh-mobile` as native components with full functional parity, via a three-view (Overview / Pipeline / List) segmented dashboard.

**Architecture:** One `LeadsDashboardScreen` hosts a segmented control switching three sub-views backed by a shared filter store. Data via TanStack Query against existing `/api/v1` endpoints. Web drag-drop is replaced by tap → action sheet. Reuses existing atomic UI kit, RBAC hooks, axios client, and infinite-query patterns.

**Tech Stack:** Expo Router, React Native 0.81, NativeWind, TanStack Query v5, Zustand, axios, lucide-react-native.

## Global Constraints

- **No unit-test runner / no TDD.** Verify every task with `pnpm tsc --noEmit` (typecheck) + `pnpm lint` + manual QA. (Project convention — `boh-mobile` has no test runner.)
- Package manager is **pnpm**.
- All API paths include the explicit `/api/v1` prefix; `apiClient` prepends `CONFIG.API_BASE_URL`.
- Reuse existing UI kit (`src/components/atoms`, `molecules`), tokens, and `cn()`. Do not add heavy new deps; if a pager is needed and none exists, use a paged horizontal `FlatList`.
- Contact (phone/email) masked unless `useLeadPermissions().canViewContact`; action buttons gated by the same hook.
- Follow existing query-key conventions (`['leads', ...]`) and `decryptLeadContact` mapping in services.
- Commit after each task. Work on branch `feat/leads-dashboard` (already created).

---

## File Structure

**New files**

- `src/features/leads/store/dashboard-filter.store.ts` — shared dashboard filter Zustand store.
- `src/features/leads/hooks/use-leads-overview.ts`
- `src/features/leads/hooks/use-board-leads.ts`
- `src/features/leads/hooks/use-agents-list.ts`
- `src/features/leads/hooks/use-lead-mutations.ts` — status / assign / create-viewing / create-note.
- `src/features/leads/hooks/use-lead-notes.ts`
- `src/features/leads/components/dashboard/LeadsDashboardScreen.tsx`
- `src/features/leads/components/dashboard/LeadsSegmentedControl.tsx`
- `src/features/leads/components/dashboard/shared/LeadQuickActions.tsx`
- `src/features/leads/components/dashboard/shared/LeadActionSheet.tsx`
- `src/features/leads/components/dashboard/overview/OverviewView.tsx`
- `src/features/leads/components/dashboard/overview/KpiGrid.tsx`
- `src/features/leads/components/dashboard/overview/PrioritiesCarousel.tsx`
- `src/features/leads/components/dashboard/overview/PipelineSummary.tsx`
- `src/features/leads/components/dashboard/pipeline/PipelineView.tsx`
- `src/features/leads/components/dashboard/pipeline/PipelineColumn.tsx`
- `src/features/leads/components/dashboard/pipeline/PipelineLeadCard.tsx`
- `src/features/leads/components/dashboard/list/ListView.tsx`
- `src/features/leads/components/dashboard/filters/LeadsFilterSheet.tsx`
- `src/features/leads/components/dashboard/sheets/AssignAgentSheet.tsx`
- `src/features/leads/components/dashboard/sheets/StatusChangeSheet.tsx`
- `src/features/leads/components/dashboard/sheets/ViewingSchedulerSheet.tsx`
- `src/features/leads/components/dashboard/sheets/AddNoteSheet.tsx`
- `src/features/leads/constants/board.ts` — stage order + grouping + labels.

**Modified files**

- `src/features/leads/types.ts` — add overview/agents/viewing/note types; extend `LeadsQuery` and `LeadListItem`.
- `src/features/leads/services.ts` — add overview/agents/viewing/notes services.
- `app/(public)/index.tsx` — render `LeadsDashboardScreen` for agents.
- `app/(app)/leads/index.tsx` — render `LeadsDashboardScreen`.

---

## Task 1: Types & board constants

**Files:**

- Modify: `src/features/leads/types.ts`
- Create: `src/features/leads/constants/board.ts`

**Interfaces:**

- Produces: `LeadsOverview`, `OverviewKpi`, `PriorityItem`, `PipelineCount`, `AgentListItem`, `PaginatedAgents`, `AgentsQuery`, `CreateViewingPayload`, `LeadViewing`, `LeadNote`; extended `LeadsQuery`, `LeadListItem`; constants `PRIMARY_STAGES`, `SECONDARY_STAGES`, `BOARD_STAGE_ORDER`.

- [ ] **Step 1: Add dashboard types to `types.ts`**

Append to `src/features/leads/types.ts`:

```typescript
// ---- Dashboard overview ----
export type TrendDirection = 'up' | 'down' | 'flat';

export interface OverviewKpi {
  key: string;
  label: string;
  count: number;
  trend?: { percent: number; direction: TrendDirection; sparkline?: number[] };
}

export interface PipelineCount {
  status: LeadStatus;
  count: number;
}

export interface PriorityItem {
  leadId: string;
  name: string | null;
  avatarUrl?: string | null;
  reason: string;
  conditionRank?: number;
  property?: string | null;
  actionType?: string | null;
}

export interface TabCount {
  key: string;
  label: string;
  count: number;
}

export interface LeadsOverview {
  kpis: OverviewKpi[];
  tabCounts: TabCount[];
  pipelineCounts: PipelineCount[];
  priorities: PriorityItem[];
}

export interface OverviewQuery {
  agentId?: string;
  teamId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ---- Agents (assignee picker) ----
export interface AgentListItem {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

export interface PaginatedAgents {
  items: AgentListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AgentsQuery {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
}

// ---- Viewing scheduler ----
export type ViewingPropertyType = 'new_project' | 'sale' | 'rent';

export interface CreateViewingPayload {
  viewingDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  propertyType: ViewingPropertyType;
  remarks: string;
  transactionType?: 'sale' | 'rent';
  projects?: {
    developerId: string;
    developerName?: string;
    projectName: string;
    bedrooms: number;
  }[];
  listings?: { listingType: 'primary' | 'secondary'; listingId: string }[];
  setStatusToViewing?: boolean;
}

export interface LeadViewing {
  id: string;
  viewingDate: string;
  startTime: string;
  endTime: string;
  propertyType: ViewingPropertyType;
  remarks: string;
  createdAt: string;
}

// ---- Notes ----
export interface LeadNote {
  id: string;
  content: string;
  author?: { id: string; name: string };
  createdAt: string;
  updatedAt?: string;
  canModify?: boolean;
}
```

- [ ] **Step 2: Extend `LeadsQuery` and `LeadListItem`**

In `src/features/leads/types.ts`, replace the existing `LeadsQuery` interface with:

```typescript
export interface LeadsQuery {
  page?: number;
  limit?: number;
  status?: LeadStatus;
  statuses?: LeadStatus[];
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  interest?: LeadInterest;
  interestType?: LeadInterestType;
  priority?: LeadPriority;
  assigneeId?: string;
  isAssigned?: boolean;
  channel?: string;
  externalSource?: string;
  dateFrom?: string;
  dateTo?: string;
  callOutcome?: 'connected' | 'missed' | 'with_recording';
  portalSource?: 'bayut' | 'property_finder' | 'dubizzle';
}
```

And replace `LeadListItem` with (adds optional card fields; all optional so existing usages still compile):

```typescript
export interface LeadAssigneeRef {
  id: string;
  name?: string | null;
  avatarUrl?: string | null;
}

export interface LeadListItem {
  id: string;
  requestId: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  status: LeadStatus;
  priority?: LeadPriority | null;
  propertyType?: string | null;
  channel?: string | null;
  leadType?: LeadTypeRef | null;
  updatedAt: string;
  // dashboard card fields (optional — degrade gracefully if backend omits)
  preferredCity?: string | null;
  budgetRange?: string | null;
  externalSource?: string | null;
  interest?: LeadInterest | null;
  isAssigned?: boolean;
  assignee?: LeadAssigneeRef | null;
  lastNote?: { content: string; createdAt: string } | null;
}
```

- [ ] **Step 3: Create board constants**

Create `src/features/leads/constants/board.ts`:

```typescript
import type { LeadStatus } from '../types';

export const PRIMARY_STAGES: LeadStatus[] = [
  'New',
  'Contacted',
  'Qualified',
  'Viewing_Scheduled',
  'Working_Deal',
  'Closed_Deal',
  'Lost_Deal',
];

export const SECONDARY_STAGES: LeadStatus[] = ['Did_Not_Respond', 'Future_Prospect', 'Unqualified'];

export const BOARD_STAGE_ORDER: LeadStatus[] = [...PRIMARY_STAGES, ...SECONDARY_STAGES];
```

- [ ] **Step 4: Verify**

Run: `cd /Users/nabeel.ahmed/Desktop/Projects/boh/boh-mobile && pnpm tsc --noEmit`
Expected: no new type errors.

Run: `pnpm lint`
Expected: clean (or only pre-existing warnings).

- [ ] **Step 5: Commit**

```bash
git add src/features/leads/types.ts src/features/leads/constants/board.ts
git commit -m "feat(leads): dashboard types and board stage constants"
```

---

## Task 2: Services

**Files:**

- Modify: `src/features/leads/services.ts`

**Interfaces:**

- Consumes: types from Task 1.
- Produces: `getLeadsOverview`, `getAgents`, `createLeadViewing`, `getLeadNotes`, `createLeadNote`. (`getLeads` and `updateLead` already exist.)

- [ ] **Step 1: Verify the `/leads` list response shape**

Manual check (one-time): hit `GET /api/v1/leads?limit=1` with a valid token (or inspect backend `LeadResponseDto`) and confirm which of `assignee`, `isAssigned`, `budgetRange`, `preferredCity`, `externalSource`, `lastNote` are present. Note findings in the PR description. Cards already degrade gracefully (all optional), so this does not block — but record any missing field as a backend follow-up.

- [ ] **Step 2: Add services**

Append to `src/features/leads/services.ts` (follow the existing `apiClient` + return-mapping style already in the file):

```typescript
import type {
  LeadsOverview,
  OverviewQuery,
  PaginatedAgents,
  AgentsQuery,
  CreateViewingPayload,
  LeadViewing,
  LeadNote,
} from './types';

export async function getLeadsOverview(params: OverviewQuery): Promise<LeadsOverview> {
  const { data } = await apiClient.get<LeadsOverview>('/api/v1/leads/overview', { params });
  return data;
}

export async function getAgents(params: AgentsQuery): Promise<PaginatedAgents> {
  const { data } = await apiClient.get<PaginatedAgents>('/api/v1/agents', {
    params: { isActive: true, limit: 50, ...params },
  });
  return data;
}

export async function createLeadViewing(
  leadId: string,
  payload: CreateViewingPayload,
): Promise<LeadViewing> {
  const { data } = await apiClient.post<LeadViewing>(`/api/v1/leads/${leadId}/viewings`, payload);
  return data;
}

export async function getLeadNotes(leadId: string): Promise<LeadNote[]> {
  const { data } = await apiClient.get<LeadNote[]>(`/api/v1/leads/${leadId}/notes`);
  return data;
}

export async function createLeadNote(leadId: string, content: string): Promise<LeadNote> {
  const { data } = await apiClient.post<LeadNote>(`/api/v1/leads/${leadId}/notes`, { content });
  return data;
}
```

> Note: if `services.ts` already imports from `./types` at top, merge these names into the existing import instead of adding a duplicate import line.

- [ ] **Step 3: Verify**

Run: `pnpm tsc --noEmit` — Expected: clean.
Run: `pnpm lint` — Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/features/leads/services.ts
git commit -m "feat(leads): overview, agents, viewing, notes services"
```

---

## Task 3: Dashboard filter store

**Files:**

- Create: `src/features/leads/store/dashboard-filter.store.ts`

**Interfaces:**

- Produces: `useDashboardFilterStore`, `selectDashboardLeadsQuery(state): Partial<LeadsQuery>`, `selectDashboardFilterCount(state): number`.

- [ ] **Step 1: Create the store**

Create `src/features/leads/store/dashboard-filter.store.ts`:

```typescript
import { create } from 'zustand';
import type { LeadPriority, LeadStatus, LeadsQuery } from '../types';

export type AssignmentFilter = 'any' | 'assigned' | 'unassigned';

export interface DashboardFilterState {
  assignment: AssignmentFilter;
  priority: LeadPriority | null;
  stageFilter: LeadStatus | null;
  assigneeId: string | null;
  portalSource: LeadsQuery['portalSource'] | null;
  callOutcome: LeadsQuery['callOutcome'] | null;
  dateFrom: string | null;
  dateTo: string | null;
  searchInput: string;
  debouncedSearch: string;
  setAssignment: (v: AssignmentFilter) => void;
  setPriority: (v: LeadPriority | null) => void;
  setStageFilter: (v: LeadStatus | null) => void;
  setAssigneeId: (v: string | null) => void;
  setPortalSource: (v: LeadsQuery['portalSource'] | null) => void;
  setCallOutcome: (v: LeadsQuery['callOutcome'] | null) => void;
  setDateRange: (from: string | null, to: string | null) => void;
  setSearchInput: (v: string) => void;
  setDebouncedSearch: (v: string) => void;
  clearAll: () => void;
}

const initial = {
  assignment: 'any' as AssignmentFilter,
  priority: null,
  stageFilter: null,
  assigneeId: null,
  portalSource: null,
  callOutcome: null,
  dateFrom: null,
  dateTo: null,
  searchInput: '',
  debouncedSearch: '',
};

export const useDashboardFilterStore = create<DashboardFilterState>((set) => ({
  ...initial,
  setAssignment: (assignment) => set({ assignment }),
  setPriority: (priority) => set({ priority }),
  setStageFilter: (stageFilter) => set({ stageFilter }),
  setAssigneeId: (assigneeId) => set({ assigneeId }),
  setPortalSource: (portalSource) => set({ portalSource }),
  setCallOutcome: (callOutcome) => set({ callOutcome }),
  setDateRange: (dateFrom, dateTo) => set({ dateFrom, dateTo }),
  setSearchInput: (searchInput) => set({ searchInput }),
  setDebouncedSearch: (debouncedSearch) => set({ debouncedSearch }),
  clearAll: () => set({ ...initial }),
}));

export function selectDashboardLeadsQuery(state: DashboardFilterState): Partial<LeadsQuery> {
  const q: Partial<LeadsQuery> = {};
  if (state.debouncedSearch) q.search = state.debouncedSearch;
  if (state.assignment === 'assigned') q.isAssigned = true;
  if (state.assignment === 'unassigned') q.isAssigned = false;
  if (state.priority) q.priority = state.priority;
  if (state.assigneeId) q.assigneeId = state.assigneeId;
  if (state.portalSource) q.portalSource = state.portalSource;
  if (state.callOutcome) q.callOutcome = state.callOutcome;
  if (state.dateFrom) q.dateFrom = state.dateFrom;
  if (state.dateTo) q.dateTo = state.dateTo;
  return q;
}

export function selectDashboardFilterCount(state: DashboardFilterState): number {
  let n = 0;
  if (state.assignment !== 'any') n++;
  if (state.priority) n++;
  if (state.stageFilter) n++;
  if (state.assigneeId) n++;
  if (state.portalSource) n++;
  if (state.callOutcome) n++;
  if (state.dateFrom || state.dateTo) n++;
  return n;
}
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc --noEmit` — Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/leads/store/dashboard-filter.store.ts
git commit -m "feat(leads): dashboard filter store"
```

---

## Task 4: Query & mutation hooks

**Files:**

- Create: `src/features/leads/hooks/use-leads-overview.ts`
- Create: `src/features/leads/hooks/use-board-leads.ts`
- Create: `src/features/leads/hooks/use-agents-list.ts`
- Create: `src/features/leads/hooks/use-lead-mutations.ts`
- Create: `src/features/leads/hooks/use-lead-notes.ts`

**Interfaces:**

- Consumes: services (Task 2), types (Task 1).
- Produces: `useLeadsOverview(params?)`, `useBoardLeads(status, query)`, `useAgentsList(search)`, `useUpdateLeadStatus()`, `useAssignLead()`, `useCreateViewing()`, `useLeadNotes(leadId)`, `useCreateLeadNote(leadId)`, and exported `invalidateLeadsDashboard(qc)`.

- [ ] **Step 1: Overview hook**

Create `src/features/leads/hooks/use-leads-overview.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { getLeadsOverview } from '../services';
import type { OverviewQuery } from '../types';

export function useLeadsOverview(params: OverviewQuery = {}) {
  return useQuery({
    queryKey: ['leads', 'overview', params],
    queryFn: () => getLeadsOverview(params),
    staleTime: 30_000,
  });
}
```

- [ ] **Step 2: Board leads hook (one infinite query per stage column)**

Create `src/features/leads/hooks/use-board-leads.ts`:

```typescript
import { useInfiniteQuery } from '@tanstack/react-query';
import { getLeads } from '../services';
import type { LeadStatus, LeadsQuery } from '../types';

const PAGE_SIZE = 20;

export function useBoardLeads(status: LeadStatus, query: Partial<LeadsQuery>, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['leads', 'board', status, query],
    enabled,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      getLeads({ ...query, status, page: pageParam as number, limit: PAGE_SIZE }),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}
```

- [ ] **Step 3: Agents list hook**

Create `src/features/leads/hooks/use-agents-list.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { getAgents } from '../services';

export function useAgentsList(search?: string) {
  return useQuery({
    queryKey: ['agents', 'list', search ?? ''],
    queryFn: () => getAgents({ search, isActive: true, limit: 50 }),
    staleTime: 5 * 60_000,
  });
}
```

- [ ] **Step 4: Mutation hooks + shared invalidation**

Create `src/features/leads/hooks/use-lead-mutations.ts`:

```typescript
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { updateLead, createLeadViewing } from '../services';
import type { CreateViewingPayload, LeadPriority, LeadStatus } from '../types';

export function invalidateLeadsDashboard(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['leads'] });
  qc.invalidateQueries({ queryKey: ['leads', 'overview'] });
  qc.invalidateQueries({ queryKey: ['leads', 'board'] });
  qc.invalidateQueries({ queryKey: ['leads', 'funnel-stats'] });
}

export function useUpdateLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) => updateLead(id, { status }),
    onSuccess: () => invalidateLeadsDashboard(qc),
  });
}

export function useAssignLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assigneeId }: { id: string; assigneeId: string | null }) =>
      updateLead(id, { assigneeId }),
    onSuccess: () => invalidateLeadsDashboard(qc),
  });
}

export function useSetLeadPriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: LeadPriority }) =>
      updateLead(id, { priority }),
    onSuccess: () => invalidateLeadsDashboard(qc),
  });
}

export function useCreateViewing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, payload }: { leadId: string; payload: CreateViewingPayload }) =>
      createLeadViewing(leadId, payload),
    onSuccess: () => invalidateLeadsDashboard(qc),
  });
}
```

> If `updateLead`'s `UpdateLeadPayload` type does not include `assigneeId`/`priority`/`status`, widen it in `types.ts` (those fields are accepted by the backend `UpdateLeadDto`).

- [ ] **Step 5: Notes hooks**

Create `src/features/leads/hooks/use-lead-notes.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getLeadNotes, createLeadNote } from '../services';

export function useLeadNotes(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-notes', leadId],
    queryFn: () => getLeadNotes(leadId as string),
    enabled: !!leadId,
    staleTime: 30_000,
  });
}

export function useCreateLeadNote(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => createLeadNote(leadId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-notes', leadId] });
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}
```

- [ ] **Step 6: Verify**

Run: `pnpm tsc --noEmit` — Expected: clean.
Run: `pnpm lint` — Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/features/leads/hooks/use-leads-overview.ts src/features/leads/hooks/use-board-leads.ts src/features/leads/hooks/use-agents-list.ts src/features/leads/hooks/use-lead-mutations.ts src/features/leads/hooks/use-lead-notes.ts
git commit -m "feat(leads): overview/board/agents/mutation/notes hooks"
```

---

## Task 5: Shared dashboard components (segmented control, quick actions, action sheet)

**Files:**

- Create: `src/features/leads/components/dashboard/LeadsSegmentedControl.tsx`
- Create: `src/features/leads/components/dashboard/shared/LeadQuickActions.tsx`
- Create: `src/features/leads/components/dashboard/shared/LeadActionSheet.tsx`

**Interfaces:**

- Consumes: `useLeadPermissions`, existing call/chat navigation, atoms.
- Produces: `LeadsSegmentedControl` (`value`, `onChange`), `LeadQuickActions` (`lead`), `LeadActionSheet` (`lead`, `visible`, `onClose`, `onMoveStage`, `onAssign`, `onAddNote`).

- [ ] **Step 1: Segmented control**

Create `src/features/leads/components/dashboard/LeadsSegmentedControl.tsx`:

```tsx
import { Pressable, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';

export type DashboardView = 'overview' | 'pipeline' | 'list';
const OPTIONS: { key: DashboardView; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'list', label: 'List' },
];

export function LeadsSegmentedControl({
  value,
  onChange,
}: {
  value: DashboardView;
  onChange: (v: DashboardView) => void;
}) {
  return (
    <View className="mx-4 mb-3 flex-row rounded-2xl bg-muted p-1">
      {OPTIONS.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.85 }]}
            className={cn('items-center rounded-xl py-2.5', active && 'bg-card shadow-sm')}
          >
            <Text
              className={cn('text-sm font-bold', active ? 'text-brand' : 'text-muted-foreground')}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

> Adjust the `@/` import alias and the exact `Text` import path to match the project's existing convention (check an existing component's imports first).

- [ ] **Step 2: Quick actions row**

Create `src/features/leads/components/dashboard/shared/LeadQuickActions.tsx`:

```tsx
import { Linking, Pressable, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { Icon } from '@/components/atoms/Icon';
import { useLeadPermissions } from '@/features/leads/hooks/use-lead-permissions';
import type { LeadListItem } from '@/features/leads/types';
import { cn } from '@/lib/utils';

export function LeadQuickActions({ lead }: { lead: LeadListItem }) {
  const perms = useLeadPermissions(lead);

  const email = () => lead.email && Linking.openURL(`mailto:${lead.email}`);
  const whatsapp = () => {
    if (!lead.phone) return;
    const n = lead.phone.replace(/[^0-9]/g, '');
    Linking.openURL(`https://wa.me/${n}`);
  };
  // Call routes to the existing soft-phone flow; replace with the project's call entry point.
  const call = () => lead.phone && Linking.openURL(`tel:${lead.phone}`);

  return (
    <View className="mt-3 flex-row gap-2">
      <Action
        label="Email"
        icon="mail"
        onPress={email}
        disabled={!perms.canViewContact || !lead.email}
      />
      <Action
        label="Call"
        icon="phone"
        onPress={call}
        primary
        disabled={!perms.canCall || !lead.phone}
      />
      <Action
        label="WhatsApp"
        icon="message-circle"
        onPress={whatsapp}
        disabled={!perms.canViewContact || !lead.phone}
      />
    </View>
  );
}

function Action({
  label,
  icon,
  onPress,
  primary,
  disabled,
}: {
  label: string;
  icon: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  if (disabled) return null;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.85 }]}
      className={cn(
        'flex-row items-center justify-center gap-1.5 rounded-xl py-2.5',
        primary ? 'bg-brand' : 'bg-muted',
      )}
    >
      <Icon
        name={icon}
        size={15}
        className={primary ? 'text-brand-foreground' : 'text-foreground'}
      />
      <Text
        className={cn('text-xs font-bold', primary ? 'text-brand-foreground' : 'text-foreground')}
      >
        {label}
      </Text>
    </Pressable>
  );
}
```

> Verify `Icon` accepts string `name` and a `className`/`color` prop the way shown; match the existing `Icon` API. Replace the `call` handler with the real soft-phone navigation used elsewhere (search for the existing Call button in `LeadCard.tsx`).

- [ ] **Step 3: Action sheet**

Create `src/features/leads/components/dashboard/shared/LeadActionSheet.tsx`:

```tsx
import { Modal, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Text } from '@/components/atoms/Text';
import type { LeadListItem } from '@/features/leads/types';

export function LeadActionSheet({
  lead,
  visible,
  onClose,
  onMoveStage,
  onAssign,
  onAddNote,
}: {
  lead: LeadListItem | null;
  visible: boolean;
  onClose: () => void;
  onMoveStage: (lead: LeadListItem) => void;
  onAssign: (lead: LeadListItem) => void;
  onAddNote: (lead: LeadListItem) => void;
}) {
  if (!lead) return null;
  const rows: { label: string; run: () => void }[] = [
    { label: 'Move stage', run: () => onMoveStage(lead) },
    { label: 'Assign', run: () => onAssign(lead) },
    { label: 'Add note', run: () => onAddNote(lead) },
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
              style={({ pressed }) => pressed && { opacity: 0.85 }}
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

- [ ] **Step 4: Verify**

Run: `pnpm tsc --noEmit` — Expected: clean.
Run: `pnpm lint` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/leads/components/dashboard/LeadsSegmentedControl.tsx src/features/leads/components/dashboard/shared/
git commit -m "feat(leads): segmented control, quick actions, action sheet"
```

---

## Task 6: Overview sub-view

**Files:**

- Create: `src/features/leads/components/dashboard/overview/KpiGrid.tsx`
- Create: `src/features/leads/components/dashboard/overview/PrioritiesCarousel.tsx`
- Create: `src/features/leads/components/dashboard/overview/PipelineSummary.tsx`
- Create: `src/features/leads/components/dashboard/overview/OverviewView.tsx`

**Interfaces:**

- Consumes: `useLeadsOverview` (Task 4), board constants (Task 1), `LeadStatus`.
- Produces: `OverviewView` (`onOpenStage: (status: LeadStatus) => void`).

- [ ] **Step 1: KPI grid**

Create `src/features/leads/components/dashboard/overview/KpiGrid.tsx`:

```tsx
import { View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { Icon } from '@/components/atoms/Icon';
import type { OverviewKpi } from '@/features/leads/types';

export function KpiGrid({ kpis }: { kpis: OverviewKpi[] }) {
  return (
    <View className="flex-row flex-wrap gap-3">
      {kpis.map((k) => (
        <View
          key={k.key}
          className="min-w-[45%] flex-1 rounded-2xl border border-border bg-card p-4"
        >
          <Text className="text-2xl font-extrabold text-foreground">{k.count}</Text>
          <Text className="mt-1 text-xs font-semibold text-muted-foreground">{k.label}</Text>
          {k.trend ? (
            <View className="mt-2 flex-row items-center gap-1">
              <Icon
                name={k.trend.direction === 'down' ? 'trending-down' : 'trending-up'}
                size={12}
                className={k.trend.direction === 'down' ? 'text-destructive' : 'text-success'}
              />
              <Text
                className={`text-[11px] font-bold ${k.trend.direction === 'down' ? 'text-destructive' : 'text-success'}`}
              >
                {k.trend.percent}%
              </Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Priorities carousel**

Create `src/features/leads/components/dashboard/overview/PrioritiesCarousel.tsx`:

```tsx
import { FlatList, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Text } from '@/components/atoms/Text';
import type { PriorityItem } from '@/features/leads/types';

export function PrioritiesCarousel({ items }: { items: PriorityItem[] }) {
  if (!items.length) {
    return <Text className="px-1 text-sm text-muted-foreground">No priorities today.</Text>;
  }
  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={items}
      keyExtractor={(i) => i.leadId}
      ItemSeparatorComponent={() => <View className="w-3" />}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/leads/${item.leadId}`)}
          style={({ pressed }) => pressed && { opacity: 0.85 }}
          className="w-56 rounded-2xl border border-border bg-card p-4"
        >
          <Text className="text-[11px] font-extrabold text-destructive">🔥 PRIORITY</Text>
          <Text className="mt-1.5 text-[15px] font-extrabold text-foreground">
            {item.name ?? 'Lead'}
          </Text>
          {item.property ? (
            <Text className="mt-0.5 text-xs text-muted-foreground">{item.property}</Text>
          ) : null}
          <View className="mt-2 rounded-lg bg-warning/10 px-2 py-1">
            <Text className="text-[11px] font-bold text-warning">{item.reason}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}
```

- [ ] **Step 3: Pipeline summary**

Create `src/features/leads/components/dashboard/overview/PipelineSummary.tsx`:

```tsx
import { Pressable, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { PRIMARY_STAGES, SECONDARY_STAGES } from '@/features/leads/constants/board';
import { STATUS_LABEL, type LeadStatus, type PipelineCount } from '@/features/leads/types';

export function PipelineSummary({
  counts,
  onOpenStage,
}: {
  counts: PipelineCount[];
  onOpenStage: (status: LeadStatus) => void;
}) {
  const map = new Map(counts.map((c) => [c.status, c.count]));
  const max = Math.max(1, ...counts.map((c) => c.count));
  const Row = ({ status, bar }: { status: LeadStatus; bar: boolean }) => {
    const count = map.get(status) ?? 0;
    return (
      <Pressable
        onPress={() => onOpenStage(status)}
        style={({ pressed }) => pressed && { opacity: 0.85 }}
        className="flex-row items-center justify-between border-b border-border/60 px-3.5 py-3"
      >
        <Text className="text-sm font-semibold text-foreground">{STATUS_LABEL[status]}</Text>
        <View className="flex-row items-center gap-2.5">
          {bar ? (
            <View className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
              <View
                className="h-full rounded-full bg-brand"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </View>
          ) : null}
          <Text className="w-7 text-right text-sm font-extrabold text-foreground">{count}</Text>
        </View>
      </Pressable>
    );
  };
  return (
    <View className="rounded-2xl border border-border bg-card">
      {PRIMARY_STAGES.map((s) => (
        <Row key={s} status={s} bar />
      ))}
      <Text className="px-3.5 pb-1 pt-2.5 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">
        Other
      </Text>
      {SECONDARY_STAGES.map((s) => (
        <Row key={s} status={s} bar={false} />
      ))}
    </View>
  );
}
```

- [ ] **Step 4: Overview container**

Create `src/features/leads/components/dashboard/overview/OverviewView.tsx`:

```tsx
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { useLeadsOverview } from '@/features/leads/hooks/use-leads-overview';
import type { LeadStatus } from '@/features/leads/types';
import { KpiGrid } from './KpiGrid';
import { PrioritiesCarousel } from './PrioritiesCarousel';
import { PipelineSummary } from './PipelineSummary';

export function OverviewView({ onOpenStage }: { onOpenStage: (s: LeadStatus) => void }) {
  const { data, isLoading, isError, refetch } = useLeadsOverview();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <ActivityIndicator />
      </View>
    );
  }
  if (isError || !data) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <Text className="text-sm text-muted-foreground" onPress={() => refetch()}>
          Failed to load. Tap to retry.
        </Text>
      </View>
    );
  }
  return (
    <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 24 }}>
      <Text className="mb-3 mt-1 text-sm font-extrabold text-foreground">Performance</Text>
      <KpiGrid kpis={data.kpis} />
      <Text className="mb-3 mt-6 text-sm font-extrabold text-foreground">
        🔥 Today's Priorities
      </Text>
      <PrioritiesCarousel items={data.priorities} />
      <Text className="mb-3 mt-6 text-sm font-extrabold text-foreground">Pipeline</Text>
      <PipelineSummary counts={data.pipelineCounts} onOpenStage={onOpenStage} />
    </ScrollView>
  );
}
```

- [ ] **Step 5: Verify**

Run: `pnpm tsc --noEmit` — Expected: clean.
Run: `pnpm lint` — Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/features/leads/components/dashboard/overview/
git commit -m "feat(leads): overview sub-view (KPIs, priorities, pipeline summary)"
```

---

## Task 7: Pipeline sub-view (swipe-column board)

**Files:**

- Create: `src/features/leads/components/dashboard/pipeline/PipelineLeadCard.tsx`
- Create: `src/features/leads/components/dashboard/pipeline/PipelineColumn.tsx`
- Create: `src/features/leads/components/dashboard/pipeline/PipelineView.tsx`

**Interfaces:**

- Consumes: `useBoardLeads` (Task 4), `BOARD_STAGE_ORDER` (Task 1), filter store (Task 3), `LeadQuickActions`, `LeadActionSheet`, badges.
- Produces: `PipelineView` (`initialStage?`, `onOpenFilters`, sheet callbacks `onMoveStage`/`onAssign`/`onAddNote`).

- [ ] **Step 1: Pipeline lead card**

Create `src/features/leads/components/dashboard/pipeline/PipelineLeadCard.tsx`:

```tsx
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Text } from '@/components/atoms/Text';
import { Badge } from '@/components/atoms/Badge';
import { Icon } from '@/components/atoms/Icon';
import { LeadQuickActions } from '../shared/LeadQuickActions';
import { PRIORITY_BADGE_VARIANT, PRIORITY_LABEL, type LeadListItem } from '@/features/leads/types';

export function PipelineLeadCard({
  lead,
  onKebab,
}: {
  lead: LeadListItem;
  onKebab: (lead: LeadListItem) => void;
}) {
  const initials = (lead.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const subtitle = [lead.interest, lead.preferredCity, lead.budgetRange]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={() => router.push(`/leads/${lead.id}`)}
      style={({ pressed }) => pressed && { opacity: 0.9 }}
      className="mb-3 rounded-3xl border border-border bg-card p-4"
    >
      <View className="flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-brand/10">
          <Text className="text-base font-extrabold text-brand">{initials}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-[15px] font-extrabold text-foreground">{lead.name ?? 'Lead'}</Text>
          {subtitle ? (
            <Text className="mt-0.5 text-xs text-muted-foreground">{subtitle}</Text>
          ) : null}
        </View>
        <Pressable hitSlop={10} onPress={() => onKebab(lead)}>
          <Icon name="more-vertical" size={18} className="text-muted-foreground" />
        </Pressable>
      </View>
      <View className="mt-2.5 flex-row gap-1.5">
        {lead.priority ? (
          <Badge tone={PRIORITY_BADGE_VARIANT[lead.priority]}>
            {PRIORITY_LABEL[lead.priority]}
          </Badge>
        ) : null}
        {lead.externalSource ? <Badge tone="mutedSoft">{lead.externalSource}</Badge> : null}
      </View>
      <LeadQuickActions lead={lead} />
    </Pressable>
  );
}
```

> Match the `Badge` API (`tone` / `variant` and children) to the existing `Badge` atom — adjust prop names if the project differs.

- [ ] **Step 2: Pipeline column**

Create `src/features/leads/components/dashboard/pipeline/PipelineColumn.tsx`:

```tsx
import { ActivityIndicator, FlatList, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { useBoardLeads } from '@/features/leads/hooks/use-board-leads';
import {
  STATUS_LABEL,
  type LeadListItem,
  type LeadStatus,
  type LeadsQuery,
} from '@/features/leads/types';
import { PipelineLeadCard } from './PipelineLeadCard';

export function PipelineColumn({
  status,
  query,
  width,
  enabled,
  onKebab,
}: {
  status: LeadStatus;
  query: Partial<LeadsQuery>;
  width: number;
  enabled: boolean;
  onKebab: (lead: LeadListItem) => void;
}) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useBoardLeads(status, query, enabled);
  const leads = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  return (
    <View style={{ width }} className="px-1">
      <View className="flex-row items-center justify-between px-1 pb-3">
        <Text className="text-base font-extrabold text-foreground">{STATUS_LABEL[status]}</Text>
        <View className="rounded-full bg-brand/10 px-2.5 py-0.5">
          <Text className="text-xs font-extrabold text-brand">{total} leads</Text>
        </View>
      </View>
      {isLoading ? (
        <View className="items-center py-10">
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(l) => l.id}
          renderItem={({ item }) => <PipelineLeadCard lead={item} onKebab={onKebab} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onRefresh={refetch}
          refreshing={false}
          ListEmptyComponent={
            <Text className="py-10 text-center text-sm text-muted-foreground">
              No leads in {STATUS_LABEL[status]}
            </Text>
          }
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator className="my-4" /> : null}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      )}
    </View>
  );
}
```

- [ ] **Step 3: Pipeline view (paged horizontal FlatList + stage strip)**

Create `src/features/leads/components/dashboard/pipeline/PipelineView.tsx`:

```tsx
import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, useWindowDimensions, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import {
  useDashboardFilterStore,
  selectDashboardLeadsQuery,
} from '@/features/leads/store/dashboard-filter.store';
import { BOARD_STAGE_ORDER } from '@/features/leads/constants/board';
import { STATUS_LABEL, type LeadListItem, type LeadStatus } from '@/features/leads/types';
import { PipelineColumn } from './PipelineColumn';

export function PipelineView({
  initialStage,
  onKebab,
}: {
  initialStage?: LeadStatus;
  onKebab: (lead: LeadListItem) => void;
}) {
  const { width } = useWindowDimensions();
  const startIndex = Math.max(0, initialStage ? BOARD_STAGE_ORDER.indexOf(initialStage) : 0);
  const [active, setActive] = useState(startIndex);
  const listRef = useRef<FlatList>(null);
  const query = useDashboardFilterStore(selectDashboardLeadsQuery);
  const stages = BOARD_STAGE_ORDER;

  const goTo = (i: number) => {
    setActive(i);
    listRef.current?.scrollToIndex({ index: i, animated: true });
  };

  const data = useMemo(() => stages, [stages]);

  return (
    <View className="flex-1">
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={stages}
        keyExtractor={(s) => `tab-${s}`}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 10 }}
        renderItem={({ item, index }) => (
          <Pressable onPress={() => goTo(index)} className="mr-4">
            <Text
              className={
                index === active
                  ? 'text-sm font-extrabold text-brand'
                  : 'text-sm font-bold text-muted-foreground'
              }
            >
              {STATUS_LABEL[item]}
            </Text>
          </Pressable>
        )}
      />
      <FlatList
        ref={listRef}
        data={data}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={startIndex}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        keyExtractor={(s) => `col-${s}`}
        onMomentumScrollEnd={(e) => setActive(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index }) => (
          <PipelineColumn
            status={item}
            query={query}
            width={width}
            enabled={Math.abs(index - active) <= 1}
            onKebab={onKebab}
          />
        )}
      />
    </View>
  );
}
```

> `enabled={Math.abs(index - active) <= 1}` mounts only current ± neighbor columns' queries (spec §9). `getItemLayout` lets `initialScrollIndex` work.

- [ ] **Step 4: Verify**

Run: `pnpm tsc --noEmit` — Expected: clean.
Run: `pnpm lint` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/leads/components/dashboard/pipeline/
git commit -m "feat(leads): pipeline swipe-column board"
```

---

## Task 8: List sub-view

**Files:**

- Create: `src/features/leads/components/dashboard/list/ListView.tsx`

**Interfaces:**

- Consumes: `useAllLeadsInfinite` (existing), filter store (Task 3), badges.
- Produces: `ListView` (`onKebab`).

- [ ] **Step 1: List view**

Create `src/features/leads/components/dashboard/list/ListView.tsx`. Reuse the existing infinite hook `useAllLeadsInfinite` (from `src/features/leads/hooks/use-all-leads.ts`) and feed it the dashboard filter query:

```tsx
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Text } from '@/components/atoms/Text';
import { Badge } from '@/components/atoms/Badge';
import { useAllLeadsInfinite } from '@/features/leads/hooks/use-all-leads';
import {
  useDashboardFilterStore,
  selectDashboardLeadsQuery,
} from '@/features/leads/store/dashboard-filter.store';
import {
  PRIORITY_BADGE_VARIANT,
  PRIORITY_LABEL,
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
  type LeadListItem,
} from '@/features/leads/types';

export function ListView({ onKebab }: { onKebab: (lead: LeadListItem) => void }) {
  const query = useDashboardFilterStore(selectDashboardLeadsQuery);
  const stageFilter = useDashboardFilterStore((s) => s.stageFilter);
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useAllLeadsInfinite({ ...query, ...(stageFilter ? { status: stageFilter } : {}) });
  const leads = data?.pages.flatMap((p) => p.items) ?? [];

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <ActivityIndicator />
      </View>
    );
  }
  return (
    <FlatList
      data={leads}
      keyExtractor={(l) => l.id}
      className="flex-1 px-4"
      onEndReachedThreshold={0.4}
      onEndReached={() => hasNextPage && fetchNextPage()}
      onRefresh={refetch}
      refreshing={false}
      ListEmptyComponent={
        <Text className="py-16 text-center text-sm text-muted-foreground">No leads found.</Text>
      }
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator className="my-4" /> : null}
      contentContainerStyle={{ paddingBottom: 120 }}
      renderItem={({ item }) => {
        const initials = (item.name ?? '?')
          .split(' ')
          .map((p) => p[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();
        return (
          <Pressable
            onPress={() => router.push(`/leads/${item.id}`)}
            onLongPress={() => onKebab(item)}
            style={({ pressed }) => pressed && { opacity: 0.9 }}
            className="mb-2.5 flex-row items-center gap-3 rounded-2xl border border-border bg-card p-3.5"
          >
            <View className="h-11 w-11 items-center justify-center rounded-full bg-brand/10">
              <Text className="text-base font-extrabold text-brand">{initials}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-extrabold text-foreground">
                {item.name ?? 'Lead'}
              </Text>
              <Text className="mt-0.5 text-xs text-muted-foreground">
                {[item.interest, item.preferredCity, item.externalSource]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <View className="items-end gap-1.5">
              {item.priority ? (
                <Badge tone={PRIORITY_BADGE_VARIANT[item.priority]}>
                  {PRIORITY_LABEL[item.priority]}
                </Badge>
              ) : null}
              <Badge tone={STATUS_BADGE_VARIANT[item.status]}>{STATUS_LABEL[item.status]}</Badge>
            </View>
          </Pressable>
        );
      }}
    />
  );
}
```

> Confirm `useAllLeadsInfinite` accepts the extended query (Task 1 widened `LeadsQuery`). If its `AllLeadsParams` type omits new fields, widen it to `Omit<LeadsQuery, 'page' | 'limit'>` (it already is per the exploration report).

- [ ] **Step 2: Verify**

Run: `pnpm tsc --noEmit` — Expected: clean.
Run: `pnpm lint` — Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/leads/components/dashboard/list/
git commit -m "feat(leads): list sub-view"
```

---

## Task 9: Filter sheet

**Files:**

- Create: `src/features/leads/components/dashboard/filters/LeadsFilterSheet.tsx`

**Interfaces:**

- Consumes: filter store (Task 3), `useAgentsList` (Task 4), board constants, atoms.
- Produces: `LeadsFilterSheet` (`visible`, `onClose`).

- [ ] **Step 1: Filter sheet**

Create `src/features/leads/components/dashboard/filters/LeadsFilterSheet.tsx`:

```tsx
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import {
  useDashboardFilterStore,
  type AssignmentFilter,
} from '@/features/leads/store/dashboard-filter.store';
import { useAgentsList } from '@/features/leads/hooks/use-agents-list';
import { BOARD_STAGE_ORDER } from '@/features/leads/constants/board';
import {
  PRIORITY_FILTERS,
  PRIORITY_LABEL,
  STATUS_LABEL,
  type LeadStatus,
} from '@/features/leads/types';
import { cn } from '@/lib/utils';

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => pressed && { opacity: 0.85 }}
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

export function LeadsFilterSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = useDashboardFilterStore();
  const { data: agents } = useAgentsList();

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="max-h-[85%] rounded-t-3xl bg-card p-5">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-extrabold text-foreground">Filters</Text>
            <Pressable onPress={() => s.clearAll()}>
              <Text className="text-sm font-bold text-brand">Clear all</Text>
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text className="mb-2 mt-2 text-xs font-extrabold uppercase text-muted-foreground">
              Assignment
            </Text>
            <View className="flex-row flex-wrap">
              {(['any', 'assigned', 'unassigned'] as AssignmentFilter[]).map((a) => (
                <Chip
                  key={a}
                  label={a[0].toUpperCase() + a.slice(1)}
                  active={s.assignment === a}
                  onPress={() => s.setAssignment(a)}
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
                  active={s.priority === p}
                  onPress={() => s.setPriority(s.priority === p ? null : p)}
                />
              ))}
            </View>

            <Text className="mb-2 mt-3 text-xs font-extrabold uppercase text-muted-foreground">
              Stage
            </Text>
            <View className="flex-row flex-wrap">
              {BOARD_STAGE_ORDER.map((st: LeadStatus) => (
                <Chip
                  key={st}
                  label={STATUS_LABEL[st]}
                  active={s.stageFilter === st}
                  onPress={() => s.setStageFilter(s.stageFilter === st ? null : st)}
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
                    active={s.assigneeId === a.id}
                    onPress={() => s.setAssigneeId(s.assigneeId === a.id ? null : a.id)}
                  />
                );
              })}
            </View>

            <Text className="mb-2 mt-3 text-xs font-extrabold uppercase text-muted-foreground">
              Portal source
            </Text>
            <View className="flex-row flex-wrap">
              {(['property_finder', 'bayut', 'dubizzle'] as const).map((p) => (
                <Chip
                  key={p}
                  label={p.replace('_', ' ')}
                  active={s.portalSource === p}
                  onPress={() => s.setPortalSource(s.portalSource === p ? null : p)}
                />
              ))}
            </View>

            <Text className="mb-2 mt-3 text-xs font-extrabold uppercase text-muted-foreground">
              Call outcome
            </Text>
            <View className="flex-row flex-wrap">
              {(['connected', 'missed', 'with_recording'] as const).map((c) => (
                <Chip
                  key={c}
                  label={c.replace('_', ' ')}
                  active={s.callOutcome === c}
                  onPress={() => s.setCallOutcome(s.callOutcome === c ? null : c)}
                />
              ))}
            </View>
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => pressed && { opacity: 0.9 }}
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

> Date range is intentionally left to a follow-up if the project lacks a range picker; the `DateRangePicker`/`DatePicker` atom can be wired here later. All other web filters are covered.

- [ ] **Step 2: Verify**

Run: `pnpm tsc --noEmit` — Expected: clean.
Run: `pnpm lint` — Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/leads/components/dashboard/filters/
git commit -m "feat(leads): dashboard filter sheet"
```

---

## Task 10: Mutation sheets (assign, status, viewing, note)

**Files:**

- Create: `src/features/leads/components/dashboard/sheets/AssignAgentSheet.tsx`
- Create: `src/features/leads/components/dashboard/sheets/StatusChangeSheet.tsx`
- Create: `src/features/leads/components/dashboard/sheets/ViewingSchedulerSheet.tsx`
- Create: `src/features/leads/components/dashboard/sheets/AddNoteSheet.tsx`

**Interfaces:**

- Consumes: mutation hooks (Task 4), `useAgentsList`, board constants, atoms.
- Produces: four sheet components, each `{ leadId, visible, onClose }` (Viewing also surfaces from Status when target is `Viewing_Scheduled`).

- [ ] **Step 1: Assign agent sheet**

Create `src/features/leads/components/dashboard/sheets/AssignAgentSheet.tsx`:

```tsx
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { useAgentsList } from '@/features/leads/hooks/use-agents-list';
import { useAssignLead } from '@/features/leads/hooks/use-lead-mutations';

export function AssignAgentSheet({
  leadId,
  visible,
  onClose,
}: {
  leadId: string | null;
  visible: boolean;
  onClose: () => void;
}) {
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

- [ ] **Step 2: Status change sheet (escalates to viewing)**

Create `src/features/leads/components/dashboard/sheets/StatusChangeSheet.tsx`:

```tsx
import { Modal, Pressable, ScrollView } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { useUpdateLeadStatus } from '@/features/leads/hooks/use-lead-mutations';
import { BOARD_STAGE_ORDER } from '@/features/leads/constants/board';
import { STATUS_LABEL, type LeadStatus } from '@/features/leads/types';

export function StatusChangeSheet({
  leadId,
  visible,
  onClose,
  onNeedViewing,
}: {
  leadId: string | null;
  visible: boolean;
  onClose: () => void;
  onNeedViewing: (leadId: string) => void;
}) {
  const update = useUpdateLeadStatus();
  if (!leadId) return null;
  const pick = (status: LeadStatus) => {
    if (status === 'Viewing_Scheduled') {
      onClose();
      onNeedViewing(leadId);
      return;
    }
    update.mutate({ id: leadId, status }, { onSuccess: onClose });
  };
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

- [ ] **Step 3: Viewing scheduler sheet**

Create `src/features/leads/components/dashboard/sheets/ViewingSchedulerSheet.tsx`:

```tsx
import { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { useCreateViewing } from '@/features/leads/hooks/use-lead-mutations';
import type { ViewingPropertyType } from '@/features/leads/types';
import { cn } from '@/lib/utils';

const TYPES: ViewingPropertyType[] = ['sale', 'rent', 'new_project'];

export function ViewingSchedulerSheet({
  leadId,
  visible,
  onClose,
}: {
  leadId: string | null;
  visible: boolean;
  onClose: () => void;
}) {
  const create = useCreateViewing();
  const [viewingDate, setDate] = useState('');
  const [startTime, setStart] = useState('');
  const [endTime, setEnd] = useState('');
  const [propertyType, setType] = useState<ViewingPropertyType>('sale');
  const [remarks, setRemarks] = useState('');

  if (!leadId) return null;
  const valid = viewingDate && startTime && endTime && remarks;
  const submit = () =>
    create.mutate(
      {
        leadId,
        payload: {
          viewingDate,
          startTime,
          endTime,
          propertyType,
          remarks,
          setStatusToViewing: true,
          ...(propertyType === 'new_project' ? { projects: [] } : { listings: [] }),
        },
      },
      { onSuccess: onClose },
    );

  const Field = (p: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
  }) => (
    <View className="mb-3">
      <Text className="mb-1.5 text-xs font-bold text-muted-foreground">{p.label}</Text>
      <TextInput
        value={p.value}
        onChangeText={p.onChange}
        placeholder={p.placeholder}
        className="rounded-xl border border-border bg-card px-3.5 py-3 text-foreground"
      />
    </View>
  );

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="max-h-[88%] rounded-t-3xl bg-card p-5">
          <Text className="mb-3 text-lg font-extrabold text-foreground">Schedule viewing</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Field
              label="Date (YYYY-MM-DD)"
              value={viewingDate}
              onChange={setDate}
              placeholder="2026-06-20"
            />
            <Field
              label="Start (HH:mm)"
              value={startTime}
              onChange={setStart}
              placeholder="14:00"
            />
            <Field label="End (HH:mm)" value={endTime} onChange={setEnd} placeholder="14:30" />
            <Text className="mb-1.5 text-xs font-bold text-muted-foreground">Type</Text>
            <View className="mb-3 flex-row gap-2">
              {TYPES.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
                  className={cn(
                    'rounded-full border px-3.5 py-2',
                    propertyType === t ? 'border-brand bg-brand' : 'border-border',
                  )}
                >
                  <Text
                    className={cn(
                      'text-xs font-bold',
                      propertyType === t ? 'text-brand-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {t.replace('_', ' ')}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Field
              label="Remarks"
              value={remarks}
              onChange={setRemarks}
              placeholder="Notes for the viewing"
            />
          </ScrollView>
          <Pressable
            disabled={!valid || create.isPending}
            onPress={submit}
            className={cn('mt-3 items-center rounded-2xl py-3.5', valid ? 'bg-brand' : 'bg-muted')}
          >
            <Text className="text-base font-extrabold text-brand-foreground">Save viewing</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
```

> Project/listing pickers for `new_project`/sale/rent are sent empty here (backend requires the arrays to exist; empty is the minimal valid payload for the v1 quick-schedule). A follow-up can add real pickers. Replace the plain `TextInput` date/time fields with the project's `DatePicker` atom if a cleaner UX is wanted.

- [ ] **Step 4: Add note sheet**

Create `src/features/leads/components/dashboard/sheets/AddNoteSheet.tsx`:

```tsx
import { useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { useCreateLeadNote } from '@/features/leads/hooks/use-lead-notes';
import { cn } from '@/lib/utils';

export function AddNoteSheet({
  leadId,
  visible,
  onClose,
}: {
  leadId: string | null;
  visible: boolean;
  onClose: () => void;
}) {
  const [content, setContent] = useState('');
  const create = useCreateLeadNote(leadId ?? '');
  if (!leadId) return null;
  const submit = () =>
    create.mutate(content.trim(), {
      onSuccess: () => {
        setContent('');
        onClose();
      },
    });
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-3xl bg-card p-5 pb-8">
          <Text className="mb-3 text-lg font-extrabold text-foreground">Add note</Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            multiline
            placeholder="Write a note…"
            className="min-h-[100px] rounded-xl border border-border bg-card px-3.5 py-3 text-foreground"
            textAlignVertical="top"
          />
          <Pressable
            disabled={!content.trim() || create.isPending}
            onPress={submit}
            className={cn(
              'mt-4 items-center rounded-2xl py-3.5',
              content.trim() ? 'bg-brand' : 'bg-muted',
            )}
          >
            <Text className="text-base font-extrabold text-brand-foreground">Save note</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 5: Verify**

Run: `pnpm tsc --noEmit` — Expected: clean.
Run: `pnpm lint` — Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/features/leads/components/dashboard/sheets/
git commit -m "feat(leads): assign/status/viewing/note mutation sheets"
```

---

## Task 11: Dashboard screen (compose everything)

**Files:**

- Create: `src/features/leads/components/dashboard/LeadsDashboardScreen.tsx`

**Interfaces:**

- Consumes: all of Tasks 5–10, `useLeadPermissions`/`useCan` for FAB, filter store, `useSearchDebounceSync`-style debounce.
- Produces: `LeadsDashboardScreen` (`initialView?: DashboardView`).

- [ ] **Step 1: Compose the screen**

Create `src/features/leads/components/dashboard/LeadsDashboardScreen.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Text } from '@/components/atoms/Text';
import { Icon } from '@/components/atoms/Icon';
import { useCan } from '@/lib/rbac/use-can';
import { PERMISSIONS } from '@/lib/rbac/permissions';
import {
  useDashboardFilterStore,
  selectDashboardFilterCount,
} from '@/features/leads/store/dashboard-filter.store';
import type { LeadListItem, LeadStatus } from '@/features/leads/types';
import { LeadsSegmentedControl, type DashboardView } from './LeadsSegmentedControl';
import { OverviewView } from './overview/OverviewView';
import { PipelineView } from './pipeline/PipelineView';
import { ListView } from './list/ListView';
import { LeadsFilterSheet } from './filters/LeadsFilterSheet';
import { LeadActionSheet } from './shared/LeadActionSheet';
import { AssignAgentSheet } from './sheets/AssignAgentSheet';
import { StatusChangeSheet } from './sheets/StatusChangeSheet';
import { ViewingSchedulerSheet } from './sheets/ViewingSchedulerSheet';
import { AddNoteSheet } from './sheets/AddNoteSheet';

const MAIN_HEADER_HEIGHT = 64;

export function LeadsDashboardScreen({
  initialView = 'overview',
  reserveMainHeaderSpace = true,
}: {
  initialView?: DashboardView;
  reserveMainHeaderSpace?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<DashboardView>(initialView);
  const [initialStage, setInitialStage] = useState<LeadStatus | undefined>(undefined);
  const canCreate = useCan(PERMISSIONS.LEADS_CREATE);

  const filterCount = useDashboardFilterStore(selectDashboardFilterCount);
  const searchInput = useDashboardFilterStore((s) => s.searchInput);
  const setSearchInput = useDashboardFilterStore((s) => s.setSearchInput);
  const setDebouncedSearch = useDashboardFilterStore((s) => s.setDebouncedSearch);

  // debounce search (matches existing 300ms convention)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput, setDebouncedSearch]);

  // sheet orchestration
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionLead, setActionLead] = useState<LeadListItem | null>(null);
  const [assignLeadId, setAssignLeadId] = useState<string | null>(null);
  const [statusLeadId, setStatusLeadId] = useState<string | null>(null);
  const [viewingLeadId, setViewingLeadId] = useState<string | null>(null);
  const [noteLeadId, setNoteLeadId] = useState<string | null>(null);

  const openKebab = (lead: LeadListItem) => setActionLead(lead);

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top + (reserveMainHeaderSpace ? MAIN_HEADER_HEIGHT : 0) }}
    >
      <View className="flex-row items-center justify-between px-5 pb-2 pt-1">
        <View>
          <Text className="text-2xl font-extrabold text-foreground">Leads</Text>
        </View>
        <Pressable
          onPress={() => setFiltersOpen(true)}
          className="flex-row items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2"
        >
          <Icon name="sliders-horizontal" size={15} className="text-foreground" />
          <Text className="text-xs font-bold text-foreground">
            Filters{filterCount ? ` (${filterCount})` : ''}
          </Text>
        </Pressable>
      </View>

      <LeadsSegmentedControl value={view} onChange={setView} />

      <View className="flex-1">
        {view === 'overview' && (
          <OverviewView
            onOpenStage={(s) => {
              setInitialStage(s);
              setView('pipeline');
            }}
          />
        )}
        {view === 'pipeline' && <PipelineView initialStage={initialStage} onKebab={openKebab} />}
        {view === 'list' && <ListView onKebab={openKebab} />}
      </View>

      {canCreate ? (
        <Pressable
          onPress={() => router.push('/leads/create')}
          className="absolute h-14 w-14 items-center justify-center rounded-full bg-brand"
          style={{ right: 22, bottom: insets.bottom + 22 }}
        >
          <Icon name="plus" size={28} className="text-brand-foreground" />
        </Pressable>
      ) : null}

      <LeadsFilterSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} />
      <LeadActionSheet
        lead={actionLead}
        visible={!!actionLead}
        onClose={() => setActionLead(null)}
        onMoveStage={(l) => setStatusLeadId(l.id)}
        onAssign={(l) => setAssignLeadId(l.id)}
        onAddNote={(l) => setNoteLeadId(l.id)}
      />
      <AssignAgentSheet
        leadId={assignLeadId}
        visible={!!assignLeadId}
        onClose={() => setAssignLeadId(null)}
      />
      <StatusChangeSheet
        leadId={statusLeadId}
        visible={!!statusLeadId}
        onClose={() => setStatusLeadId(null)}
        onNeedViewing={(id) => setViewingLeadId(id)}
      />
      <ViewingSchedulerSheet
        leadId={viewingLeadId}
        visible={!!viewingLeadId}
        onClose={() => setViewingLeadId(null)}
      />
      <AddNoteSheet
        leadId={noteLeadId}
        visible={!!noteLeadId}
        onClose={() => setNoteLeadId(null)}
      />
    </View>
  );
}
```

> Verify import paths for `useCan`, `PERMISSIONS`, `useSafeAreaInsets`, `Icon` against the repo. The header here is minimal; if the global `MainHeader` overlay already renders the greeting/notifications, keep `reserveMainHeaderSpace` true so content sits below it (matches existing `AllLeadsScreen`).

- [ ] **Step 2: Search input wiring (optional inline search bar)**

Each sub-view that needs a visible search box reads `searchInput`/`setSearchInput` from the store. For v1 the List and Pipeline can show a search `TextInput` bound to the store at the top of their container; reuse the existing search bar component from `AllLeadsList` if present. (Overview has no search.) If adding inline, bind:

```tsx
// inside ListView / PipelineView header
import { useDashboardFilterStore } from '@/features/leads/store/dashboard-filter.store';
const search = useDashboardFilterStore((s) => s.searchInput);
const setSearch = useDashboardFilterStore((s) => s.setSearchInput);
// <TextInput value={search} onChangeText={setSearch} placeholder="Search name, phone, email" .../>
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc --noEmit` — Expected: clean.
Run: `pnpm lint` — Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/features/leads/components/dashboard/LeadsDashboardScreen.tsx
git commit -m "feat(leads): compose dashboard screen with sheet orchestration"
```

---

## Task 12: Wire mount points

**Files:**

- Modify: `app/(public)/index.tsx`
- Modify: `app/(app)/leads/index.tsx`

**Interfaces:**

- Consumes: `LeadsDashboardScreen` (Task 11).

- [ ] **Step 1: Agent home**

In `app/(public)/index.tsx`, replace the `LeadsScreen` render for authenticated non-customers with `LeadsDashboardScreen`. Keep the existing auth/customer branching; only swap the agent component:

```tsx
// import { LeadsScreen } from '@/features/leads/components/LeadsScreen';
import { LeadsDashboardScreen } from '@/features/leads/components/dashboard/LeadsDashboardScreen';

// inside the component, where it returned <LeadsScreen />:
if (isAuthenticated && !isCustomer) return <LeadsDashboardScreen />;
```

- [ ] **Step 2: Leads tab**

In `app/(app)/leads/index.tsx`, keep the existing `useRequirePermission([LEADS_READ, LEADS_READ_ALL])` gate and replace `<AllLeadsScreen reserveMainHeaderSpace />` with:

```tsx
import { LeadsDashboardScreen } from '@/features/leads/components/dashboard/LeadsDashboardScreen';
// ...
// after the permission gate returns 'granted':
return <LeadsDashboardScreen />;
```

Read the file first to preserve its exact gate/redirect structure; change only the rendered screen.

- [ ] **Step 3: Verify (typecheck + lint)**

Run: `pnpm tsc --noEmit` — Expected: clean.
Run: `pnpm lint` — Expected: clean.

- [ ] **Step 4: Manual QA on simulator/device**

Run the app (`pnpm ios` or `pnpm android` or `pnpm start`). Verify:

- Agent lands on Leads dashboard with **Overview** active: KPI grid, Today's Priorities carousel, pipeline summary (incl. "Other" group) all render with live data.
- Segmented control switches Overview / Pipeline / List; filter state persists across switches.
- **Pipeline**: swipe between stage columns; counts show; infinite scroll loads more; tap card → detail; kebab → action sheet.
- Action sheet → Move stage (changes column after refetch), Assign (agent list → reassign), Add note (saves).
- Move to **Viewing** opens the viewing scheduler; saving creates the viewing and moves the lead.
- **List**: search filters results; stage/priority badges show; tap → detail; long-press → action sheet.
- **Filters** sheet: assignment/priority/stage/assignee/portal/call-outcome apply across all sub-views; "Clear all" resets; chip badge shows active count.
- FAB visible only with `leads:create`; opens create screen.
- Contact masking: as a non-admin, phone/email masked and Call/WhatsApp hidden appropriately.
- Pull-to-refresh on columns/list refetches.

- [ ] **Step 5: Commit**

```bash
git add "app/(public)/index.tsx" "app/(app)/leads/index.tsx"
git commit -m "feat(leads): mount leads dashboard as agent home and leads tab"
```

---

## Self-Review Notes (coverage map)

- Spec §1 three views → Tasks 6 (Overview), 7 (Pipeline), 8 (List), 11 (compose).
- Spec §2 routing/permissions → Task 12 + FAB gate in Task 11.
- Spec §3 data layer → Tasks 1 (types), 2 (services), 4 (hooks).
- Spec §4 components → Tasks 5–11 (every named component has a task).
- Spec §5 filter state/search → Task 3 (store) + Task 11 (debounce) + Task 9 (sheet).
- Spec §6 behavior/errors/masking → loading/empty/error states in Tasks 6–8; masking via `useLeadPermissions` in Task 5; pull-to-refresh in Tasks 7–8.
- Spec §7 scope → out-of-scope items (PF sync, bulk, drag, full notes thread) deliberately omitted.
- Spec §8 verification → tsc + lint each task; manual QA checklist Task 12.
- Spec §9 open questions → Task 2 Step 1 (list response shape) + Task 7 Step 3 (neighbor-only column mounting).

```

```
