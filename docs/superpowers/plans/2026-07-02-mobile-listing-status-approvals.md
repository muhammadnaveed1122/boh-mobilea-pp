# Mobile Listing-Status Approvals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mobile-native Approvals inbox (hub → listing-status queue → audit/detail with Approve / Request-changes) at full parity with the web `/my-account/approvals/listings-status` page.

**Architecture:** New `src/features/approvals/` feature module (models, constants, axios services, TanStack Query hooks, components) plus nested Expo Router routes under `app/(app)/approvals/`. A catalogue (`constants/queues.ts`) drives a hub of queue cards; only `listings-status` is active. Server state via TanStack Query; client filter/tab state via local `useState`. Reuses existing atoms (Button, Badge, Input, Text, Icon, Tabs, Skeleton, EmptyState) and the `@gorhom/bottom-sheet` select pattern.

**Tech Stack:** React Native 0.81, Expo SDK 54, Expo Router (typed routes), NativeWind v4, TanStack Query v5, axios (`apiClient`), `@gorhom/bottom-sheet` v5, `lucide-react-native`.

## Global Constraints

- **No test runner** (repo policy). Verify every task with `npx tsc --noEmit` (clean) + `pnpm lint` (clean) + the task's manual-QA note. No `*.test.*` files.
- **Styling:** NativeWind semantic tokens only (`bg-background`, `text-foreground`, `text-muted-foreground`, `text-destructive`, `border-border`, `border-input`, `bg-muted`, `bg-brand`, `text-brand`…). No hard-coded hex. No `dark:`-only logic beyond what atoms already do.
- **Prop types:** `Readonly<{...}>`. Strict TS. Merge classes with `cn()` from `@/lib/utils`.
- **HTTP:** Always through `apiClient` from `@/lib/api`; its response interceptor already unwraps the `{ success, data }` envelope, so `const { data } = await apiClient.get(...)` gives the payload directly. All paths prefixed `/api/v1`.
- **Icons:** via `Icon` atom (`name` = a `lucide-react-native/icons` key) or direct `lucide-react-native` imports (as existing code does). `SealCheck` does NOT exist in lucide — use `BadgeCheck`.
- **Path aliases:** `@/*` → `src/*`, `@theme` → `theme`.
- **No new runtime dependencies.**
- **Commits:** end message body with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## File Structure

```
src/lib/rbac/permissions.ts                         (modify) add APPROVALS_ACT
src/features/more/components/MoreSheet.tsx           (modify) add Approvals row

app/(app)/approvals/index.tsx                        (create) re-export ApprovalsHubScreen
app/(app)/approvals/[queue]/index.tsx                (create) re-export ApprovalsQueueScreen
app/(app)/approvals/[queue]/[id].tsx                 (create) re-export ApprovalDetailScreen

src/features/approvals/models/approval.ts            (create) DTOs + asUpdateSnapshot
src/features/approvals/constants/queues.ts           (create) APPROVAL_QUEUES + getQueueDef
src/features/approvals/services.ts                   (create) axios calls + normalizers
src/features/approvals/hooks/use-approvals-queue.ts  (create) infinite list + tab + filters
src/features/approvals/hooks/use-approval-detail.ts  (create) detail query + mutations
src/features/approvals/hooks/use-approvers.ts        (create) approver options
src/features/approvals/hooks/use-agent-search.ts     (create) debounced agent options
src/features/approvals/components/ApprovalStatusBadge.tsx
src/features/approvals/components/ApprovalsHubScreen.tsx
src/features/approvals/components/QueueCard.tsx
src/features/approvals/components/ApprovalRequestCard.tsx
src/features/approvals/components/QueueFilters.tsx
src/features/approvals/components/ApprovalsQueueScreen.tsx
src/features/approvals/components/ApprovalChainPanel.tsx
src/features/approvals/components/ApprovalDetailScreen.tsx
src/features/approvals/components/RequestChangesSheet.tsx
src/features/approvals/index.ts                      (create) public exports
```

---

### Task 1: Models, queue catalogue, RBAC permission

**Files:**

- Create: `src/features/approvals/models/approval.ts`
- Create: `src/features/approvals/constants/queues.ts`
- Modify: `src/lib/rbac/permissions.ts`

**Interfaces:**

- Produces types consumed by every later task: `ApprovalQueueSlug`, `ApprovalRequestStatus`, `ApprovalStepStatus`, `ApprovalDecision`, `ApprovalEventType`, `ApprovalStepApprover`, `ApprovalStep`, `ApprovalEvent`, `ListingFieldChange`, `ListingUpdateSnapshot`, `ListingPreview`, `ApprovalRequestListItem`, `ApprovalRequestDetail`, `ApprovalQueueResponse`, `ApprovalQueueParams`, `asUpdateSnapshot(snapshot): ListingUpdateSnapshot | null`.
- Produces `APPROVAL_QUEUES: readonly ApprovalQueueDef[]`, `getQueueDef(slug: string): ApprovalQueueDef | undefined`, `ApprovalQueueDef { slug, label, title, subtitle, variant, deferred }`.
- Produces `PERMISSIONS.APPROVALS_ACT === 'approvals:act'`.

- [ ] **Step 1: Create the models file**

`src/features/approvals/models/approval.ts`:

```ts
/** Approval-request domain types (mirror the backend DTOs the web app consumes). */

export type ApprovalRequestStatus = 'pending' | 'approved' | 'changes_requested';
export type ApprovalStepStatus = 'upcoming' | 'pending' | 'approved' | 'changes_requested';
export type ApprovalDecision = 'approved' | 'changes_requested';
export type ApprovalEventType =
  | 'submitted'
  | 'approved'
  | 'changes_requested'
  | 'resubmitted'
  | 'acknowledged';

/** URL queue segments (kebab) — map 1:1 to backend categories. */
export type ApprovalQueueSlug =
  | 'transactions'
  | 'commission'
  | 'portals'
  | 'listings-status'
  | 'listings-update';

export interface ApprovalStepApprover {
  id: string;
  kind: string;
  userId: string | null;
  roleId: string | null;
  label: string | null;
  decision: ApprovalDecision | null;
  note: string | null;
}

export interface ApprovalStep {
  id: string;
  position: number;
  mode: string;
  status: ApprovalStepStatus;
  isCurrent: boolean;
  approvers: ApprovalStepApprover[];
}

export interface ApprovalEvent {
  id: string;
  type: ApprovalEventType;
  actorId: string | null;
  actorName: string | null;
  note: string | null;
  createdAt: string;
}

/** A single before → after spec-field change on a Listings Update request. */
export interface ListingFieldChange {
  field: string;
  label: string;
  before: string | null;
  after: string | null;
}

/** Snapshot stored for a Listings Update request (rendered as a diff). */
export interface ListingUpdateSnapshot {
  kind: 'update';
  fields: ListingFieldChange[];
}

/** Narrow an unknown request snapshot to the Listings Update diff shape. */
export function asUpdateSnapshot(snapshot: unknown): ListingUpdateSnapshot | null {
  if (
    typeof snapshot === 'object' &&
    snapshot !== null &&
    (snapshot as { kind?: unknown }).kind === 'update' &&
    Array.isArray((snapshot as { fields?: unknown }).fields)
  ) {
    return snapshot as ListingUpdateSnapshot;
  }
  return null;
}

/** Rich listing summary shown on the queue cards (image + key/value grid). */
export interface ListingPreview {
  kind: 'primary' | 'secondary';
  title: string | null;
  imageUrl: string | null;
  price: number | null;
  priceUnit: string | null;
  propertyType: string | null;
  community: string | null;
  area: string | null;
  developer: string | null;
  size: string | null;
  totalFloors: number | null;
  floorLevel: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  agent: string | null;
  permitNumber: string | null;
}

export interface ApprovalRequestListItem {
  id: string;
  category: string;
  status: ApprovalRequestStatus;
  resourceType: string;
  resourceId: string;
  approvalFor: string | null;
  snapshot: unknown;
  submitterId: string;
  submitterName: string | null;
  currentApproverName: string | null;
  submittedAt: string;
  decidedAt: string | null;
  listingPreview: ListingPreview | null;
}

export interface ApprovalRequestDetail extends ApprovalRequestListItem {
  steps: ApprovalStep[];
  history: ApprovalEvent[];
  canAct: boolean;
}

export interface ApprovalQueueCounts {
  pending: number;
  approved: number;
  changes_requested: number;
}

export interface ApprovalQueueResponse {
  items: ApprovalRequestListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts: ApprovalQueueCounts;
}

export interface ApprovalQueueParams {
  queue: ApprovalQueueSlug;
  status?: ApprovalRequestStatus;
  search?: string;
  approverId?: string;
  agentId?: string;
  page?: number;
  limit?: number;
}
```

- [ ] **Step 2: Create the queue catalogue**

`src/features/approvals/constants/queues.ts`:

```ts
import type { ApprovalQueueSlug } from '../models/approval';

/** Approval queue catalogue. `deferred` queues render greyed "Coming soon". */
export interface ApprovalQueueDef {
  readonly slug: ApprovalQueueSlug;
  readonly label: string;
  readonly title: string;
  readonly subtitle: string;
  /** Financial cards vs listing cards. Only `listing` is used this iteration. */
  readonly variant: 'financial' | 'listing';
  /** True when the queue is disabled this iteration ("Coming soon"). */
  readonly deferred: boolean;
}

export const APPROVAL_QUEUES: readonly ApprovalQueueDef[] = [
  {
    slug: 'transactions',
    label: 'Transactions',
    title: 'Transactions Approvals',
    subtitle: 'Deal contracts awaiting sign-off before a transaction can proceed.',
    variant: 'financial',
    deferred: true,
  },
  {
    slug: 'commission',
    label: 'Commission',
    title: 'Commission Approvals',
    subtitle: 'Commission releases awaiting approval.',
    variant: 'financial',
    deferred: true,
  },
  {
    slug: 'portals',
    label: 'Portals',
    title: 'Portals Approvals',
    subtitle: 'Listings awaiting approval to publish to property portals.',
    variant: 'listing',
    deferred: true,
  },
  {
    slug: 'listings-status',
    label: 'Listings Status',
    title: 'Listings Status Approvals',
    subtitle: 'Listing activation / inactivation / archiving awaiting approval.',
    variant: 'listing',
    deferred: false,
  },
  {
    slug: 'listings-update',
    label: 'Listings Update',
    title: 'Listings Update Approvals',
    subtitle: 'Listing field changes awaiting approval before they go live.',
    variant: 'listing',
    deferred: true,
  },
];

export function getQueueDef(slug: string): ApprovalQueueDef | undefined {
  return APPROVAL_QUEUES.find((q) => q.slug === slug);
}
```

- [ ] **Step 3: Add the RBAC permission**

In `src/lib/rbac/permissions.ts`, find the `PERMISSIONS` object and add a line near the other feature permissions (place it after the `OPPORTUNITY_LISTING_*` block around line 107):

```ts
  // Approvals inbox — single permission gates viewing + acting.
  APPROVALS_ACT: 'approvals:act',
```

- [ ] **Step 4: Typecheck**

Run: `cd boh-mobile && npx tsc --noEmit`
Expected: clean (no errors).

- [ ] **Step 5: Lint**

Run: `cd boh-mobile && pnpm lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
cd boh-mobile
git add src/features/approvals/models/approval.ts src/features/approvals/constants/queues.ts src/lib/rbac/permissions.ts
git commit -m "feat(approvals): add models, queue catalogue and approvals:act permission

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Services layer

**Files:**

- Create: `src/features/approvals/services.ts`

**Interfaces:**

- Consumes types from Task 1.
- Produces:
  - `getApprovalQueue(params: ApprovalQueueParams): Promise<ApprovalQueueResponse>`
  - `getApprovalRequest(id: string): Promise<ApprovalRequestDetail>`
  - `approveRequest(id: string, note?: string): Promise<ApprovalRequestDetail>`
  - `requestChangesRequest(id: string, note: string): Promise<ApprovalRequestDetail>`
  - `getApprovalsPendingCount(): Promise<{ count: number; byCategory: Record<string, number> }>`
  - `getApprovers(): Promise<ApproverOption[]>` where `ApproverOption = { value: string; label: string }`
  - `searchAgents(search: string): Promise<ApproverOption[]>`

- [ ] **Step 1: Create the services file**

`src/features/approvals/services.ts`:

```ts
/**
 * Approvals data access. Hits the same NestJS endpoints the web app uses:
 *   GET  /api/v1/approvals/{queue}                 (paginated + per-tab counts)
 *   GET  /api/v1/approvals/request/{id}
 *   POST /api/v1/approvals/request/{id}/approve
 *   POST /api/v1/approvals/request/{id}/request-changes
 *   GET  /api/v1/approvals/pending-count
 *   GET  /api/v1/users/approvers
 *   GET  /api/v1/agents?search=
 * The shared apiClient interceptor unwraps the {success,data} envelope, so the
 * resolved `data` is already the payload.
 */
import { apiClient } from '@/lib/api';

import type {
  ApprovalQueueParams,
  ApprovalQueueResponse,
  ApprovalRequestDetail,
} from './models/approval';

export interface ApproverOption {
  readonly value: string;
  readonly label: string;
}

function buildQueueParams(params: ApprovalQueueParams): Record<string, string | number> {
  const q: Record<string, string | number> = {
    page: params.page ?? 1,
    limit: params.limit ?? 10,
  };
  if (params.status) q.status = params.status;
  if (params.search && params.search.trim() !== '') q.search = params.search.trim();
  if (params.approverId && params.approverId !== '') q.approverId = params.approverId;
  if (params.agentId && params.agentId !== '') q.agentId = params.agentId;
  return q;
}

export async function getApprovalQueue(
  params: ApprovalQueueParams,
): Promise<ApprovalQueueResponse> {
  const { data } = await apiClient.get<ApprovalQueueResponse>(`/api/v1/approvals/${params.queue}`, {
    params: buildQueueParams(params),
  });
  const body = (data ?? {}) as Partial<ApprovalQueueResponse>;
  return {
    items: body.items ?? [],
    total: body.total ?? 0,
    page: body.page ?? 1,
    limit: body.limit ?? 10,
    totalPages: body.totalPages ?? 1,
    counts: body.counts ?? { pending: 0, approved: 0, changes_requested: 0 },
  };
}

export async function getApprovalRequest(id: string): Promise<ApprovalRequestDetail> {
  const { data } = await apiClient.get<ApprovalRequestDetail>(`/api/v1/approvals/request/${id}`);
  return data;
}

export async function approveRequest(id: string, note?: string): Promise<ApprovalRequestDetail> {
  const { data } = await apiClient.post<ApprovalRequestDetail>(
    `/api/v1/approvals/request/${id}/approve`,
    { note },
  );
  return data;
}

export async function requestChangesRequest(
  id: string,
  note: string,
): Promise<ApprovalRequestDetail> {
  const { data } = await apiClient.post<ApprovalRequestDetail>(
    `/api/v1/approvals/request/${id}/request-changes`,
    { note },
  );
  return data;
}

export async function getApprovalsPendingCount(): Promise<{
  count: number;
  byCategory: Record<string, number>;
}> {
  const { data } = await apiClient.get<{ count?: number; byCategory?: Record<string, number> }>(
    '/api/v1/approvals/pending-count',
  );
  return { count: data?.count ?? 0, byCategory: data?.byCategory ?? {} };
}

/** Map an unknown user record to a picker option. */
function toApproverOption(raw: unknown): ApproverOption | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : '';
  if (id === '') return null;
  const first = typeof r.firstName === 'string' ? r.firstName : '';
  const last = typeof r.lastName === 'string' ? r.lastName : '';
  const name =
    typeof r.name === 'string' && r.name.trim() !== ''
      ? r.name
      : `${first} ${last}`.trim() || (typeof r.email === 'string' ? r.email : id);
  return { value: id, label: name };
}

export async function getApprovers(): Promise<ApproverOption[]> {
  const { data } = await apiClient.get<unknown>('/api/v1/users/approvers');
  const list = Array.isArray(data) ? data : ((data as { items?: unknown[] })?.items ?? []);
  return list.map(toApproverOption).filter((o): o is ApproverOption => o !== null);
}

export async function searchAgents(search: string): Promise<ApproverOption[]> {
  const { data } = await apiClient.get<{ items?: unknown[] }>('/api/v1/agents', {
    params: { isActive: true, limit: 50, ...(search.trim() ? { search: search.trim() } : {}) },
  });
  const list = Array.isArray(data) ? data : (data?.items ?? []);
  return list.map(toApproverOption).filter((o): o is ApproverOption => o !== null);
}
```

- [ ] **Step 2: Typecheck** — `cd boh-mobile && npx tsc --noEmit` → clean.
- [ ] **Step 3: Lint** — `cd boh-mobile && pnpm lint` → clean.
- [ ] **Step 4: Commit**

```bash
cd boh-mobile
git add src/features/approvals/services.ts
git commit -m "feat(approvals): add axios services for queue, detail, actions and pickers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Status badge + hub screen + queue card + routing + More row

Delivers the reachable navigation shell: More → hub of 5 cards → (active card is tappable, lands on a placeholder queue route that Task 6 fleshes out). Uses a temporary minimal queue/detail route so typed-routes compile; those files are overwritten in later tasks.

**Files:**

- Create: `src/features/approvals/components/ApprovalStatusBadge.tsx`
- Create: `src/features/approvals/components/QueueCard.tsx`
- Create: `src/features/approvals/components/ApprovalsHubScreen.tsx`
- Create: `src/features/approvals/index.ts`
- Create: `app/(app)/approvals/index.tsx`
- Create: `app/(app)/approvals/[queue]/index.tsx` (temporary body — replaced in Task 6)
- Create: `app/(app)/approvals/[queue]/[id].tsx` (temporary body — replaced in Task 8)
- Modify: `src/features/more/components/MoreSheet.tsx`

**Interfaces:**

- Consumes: `APPROVAL_QUEUES`, `getQueueDef` (Task 1), `ApprovalRequestStatus` (Task 1).
- Produces: `ApprovalStatusBadge({ status })`, `QueueCard({ def, onPress })`, `ApprovalsHubScreen`.

- [ ] **Step 1: Create the status badge**

`src/features/approvals/components/ApprovalStatusBadge.tsx`:

```tsx
import * as React from 'react';

import { Badge } from '@/components/atoms/Badge';
import { Text } from '@/components/atoms/Text';
import type { ApprovalRequestStatus } from '../models/approval';

const STATUS_META: Record<
  ApprovalRequestStatus,
  { label: string; variant: 'warningSoft' | 'successSoft' | 'destructiveSoft' }
> = {
  pending: { label: 'Pending', variant: 'warningSoft' },
  approved: { label: 'Approved', variant: 'successSoft' },
  changes_requested: { label: 'Changes Requested', variant: 'destructiveSoft' },
};

export function ApprovalStatusBadge({ status }: Readonly<{ status: ApprovalRequestStatus }>) {
  const meta = STATUS_META[status];
  return (
    <Badge variant={meta.variant}>
      <Text>{meta.label}</Text>
    </Badge>
  );
}
```

- [ ] **Step 2: Create the queue card**

`src/features/approvals/components/QueueCard.tsx`:

```tsx
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useThemeColor } from '@theme';

import { Badge } from '@/components/atoms/Badge';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import type { ApprovalQueueDef } from '../constants/queues';

export function QueueCard({
  def,
  onPress,
}: Readonly<{ def: ApprovalQueueDef; onPress: () => void }>) {
  const chevron = useThemeColor('--muted-foreground');
  const disabled = def.deferred;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'flex-row items-center gap-3 rounded-2xl border border-border bg-background p-4',
        disabled ? 'opacity-60' : 'active:opacity-70',
      )}
    >
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-base font-semibold text-foreground">{def.label}</Text>
          {disabled ? (
            <Badge variant="mutedSoft">
              <Text>Coming soon</Text>
            </Badge>
          ) : null}
        </View>
        <Text numberOfLines={2} className="mt-1 text-sm text-muted-foreground">
          {def.subtitle}
        </Text>
      </View>
      {!disabled ? <ChevronRight size={18} color={chevron} /> : null}
    </Pressable>
  );
}
```

- [ ] **Step 3: Create the hub screen**

`src/features/approvals/components/ApprovalsHubScreen.tsx`:

```tsx
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { PERMISSIONS, useCan } from '@/lib/rbac';
import { APPROVAL_QUEUES } from '../constants/queues';
import { QueueCard } from './QueueCard';

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
        <Text className="text-xl font-bold text-foreground">Approvals</Text>
      </View>
    </View>
  );
}

export function ApprovalsHubScreen() {
  const insets = useSafeAreaInsets();
  const canApprovals = useCan(PERMISSIONS.APPROVALS_ACT);

  if (!canApprovals) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader />
        <View className="items-center px-8 pt-16">
          <Text className="text-center text-sm text-muted-foreground">
            You don’t have access to approvals.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 12 }}
      >
        <Text className="text-sm text-muted-foreground">
          Review requests awaiting your approval.
        </Text>
        {APPROVAL_QUEUES.map((def) => (
          <QueueCard
            key={def.slug}
            def={def}
            onPress={() =>
              router.push({
                pathname: '/(app)/approvals/[queue]',
                params: { queue: def.slug },
              })
            }
          />
        ))}
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 4: Create the feature barrel**

`src/features/approvals/index.ts`:

```ts
export { ApprovalsHubScreen } from './components/ApprovalsHubScreen';
export { ApprovalsQueueScreen } from './components/ApprovalsQueueScreen';
export { ApprovalDetailScreen } from './components/ApprovalDetailScreen';
```

> Note: `ApprovalsQueueScreen` and `ApprovalDetailScreen` don't exist yet — create them as minimal placeholders now so this barrel and the routes compile; Tasks 6 and 8 replace them.

Create placeholder `src/features/approvals/components/ApprovalsQueueScreen.tsx`:

```tsx
import * as React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/atoms/Text';

export function ApprovalsQueueScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-muted-foreground">Queue coming in Task 6</Text>
    </View>
  );
}
```

Create placeholder `src/features/approvals/components/ApprovalDetailScreen.tsx`:

```tsx
import * as React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/atoms/Text';

export function ApprovalDetailScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-muted-foreground">Detail coming in Task 8</Text>
    </View>
  );
}
```

- [ ] **Step 5: Create the route files**

`app/(app)/approvals/index.tsx`:

```tsx
export { ApprovalsHubScreen as default } from '@/features/approvals';
```

`app/(app)/approvals/[queue]/index.tsx`:

```tsx
export { ApprovalsQueueScreen as default } from '@/features/approvals';
```

`app/(app)/approvals/[queue]/[id].tsx`:

```tsx
export { ApprovalDetailScreen as default } from '@/features/approvals';
```

- [ ] **Step 6: Add the More-sheet row**

In `src/features/more/components/MoreSheet.tsx`:

Add `BadgeCheck` to the existing `lucide-react-native` import:

```tsx
import { Building2, BadgeCheck, ChevronRight, MapPin } from 'lucide-react-native';
```

Add a permission check alongside the existing ones (after `const canProjects = useCan(PERMISSIONS.PROJECTS_READ);`):

```tsx
const canApprovals = useCan(PERMISSIONS.APPROVALS_ACT);
```

Add a row to the `rows` array (after the `areas` row):

```tsx
    {
      key: 'approvals',
      label: 'Approvals',
      icon: BadgeCheck,
      href: '/(app)/approvals',
      visible: canApprovals,
    },
```

- [ ] **Step 7: Typecheck** — `cd boh-mobile && npx tsc --noEmit` → clean.
- [ ] **Step 8: Lint** — `cd boh-mobile && pnpm lint` → clean.
- [ ] **Step 9: Manual QA**

Run `pnpm start`, open the app on a device/simulator with an `approvals:act` account. Tap the More tab → confirm an **Approvals** row appears → tap it → hub shows 5 cards, only **Listings Status** tappable (others greyed "Coming soon") → tapping it lands on the placeholder queue screen. With a non-approver account, the More row is hidden.

- [ ] **Step 10: Commit**

```bash
cd boh-mobile
git add src/features/approvals app/\(app\)/approvals src/features/more/components/MoreSheet.tsx
git commit -m "feat(approvals): hub screen, queue cards, routes and More-tab entry

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Queue data hook

**Files:**

- Create: `src/features/approvals/hooks/use-approvals-queue.ts`

**Interfaces:**

- Consumes: `getApprovalQueue` (Task 2); types from Task 1.
- Produces: `useApprovalsQueue(queue: ApprovalQueueSlug)` returning:
  ```ts
  {
    tab: ApprovalTab;                 // 'Pending' | 'Approved' | 'Changes Requested'
    setTab: (t: ApprovalTab) => void;
    filters: ApprovalsQueueFilters;   // { search; approverId; agentId }
    setFilter: <K extends keyof ApprovalsQueueFilters>(k: K, v: ApprovalsQueueFilters[K]) => void;
    reset: () => void;
    counts: Record<ApprovalTab, number>;
    items: ApprovalRequestListItem[];
    isLoading: boolean;
    isFetchingNextPage: boolean;
    hasNextPage: boolean;
    fetchNextPage: () => void;
    refetch: () => void;
    isError: boolean;
  }
  ```
- Also export types `ApprovalTab` and `ApprovalsQueueFilters`.

- [ ] **Step 1: Create the hook**

`src/features/approvals/hooks/use-approvals-queue.ts`:

```ts
import * as React from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

import { getApprovalQueue } from '../services';
import type {
  ApprovalQueueResponse,
  ApprovalQueueSlug,
  ApprovalRequestStatus,
} from '../models/approval';

export type ApprovalTab = 'Pending' | 'Approved' | 'Changes Requested';

const TAB_TO_STATUS: Record<ApprovalTab, ApprovalRequestStatus> = {
  Pending: 'pending',
  Approved: 'approved',
  'Changes Requested': 'changes_requested',
};

export interface ApprovalsQueueFilters {
  readonly search: string;
  readonly approverId: string;
  readonly agentId: string;
}

const EMPTY_FILTERS: ApprovalsQueueFilters = { search: '', approverId: '', agentId: '' };
const PAGE_LIMIT = 10;

/** Queue state: active tab, filters, paginated data + per-tab counts. */
export function useApprovalsQueue(queue: ApprovalQueueSlug) {
  const [tab, setTab] = React.useState<ApprovalTab>('Pending');
  const [filters, setFilters] = React.useState<ApprovalsQueueFilters>(EMPTY_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = React.useState('');

  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(filters.search), 350);
    return () => clearTimeout(id);
  }, [filters.search]);

  const status = TAB_TO_STATUS[tab];

  const query = useInfiniteQuery<ApprovalQueueResponse, Error>({
    queryKey: [
      'approvals',
      queue,
      status,
      { search: debouncedSearch, approverId: filters.approverId, agentId: filters.agentId },
    ],
    queryFn: ({ pageParam }) =>
      getApprovalQueue({
        queue,
        status,
        search: debouncedSearch,
        approverId: filters.approverId,
        agentId: filters.agentId,
        page: pageParam as number,
        limit: PAGE_LIMIT,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 30_000,
  });

  const items = React.useMemo(
    () => (query.data?.pages ?? []).flatMap((p) => p.items),
    [query.data],
  );

  const firstCounts = query.data?.pages[0]?.counts;
  const counts = React.useMemo<Record<ApprovalTab, number>>(
    () => ({
      Pending: firstCounts?.pending ?? 0,
      Approved: firstCounts?.approved ?? 0,
      'Changes Requested': firstCounts?.changes_requested ?? 0,
    }),
    [firstCounts],
  );

  const setFilter = React.useCallback(
    <K extends keyof ApprovalsQueueFilters>(key: K, value: ApprovalsQueueFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const reset = React.useCallback(() => setFilters(EMPTY_FILTERS), []);

  return {
    tab,
    setTab,
    filters,
    setFilter,
    reset,
    counts,
    items,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
    isError: query.isError,
  };
}
```

- [ ] **Step 2: Typecheck** — `cd boh-mobile && npx tsc --noEmit` → clean.
- [ ] **Step 3: Lint** — `cd boh-mobile && pnpm lint` → clean.
- [ ] **Step 4: Commit**

```bash
cd boh-mobile
git add src/features/approvals/hooks/use-approvals-queue.ts
git commit -m "feat(approvals): infinite queue hook with tabs, filters and counts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Approval request card

**Files:**

- Create: `src/features/approvals/components/ApprovalRequestCard.tsx`

**Interfaces:**

- Consumes: `ApprovalRequestListItem`, `ListingPreview`, `ListingFieldChange`, `asUpdateSnapshot` (Task 1); `ApprovalStatusBadge` (Task 3).
- Produces: `ApprovalRequestCard({ request, onOpenAudit, onOpenListing })` where callbacks are `() => void`.

- [ ] **Step 1: Create the card**

`src/features/approvals/components/ApprovalRequestCard.tsx`:

```tsx
import * as React from 'react';
import { Image, Pressable, View } from 'react-native';
import { ClipboardList, House, SquarePen } from 'lucide-react-native';
import { useThemeColor } from '@theme';

import { Button } from '@/components/atoms/Button';
import { Text } from '@/components/atoms/Text';
import {
  asUpdateSnapshot,
  type ApprovalRequestListItem,
  type ListingFieldChange,
  type ListingPreview,
} from '../models/approval';
import { ApprovalStatusBadge } from './ApprovalStatusBadge';

function snapshotTitle(snapshot: unknown): string {
  if (typeof snapshot === 'object' && snapshot !== null && 'title' in snapshot) {
    const { title } = snapshot as { title?: unknown };
    if (typeof title === 'string' && title !== '') return title;
  }
  return 'Listing';
}

function formatPrice(preview: ListingPreview): string | null {
  if (preview.price === null || preview.price <= 0) return null;
  return preview.price.toLocaleString('en-US');
}

function Field({ label, value }: Readonly<{ label: string; value: string | null }>) {
  if (value === null || value === '') return null;
  return (
    <View className="w-1/2 flex-row gap-2 py-1 pr-2">
      <Text className="w-24 shrink-0 text-xs text-muted-foreground">{label}</Text>
      <Text className="flex-1 text-xs font-medium text-foreground">{value}</Text>
    </View>
  );
}

function ChangedFields({ snapshot }: Readonly<{ snapshot: unknown }>) {
  const diff = asUpdateSnapshot(snapshot);
  if (diff === null || diff.fields.length === 0) return null;
  return (
    <View className="mt-3 border-t border-border pt-3">
      <Text className="mb-2 text-xs font-medium text-muted-foreground">Changed fields</Text>
      <View className="gap-1.5">
        {diff.fields.map((change: ListingFieldChange) => (
          <View
            key={change.field}
            className="flex-row flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md bg-muted px-2.5 py-1.5"
          >
            <Text className="text-xs font-medium text-foreground">{change.label}</Text>
            <Text className="text-xs text-muted-foreground line-through">
              {change.before ?? '—'}
            </Text>
            <Text className="text-xs text-muted-foreground">→</Text>
            <Text className="text-xs font-medium text-foreground">{change.after ?? '—'}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function ApprovalRequestCard({
  request,
  onOpenAudit,
  onOpenListing,
}: Readonly<{
  request: ApprovalRequestListItem;
  onOpenAudit: () => void;
  onOpenListing: () => void;
}>) {
  const muted = useThemeColor('--muted-foreground');
  const preview = request.listingPreview;
  const title = preview?.title ?? snapshotTitle(request.snapshot);
  const price = preview ? formatPrice(preview) : null;
  const requestedAt = new Date(request.submittedAt).toLocaleString();
  const canOpenListing = request.resourceId !== '';

  return (
    <View className="rounded-2xl border border-border bg-background p-4">
      {/* Thumbnail */}
      <View className="h-40 w-full overflow-hidden rounded-xl bg-muted">
        {preview?.imageUrl ? (
          <Image source={{ uri: preview.imageUrl }} resizeMode="cover" className="h-full w-full" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <House size={36} color={muted} />
          </View>
        )}
      </View>

      {/* Header row */}
      <View className="mt-3 flex-row items-start justify-between gap-2">
        <View className="min-w-0 flex-1">
          <Text className="text-base font-semibold uppercase tracking-wide text-foreground">
            {title}
          </Text>
          {preview?.propertyType ? (
            <Text className="mt-0.5 text-sm text-muted-foreground">{preview.propertyType}</Text>
          ) : null}
          {price ? (
            <Text className="mt-1 text-xl font-semibold text-foreground">
              {price}{' '}
              <Text className="text-sm font-normal text-muted-foreground">
                {preview?.priceUnit ?? 'AED'}
              </Text>
            </Text>
          ) : null}
        </View>
        <ApprovalStatusBadge status={request.status} />
      </View>

      {/* Key/value grid */}
      {preview ? (
        <View className="mt-3 flex-row flex-wrap border-t border-border pt-3">
          <Field label="Community" value={preview.community} />
          <Field label="Area" value={preview.area} />
          <Field label="Developer" value={preview.developer} />
          <Field label="Size" value={preview.size} />
          <Field
            label="Total Floors"
            value={preview.totalFloors !== null ? String(preview.totalFloors) : null}
          />
          <Field label="Floor Level" value={preview.floorLevel} />
          <Field
            label="Bedrooms"
            value={preview.bedrooms !== null ? String(preview.bedrooms) : null}
          />
          <Field
            label="Bathrooms"
            value={preview.bathrooms !== null ? String(preview.bathrooms) : null}
          />
          <Field label="Agent" value={preview.agent} />
          <Field label="Permit No." value={preview.permitNumber} />
          <Field label="Approval For" value={request.approvalFor} />
          <Field label="Submitted By" value={request.submitterName} />
        </View>
      ) : null}

      <ChangedFields snapshot={request.snapshot} />

      <Text className="mt-3 text-xs text-muted-foreground">Requested on {requestedAt}</Text>

      {/* Actions */}
      <View className="mt-3 flex-row gap-2">
        {canOpenListing ? (
          <Button variant="outline" size="sm" onPress={onOpenListing} className="flex-1">
            <SquarePen size={16} color={muted} />
            <Text>Detail</Text>
          </Button>
        ) : null}
        <Button variant="outline" size="sm" onPress={onOpenAudit} className="flex-1">
          <ClipboardList size={16} color={muted} />
          <Text>Audit</Text>
        </Button>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck** — `cd boh-mobile && npx tsc --noEmit` → clean.
- [ ] **Step 3: Lint** — `cd boh-mobile && pnpm lint` → clean.
- [ ] **Step 4: Commit**

```bash
cd boh-mobile
git add src/features/approvals/components/ApprovalRequestCard.tsx
git commit -m "feat(approvals): rich listing request card with detail/audit actions

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Filters + picker hooks + full queue screen

**Files:**

- Create: `src/features/approvals/hooks/use-approvers.ts`
- Create: `src/features/approvals/hooks/use-agent-search.ts`
- Create: `src/features/approvals/components/QueueFilters.tsx`
- Replace: `src/features/approvals/components/ApprovalsQueueScreen.tsx` (was placeholder from Task 3)

**Interfaces:**

- Consumes: `getApprovers`, `searchAgents`, `ApproverOption` (Task 2); `useApprovalsQueue` (Task 4); `ApprovalRequestCard` (Task 5); `getQueueDef` (Task 1); `AreaOptionSheet`-style pattern.
- Produces: `useApprovers()` → `{ options: ApproverOption[] }`; `useAgentSearch()` → `{ options, search, setSearch }`; `QueueFilters({ filters, onFilterChange, onReset })`; `ApprovalsQueueScreen`.

- [ ] **Step 1: Approver options hook**

`src/features/approvals/hooks/use-approvers.ts`:

```ts
import { useQuery } from '@tanstack/react-query';

import { getApprovers, type ApproverOption } from '../services';

const ALL_APPROVERS: ApproverOption = { value: '', label: 'All Approvers' };

export function useApprovers() {
  const { data } = useQuery({
    queryKey: ['approvals', 'approvers'],
    queryFn: getApprovers,
    staleTime: 5 * 60_000,
  });
  return { options: [ALL_APPROVERS, ...(data ?? [])] };
}
```

- [ ] **Step 2: Agent search hook**

`src/features/approvals/hooks/use-agent-search.ts`:

```ts
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import { searchAgents, type ApproverOption } from '../services';

const ALL_AGENTS: ApproverOption = { value: '', label: 'All Agents' };

export function useAgentSearch() {
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');

  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const { data } = useQuery({
    queryKey: ['approvals', 'agents', debounced],
    queryFn: () => searchAgents(debounced),
    staleTime: 60_000,
  });

  return { options: [ALL_AGENTS, ...(data ?? [])], search, setSearch };
}
```

- [ ] **Step 3: Queue filters bar (search + two picker sheets + reset)**

`src/features/approvals/components/QueueFilters.tsx`:

```tsx
import * as React from 'react';
import { Pressable, View } from 'react-native';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown, RotateCcw } from 'lucide-react-native';
import { useThemeColor } from '@theme';

import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import type { ApproverOption } from '../services';
import { useApprovers } from '../hooks/use-approvers';
import { useAgentSearch } from '../hooks/use-agent-search';
import type { ApprovalsQueueFilters } from '../hooks/use-approvals-queue';

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
        className={cn('flex-1 text-base', active ? 'text-foreground' : 'text-muted-foreground')}
      >
        {label}
      </Text>
      <ChevronDown size={16} color={iconColor} />
    </Pressable>
  );
}

function OptionSheet({
  title,
  options,
  selectedValue,
  onSelect,
  sheetRef,
  searchable,
  searchValue,
  onSearchChange,
}: Readonly<{
  title: string;
  options: ApproverOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  sheetRef: React.RefObject<BottomSheetModal | null>;
  searchable?: boolean;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
}>) {
  const insets = useSafeAreaInsets();
  const sheetBg = useThemeColor('--popover');
  const handleColor = useThemeColor('--muted-foreground');
  const brand = useThemeColor('--brand');
  const muted = useThemeColor('--muted-foreground');

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
        {searchable ? (
          <BottomSheetTextInput
            value={searchValue}
            onChangeText={onSearchChange}
            placeholder="Search agents"
            placeholderTextColor={muted}
            className="mb-2 h-11 rounded-lg border border-input bg-background px-3 text-base text-foreground"
          />
        ) : null}
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
              <Text className="flex-1 text-base text-popover-foreground">{opt.label}</Text>
              {isSelected ? <Check size={20} strokeWidth={3} color={brand} /> : null}
            </Pressable>
          );
        })}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

export function QueueFilters({
  filters,
  onFilterChange,
  onReset,
}: Readonly<{
  filters: ApprovalsQueueFilters;
  onFilterChange: <K extends keyof ApprovalsQueueFilters>(
    key: K,
    value: ApprovalsQueueFilters[K],
  ) => void;
  onReset: () => void;
}>) {
  const approverRef = React.useRef<BottomSheetModal>(null);
  const agentRef = React.useRef<BottomSheetModal>(null);
  const muted = useThemeColor('--muted-foreground');

  const { options: approverOptions } = useApprovers();
  const {
    options: agentOptions,
    search: agentSearch,
    setSearch: setAgentSearch,
  } = useAgentSearch();

  const approverLabel =
    approverOptions.find((o) => o.value === filters.approverId)?.label ?? 'All Approvers';
  const agentLabel = agentOptions.find((o) => o.value === filters.agentId)?.label ?? 'All Agents';
  const anyActive = filters.search !== '' || filters.approverId !== '' || filters.agentId !== '';

  return (
    <View className="gap-2 px-4 pb-2">
      <Input
        placeholder="Search by title, price or agent"
        value={filters.search}
        onChangeText={(v) => onFilterChange('search', v)}
      />
      <View className="flex-row gap-2">
        <FilterTrigger
          label={approverLabel}
          active={filters.approverId !== ''}
          onPress={() => approverRef.current?.present()}
        />
        <FilterTrigger
          label={agentLabel}
          active={filters.agentId !== ''}
          onPress={() => agentRef.current?.present()}
        />
        {anyActive ? (
          <Pressable
            onPress={onReset}
            accessibilityRole="button"
            accessibilityLabel="Reset filters"
            className="h-11 w-11 items-center justify-center rounded-lg border border-input bg-background active:opacity-70"
          >
            <RotateCcw size={18} color={muted} />
          </Pressable>
        ) : null}
      </View>

      <OptionSheet
        title="Approver"
        options={approverOptions}
        selectedValue={filters.approverId}
        onSelect={(v) => onFilterChange('approverId', v)}
        sheetRef={approverRef}
      />
      <OptionSheet
        title="Agent"
        options={agentOptions}
        selectedValue={filters.agentId}
        onSelect={(v) => onFilterChange('agentId', v)}
        sheetRef={agentRef}
        searchable
        searchValue={agentSearch}
        onSearchChange={setAgentSearch}
      />
    </View>
  );
}
```

- [ ] **Step 4: Full queue screen**

Replace `src/features/approvals/components/ApprovalsQueueScreen.tsx`:

```tsx
import * as React from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/atoms/EmptyState';
import { Icon } from '@/components/atoms/Icon';
import { Skeleton } from '@/components/atoms/Skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/atoms/Tabs';
import { Text } from '@/components/atoms/Text';
import { getQueueDef } from '../constants/queues';
import type { ApprovalQueueSlug, ApprovalRequestListItem } from '../models/approval';
import { useApprovalsQueue, type ApprovalTab } from '../hooks/use-approvals-queue';
import { ApprovalRequestCard } from './ApprovalRequestCard';
import { QueueFilters } from './QueueFilters';

const TABS: ApprovalTab[] = ['Pending', 'Approved', 'Changes Requested'];

function ScreenHeader({ title }: Readonly<{ title: string }>) {
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
        <Text numberOfLines={1} className="flex-1 text-xl font-bold text-foreground">
          {title}
        </Text>
      </View>
    </View>
  );
}

function ListEmpty({ isLoading, isError }: Readonly<{ isLoading: boolean; isError: boolean }>) {
  if (isLoading) {
    return (
      <View className="gap-3 px-4">
        {[0, 1, 2].map((i) => (
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
          title="Couldn't load requests"
          description="Pull down to retry."
        />
      </View>
    );
  }
  return (
    <View className="items-center px-8 pt-10">
      <EmptyState icon="Inbox" title="No requests" description="Nothing in this tab yet." />
    </View>
  );
}

export function ApprovalsQueueScreen() {
  const insets = useSafeAreaInsets();
  const { queue: queueParam } = useLocalSearchParams<{ queue: string }>();
  const def = getQueueDef(queueParam ?? '');
  const queue = (def?.slug ?? 'listings-status') as ApprovalQueueSlug;
  const state = useApprovalsQueue(queue);

  if (def === undefined) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Approvals" />
        <View className="items-center px-8 pt-16">
          <Text className="text-sm text-muted-foreground">Queue not found.</Text>
        </View>
      </View>
    );
  }

  if (def.deferred) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title={def.label} />
        <View className="items-center px-8 pt-16">
          <EmptyState
            icon="Clock"
            title="Coming soon"
            description="This approval queue isn’t enabled yet."
          />
        </View>
      </View>
    );
  }

  const openAudit = (request: ApprovalRequestListItem) =>
    router.push({
      pathname: '/(app)/approvals/[queue]/[id]',
      params: { queue, id: request.id },
    });

  const openListing = (request: ApprovalRequestListItem) => {
    const kind =
      request.listingPreview?.kind ??
      (request.resourceType === 'listing' ? 'primary' : 'secondary');
    router.push({ pathname: '/listings/edit/[id]', params: { id: request.resourceId, kind } });
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={def.label} />
      <FlatList
        data={state.items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="px-4 pb-4">
            <ApprovalRequestCard
              request={item}
              onOpenAudit={() => openAudit(item)}
              onOpenListing={() => openListing(item)}
            />
          </View>
        )}
        ListHeaderComponent={
          <View className="gap-3 pb-1">
            <View className="px-4">
              <Text className="text-sm text-muted-foreground">{def.subtitle}</Text>
            </View>
            <QueueFilters
              filters={state.filters}
              onFilterChange={state.setFilter}
              onReset={state.reset}
            />
            <View className="px-4">
              <Tabs value={state.tab} onValueChange={(v) => state.setTab(v as ApprovalTab)}>
                <TabsList>
                  {TABS.map((t) => (
                    <TabsTrigger key={t} value={t}>
                      <Text>{`${t} (${state.counts[t]})`}</Text>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </View>
          </View>
        }
        ListEmptyComponent={<ListEmpty isLoading={state.isLoading} isError={state.isError} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (state.hasNextPage && !state.isFetchingNextPage) state.fetchNextPage();
        }}
        ListFooterComponent={
          state.isFetchingNextPage ? (
            <View className="py-6">
              <ActivityIndicator />
            </View>
          ) : null
        }
        refreshing={state.isLoading}
        onRefresh={state.refetch}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}
```

- [ ] **Step 5: Typecheck** — `cd boh-mobile && npx tsc --noEmit` → clean. (If `EmptyState` rejects icon names `Inbox`/`Clock`/`CircleAlert`, substitute a valid `IconName` the atom accepts — check `src/components/atoms/EmptyState.tsx` for its `icon` prop type.)
- [ ] **Step 6: Lint** — `cd boh-mobile && pnpm lint` → clean.
- [ ] **Step 7: Manual QA**

Open More → Approvals → Listings Status. Confirm: subtitle, search box, Approver + Agent picker triggers (opening each shows a bottom sheet; Agent sheet has a working search field), the 3 tabs with counts, and the request list. Type in search → list refetches after debounce. Pick an approver/agent → list filters; Reset button appears and clears. Scroll to bottom → next page loads. Pull to refresh works.

- [ ] **Step 8: Commit**

```bash
cd boh-mobile
git add src/features/approvals/hooks/use-approvers.ts src/features/approvals/hooks/use-agent-search.ts src/features/approvals/components/QueueFilters.tsx src/features/approvals/components/ApprovalsQueueScreen.tsx
git commit -m "feat(approvals): queue screen with tabs, parity filters and infinite list

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Detail data hook + mutations

**Files:**

- Create: `src/features/approvals/hooks/use-approval-detail.ts`

**Interfaces:**

- Consumes: `getApprovalRequest`, `approveRequest`, `requestChangesRequest` (Task 2).
- Produces: `useApprovalDetail(id: string)` returning:

  ```ts
  {
    request: ApprovalRequestDetail | undefined;
    isLoading: boolean;
    isError: boolean;
    approve: (note?: string) => Promise<void>;
    requestChanges: (note: string) => Promise<void>;
    isApproving: boolean;
    isRequestingChanges: boolean;
  }
  ```

- [ ] **Step 1: Create the hook**

`src/features/approvals/hooks/use-approval-detail.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { approveRequest, getApprovalRequest, requestChangesRequest } from '../services';

export function useApprovalDetail(id: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['approvals', 'request', id],
    queryFn: () => getApprovalRequest(id),
    enabled: id !== '',
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['approvals', 'request', id] });
    void queryClient.invalidateQueries({ queryKey: ['approvals'], exact: false });
  };

  const approveMutation = useMutation({
    mutationFn: (note?: string) => approveRequest(id, note),
    onSuccess: invalidate,
  });

  const requestChangesMutation = useMutation({
    mutationFn: (note: string) => requestChangesRequest(id, note),
    onSuccess: invalidate,
  });

  return {
    request: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    approve: async (note?: string) => {
      await approveMutation.mutateAsync(note);
    },
    requestChanges: async (note: string) => {
      await requestChangesMutation.mutateAsync(note);
    },
    isApproving: approveMutation.isPending,
    isRequestingChanges: requestChangesMutation.isPending,
  };
}
```

- [ ] **Step 2: Typecheck** — `cd boh-mobile && npx tsc --noEmit` → clean.
- [ ] **Step 3: Lint** — `cd boh-mobile && pnpm lint` → clean.
- [ ] **Step 4: Commit**

```bash
cd boh-mobile
git add src/features/approvals/hooks/use-approval-detail.ts
git commit -m "feat(approvals): detail hook with approve/request-changes mutations

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Approval chain panel + request-changes sheet + detail screen

**Files:**

- Create: `src/features/approvals/components/ApprovalChainPanel.tsx`
- Create: `src/features/approvals/components/RequestChangesSheet.tsx`
- Replace: `src/features/approvals/components/ApprovalDetailScreen.tsx` (was placeholder from Task 3)

**Interfaces:**

- Consumes: `ApprovalRequestDetail`, `ApprovalStep`, `ApprovalEvent`, `asUpdateSnapshot`, `ListingFieldChange`, `ListingPreview` (Task 1); `useApprovalDetail` (Task 7); `ApprovalStatusBadge` (Task 3).
- Produces: `ApprovalChainPanel({ request })`; `RequestChangesSheet({ sheetRef, onSubmit, isSubmitting })`; `ApprovalDetailScreen`.

- [ ] **Step 1: Approval chain panel**

`src/features/approvals/components/ApprovalChainPanel.tsx`:

```tsx
import * as React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import type { ApprovalRequestDetail, ApprovalStep } from '../models/approval';

const STEP_DOT: Record<ApprovalStep['status'], string> = {
  upcoming: 'bg-muted-foreground/40',
  pending: 'bg-warning',
  approved: 'bg-success',
  changes_requested: 'bg-destructive',
};

function StepRow({ step }: Readonly<{ step: ApprovalStep }>) {
  return (
    <View className="flex-row gap-3">
      <View className="items-center">
        <View className={cn('mt-1 h-3 w-3 rounded-full', STEP_DOT[step.status])} />
      </View>
      <View className="flex-1 pb-3">
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-medium text-foreground">Step {step.position}</Text>
          {step.isCurrent ? <Text className="text-xs font-medium text-brand">Current</Text> : null}
        </View>
        {step.approvers.map((a) => (
          <View key={a.id} className="mt-1 flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-sm text-muted-foreground">{a.label ?? 'Approver'}</Text>
            {a.decision ? (
              <Text
                className={cn(
                  'text-xs font-medium',
                  a.decision === 'approved' ? 'text-success' : 'text-destructive',
                )}
              >
                {a.decision === 'approved' ? 'Approved' : 'Changes requested'}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

export function ApprovalChainPanel({ request }: Readonly<{ request: ApprovalRequestDetail }>) {
  if (request.steps.length === 0) return null;
  return (
    <View className="rounded-2xl border border-border bg-background p-4">
      <Text className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Approval chain
      </Text>
      {request.steps.map((step) => (
        <StepRow key={step.id} step={step} />
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Request-changes bottom sheet**

`src/features/approvals/components/RequestChangesSheet.tsx`:

```tsx
import * as React from 'react';
import { View } from 'react-native';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColor } from '@theme';

import { Button } from '@/components/atoms/Button';
import { Text } from '@/components/atoms/Text';

export function RequestChangesSheet({
  sheetRef,
  onSubmit,
  isSubmitting,
}: Readonly<{
  sheetRef: React.RefObject<BottomSheetModal | null>;
  onSubmit: (note: string) => void;
  isSubmitting: boolean;
}>) {
  const insets = useSafeAreaInsets();
  const [note, setNote] = React.useState('');
  const sheetBg = useThemeColor('--popover');
  const handleColor = useThemeColor('--muted-foreground');
  const muted = useThemeColor('--muted-foreground');

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

  return (
    <BottomSheetModal
      ref={sheetRef}
      enablePanDownToClose
      enableDynamicSizing
      keyboardBehavior="interactive"
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: sheetBg }}
      handleIndicatorStyle={{ backgroundColor: handleColor, opacity: 0.4, width: 40 }}
    >
      <BottomSheetView
        style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
        className="gap-3"
      >
        <Text className="pt-1 text-base font-semibold text-popover-foreground">
          Request changes
        </Text>
        <Text className="text-sm text-muted-foreground">
          Tell the agent what needs to change before this can be approved.
        </Text>
        <BottomSheetTextInput
          value={note}
          onChangeText={setNote}
          placeholder="Describe the required changes"
          placeholderTextColor={muted}
          multiline
          className="min-h-24 rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground"
          style={{ textAlignVertical: 'top' }}
        />
        <Button
          variant="destructive"
          disabled={note.trim() === '' || isSubmitting}
          loading={isSubmitting}
          onPress={() => onSubmit(note.trim())}
        >
          <Text>Send request</Text>
        </Button>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
```

- [ ] **Step 3: Detail screen**

Replace `src/features/approvals/components/ApprovalDetailScreen.tsx`:

```tsx
import * as React from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, House, Undo2, X } from 'lucide-react-native';
import { useThemeColor } from '@theme';

import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Skeleton } from '@/components/atoms/Skeleton';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import {
  asUpdateSnapshot,
  type ApprovalEvent,
  type ListingFieldChange,
  type ListingPreview,
} from '../models/approval';
import { useApprovalDetail } from '../hooks/use-approval-detail';
import { ApprovalChainPanel } from './ApprovalChainPanel';
import { ApprovalStatusBadge } from './ApprovalStatusBadge';
import { RequestChangesSheet } from './RequestChangesSheet';

const EVENT_LABEL: Record<ApprovalEvent['type'], string> = {
  submitted: 'Submitted for approval',
  resubmitted: 'Resubmitted',
  approved: 'Approved',
  changes_requested: 'Changes requested',
  acknowledged: 'Acknowledged',
};

function ScreenHeader({ title }: Readonly<{ title: string }>) {
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
        <Text numberOfLines={1} className="flex-1 text-xl font-bold text-foreground">
          {title}
        </Text>
      </View>
    </View>
  );
}

function PreviewField({ label, value }: Readonly<{ label: string; value: string | null }>) {
  if (value === null || value.trim() === '') return null;
  return (
    <View className="w-1/2 py-1 pr-2">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className="text-sm font-medium text-foreground">{value}</Text>
    </View>
  );
}

function FieldChangeList({ fields }: Readonly<{ fields: readonly ListingFieldChange[] }>) {
  return (
    <View className="mt-2 gap-1.5">
      {fields.map((change) => (
        <View
          key={change.field}
          className="flex-row flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md bg-muted px-2.5 py-1.5"
        >
          <Text className="text-xs font-medium text-foreground">{change.label}</Text>
          <Text className="text-xs text-muted-foreground line-through">{change.before ?? '—'}</Text>
          <Text className="text-xs text-muted-foreground">→</Text>
          <Text className="text-xs font-medium text-foreground">{change.after ?? '—'}</Text>
        </View>
      ))}
    </View>
  );
}

function ListingPreviewSection({ preview }: Readonly<{ preview: ListingPreview }>) {
  const muted = useThemeColor('--muted-foreground');
  const [open, setOpen] = React.useState(false);
  const price =
    preview.price !== null && preview.price > 0 ? preview.price.toLocaleString('en-US') : null;
  return (
    <View className="rounded-2xl border border-border bg-background p-4">
      <Text className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Listing
      </Text>
      <Pressable
        onPress={() => preview.imageUrl && setOpen(true)}
        className="h-44 w-full overflow-hidden rounded-xl bg-muted"
      >
        {preview.imageUrl ? (
          <Image source={{ uri: preview.imageUrl }} resizeMode="cover" className="h-full w-full" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <House size={36} color={muted} />
          </View>
        )}
      </Pressable>
      <Text className="mt-3 text-base font-semibold text-foreground">
        {preview.title ?? 'Untitled listing'}
      </Text>
      {preview.propertyType ? (
        <Text className="mt-0.5 text-sm text-muted-foreground">{preview.propertyType}</Text>
      ) : null}
      {price ? (
        <Text className="mt-1 text-lg font-semibold text-foreground">
          {price}{' '}
          <Text className="text-sm font-normal text-muted-foreground">
            {preview.priceUnit ?? 'AED'}
          </Text>
        </Text>
      ) : null}
      <View className="mt-3 flex-row flex-wrap border-t border-border pt-3">
        <PreviewField label="Community" value={preview.community} />
        <PreviewField label="Area" value={preview.area} />
        <PreviewField label="Developer" value={preview.developer} />
        <PreviewField label="Size" value={preview.size} />
        <PreviewField
          label="Total Floors"
          value={preview.totalFloors !== null ? String(preview.totalFloors) : null}
        />
        <PreviewField label="Floor Level" value={preview.floorLevel} />
        <PreviewField
          label="Bedrooms"
          value={preview.bedrooms !== null ? String(preview.bedrooms) : null}
        />
        <PreviewField
          label="Bathrooms"
          value={preview.bathrooms !== null ? String(preview.bathrooms) : null}
        />
        <PreviewField label="Agent" value={preview.agent} />
        <PreviewField label="Permit No." value={preview.permitNumber} />
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 bg-black/90">
          <Pressable
            onPress={() => setOpen(false)}
            accessibilityLabel="Close image"
            className="absolute right-4 top-14 z-10 h-10 w-10 items-center justify-center rounded-full bg-white/15"
          >
            <X size={22} color="#fff" />
          </Pressable>
          {preview.imageUrl ? (
            <Image
              source={{ uri: preview.imageUrl }}
              resizeMode="contain"
              className="h-full w-full"
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

export function ApprovalDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useApprovalDetail(id ?? '');
  const changesRef = React.useRef<BottomSheetModal>(null);
  const iconOnDefault = useThemeColor('--primary-foreground');

  if (detail.isLoading) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Approval" />
        <View className="gap-3 p-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </View>
      </View>
    );
  }

  const request = detail.request;
  if (request === undefined) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Approval" />
        <View className="items-center px-8 pt-16">
          <Text className="text-sm text-muted-foreground">Request not found.</Text>
        </View>
      </View>
    );
  }

  const updateDiff = asUpdateSnapshot(request.snapshot);
  const history = [...request.history].reverse();

  const handleApprove = async () => {
    await detail.approve();
  };
  const handleRequestChanges = async (note: string) => {
    await detail.requestChanges(note);
    changesRef.current?.dismiss();
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={`Approval · #${request.id.slice(0, 8)}`} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120, gap: 16 }}
      >
        <View className="flex-row items-center gap-2">
          <ApprovalStatusBadge status={request.status} />
        </View>

        {/* Approval request subject */}
        <View className="rounded-2xl border border-border bg-background p-4">
          <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Approval request
          </Text>
          {request.approvalFor ? (
            <Text className="text-sm text-muted-foreground">
              Approval for:{' '}
              <Text className="font-medium text-foreground">{request.approvalFor}</Text>
            </Text>
          ) : null}
          {updateDiff && updateDiff.fields.length > 0 ? (
            <View className="mt-3">
              <Text className="text-xs font-medium text-muted-foreground">Changed fields</Text>
              <FieldChangeList fields={updateDiff.fields} />
            </View>
          ) : null}
        </View>

        {request.listingPreview ? <ListingPreviewSection preview={request.listingPreview} /> : null}

        <ApprovalChainPanel request={request} />

        {/* History */}
        <View className="rounded-2xl border border-border bg-background p-4">
          <Text className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            History
          </Text>
          <View className="gap-3">
            {history.map((event) => (
              <View key={event.id}>
                <Text className="text-sm font-medium text-foreground">
                  {EVENT_LABEL[event.type]}
                  {event.actorName ? (
                    <Text className="font-normal text-muted-foreground"> by {event.actorName}</Text>
                  ) : null}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {new Date(event.createdAt).toLocaleString()}
                </Text>
                {event.note && event.note !== '' ? (
                  <Text
                    className={cn(
                      'mt-1.5 rounded-lg px-3 py-2 text-sm',
                      event.type === 'changes_requested'
                        ? 'bg-destructive/10 text-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {event.note}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Sticky action bar */}
      {request.canAct ? (
        <View
          style={{ paddingBottom: insets.bottom + 12 }}
          className="absolute inset-x-0 bottom-0 flex-row gap-2 border-t border-border bg-background px-4 pt-3"
        >
          <Button
            variant="outline"
            className="flex-1"
            onPress={() => changesRef.current?.present()}
          >
            <Undo2 size={18} color={useThemeColor('--foreground')} />
            <Text>Request changes</Text>
          </Button>
          <Button
            className="flex-1"
            loading={detail.isApproving}
            onPress={() => void handleApprove()}
          >
            <Check size={18} color={iconOnDefault} />
            <Text>Approve</Text>
          </Button>
        </View>
      ) : null}

      <RequestChangesSheet
        sheetRef={changesRef}
        onSubmit={(note) => void handleRequestChanges(note)}
        isSubmitting={detail.isRequestingChanges}
      />
    </View>
  );
}
```

> Note: `useThemeColor('--foreground')` is called inline in JSX above for the Request-changes icon. If the linter/hooks rule flags a hook called inside JSX, hoist it to a `const fg = useThemeColor('--foreground');` at the top of `ApprovalDetailScreen` (next to `iconOnDefault`) and reference `fg`.

- [ ] **Step 4: Typecheck** — `cd boh-mobile && npx tsc --noEmit` → clean.
- [ ] **Step 5: Lint** — `cd boh-mobile && pnpm lint` → clean. (Fix the inline-hook note above if `react-hooks/rules-of-hooks` fires.)
- [ ] **Step 6: Manual QA**

From the queue, tap **Audit** on a request → detail shows status, approval-request subject (+ changed-field diff if a listings-update), listing preview (tap image → full-screen modal, close works), approval chain, history newest-first (changes-requested notes tinted red). On a request where you are the current approver (`canAct`), the sticky **Request changes** / **Approve** bar shows. Approve → returns/refreshes and the request leaves the Pending tab. Request changes → sheet requires a note, sending moves it to Changes Requested. On a request you can't act, no action bar.

- [ ] **Step 7: Commit**

```bash
cd boh-mobile
git add src/features/approvals/components/ApprovalChainPanel.tsx src/features/approvals/components/RequestChangesSheet.tsx src/features/approvals/components/ApprovalDetailScreen.tsx
git commit -m "feat(approvals): detail screen with chain, history and approve/request-changes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: End-to-end verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck** — `cd boh-mobile && npx tsc --noEmit` → clean.
- [ ] **Step 2: Full lint** — `cd boh-mobile && pnpm lint` → clean.
- [ ] **Step 3: Format check** — `cd boh-mobile && pnpm format:check` → clean (run `pnpm format` if not).
- [ ] **Step 4: Full-flow manual QA on device**

With an `approvals:act` (designated-approver) account:

1. More tab shows **Approvals**; open it → hub with 5 cards, only Listings Status active.
2. Open Listings Status → tabs + counts + parity filters + infinite list of listing cards.
3. Search / Approver / Agent filters all narrow the list; Reset clears.
4. Card **Detail** opens the listing edit screen with the right `id`/`kind`; back returns.
5. Card **Audit** opens the detail screen; chain + history + preview render.
6. Approve and Request-changes round-trip; lists and counts update (query invalidation).

With a non-approver account: no More **Approvals** row; direct-navigating `/(app)/approvals` shows the no-access message.

- [ ] **Step 5: Commit any fixes surfaced during QA** (if none, skip).

```bash
cd boh-mobile
git add -A
git commit -m "fix(approvals): QA fixes for listing-status approvals flow

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**

- Entry + nav (More row, hub, routes, RBAC) → Tasks 1, 3. ✅
- Hub screen (5 cards, coming-soon) → Task 3. ✅
- Queue screen (header, full-parity filters, tabs+counts, infinite list, states) → Tasks 4, 6. ✅
- Rich listing card (grid + diff + Audit/Detail buttons) → Task 5. ✅
- Detail/Audit (subject, preview+fullscreen, history, chain, canAct actions, request-changes note) → Tasks 7, 8. ✅
- Services (queue/detail/approve/request-changes/pending-count/approvers/agents) → Task 2. ✅
- Conventions (TanStack Query, NativeWind tokens, gorhom sheets, no new deps) → all tasks. ✅
- Verification (tsc + lint + manual QA, no unit tests) → every task + Task 9. ✅

**Out-of-scope confirmed omitted:** submit-for-approval, acknowledge, resubmit UI, other queues' content, pending-count badge on tab. ✅

**Placeholder scan:** No TBD/TODO; every code step ships complete code. The two explicit "temporary placeholder" files in Task 3 are intentional scaffolding, replaced in Tasks 6 and 8. ✅

**Type consistency:** `useApprovalsQueue` returns `setFilter`/`setTab`/`filters`/`counts`/`items`/`hasNextPage`/`fetchNextPage`/`refetch` — consumed exactly in Task 6's screen. `useApprovalDetail` returns `request`/`approve`/`requestChanges`/`isApproving`/`isRequestingChanges` — consumed exactly in Task 8. `ApproverOption` shape `{ value, label }` shared by services + picker hooks + QueueFilters. `ApprovalRequestCard` props (`request`, `onOpenAudit`, `onOpenListing`) match Task 6 usage. ✅

**Known adaptation risks flagged inline for the implementer:** `EmptyState` icon-name prop values (Task 6 Step 5), and the inline `useThemeColor` in JSX (Task 8 note). Both have explicit fallback instructions.
