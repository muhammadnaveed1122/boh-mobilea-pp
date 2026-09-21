# Mobile Listing-Status Approvals — Design

**Date:** 2026-07-02
**Status:** Approved — ready for implementation plan
**Repo:** `boh-mobile`

## Goal

Bring the web Approvals inbox (`/my-account/approvals/listings-status`) to the mobile
client with **full web parity, in a mobile-native manner**. Reachable from the **More**
tab via a hub screen of queue cards; the enabled `listings-status` queue opens a list of
approval requests, each drilling into an audit/detail screen where a designated approver
can Approve or Request changes.

Only the `listings-status` queue is active this iteration; the other four web queues render
as greyed **Coming soon** cards. The queue and detail screens are catalogue-driven, so
enabling `listings-update` later is a single `deferred: false` flip in the queue catalogue.

## Backend

Same NestJS endpoints the web app consumes, through the shared mobile `apiClient`
(`src/lib/api.ts`) whose response interceptor already unwraps the `{ success, data }`
envelope. All paths are prefixed `/api/v1` (mobile convention):

| Purpose                                 | Method + path                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| Queue list (paginated + per-tab counts) | `GET /api/v1/approvals/{queue}?status=&search=&approverId=&agentId=&page=&limit=` |
| Request detail (chain + history)        | `GET /api/v1/approvals/request/{id}`                                              |
| Approve                                 | `POST /api/v1/approvals/request/{id}/approve` `{ note? }`                         |
| Request changes                         | `POST /api/v1/approvals/request/{id}/request-changes` `{ note }`                  |
| Resubmit (only if `canAct` surfaces it) | `POST /api/v1/approvals/request/{id}/resubmit` `{ note }`                         |
| Pending count (badge, optional)         | `GET /api/v1/approvals/pending-count`                                             |
| Approver picker options                 | `GET /api/v1/users/approvers`                                                     |
| Agent picker options (searchable)       | `GET /api/v1/agents?search=&page=&limit=&isActive=true`                           |

## RBAC

A single permission `approvals:act` gates viewing **and** acting (matches web
`APPROVAL_PERMISSION.act`). Add to mobile `src/lib/rbac/permissions.ts`:

```ts
APPROVALS_ACT: 'approvals:act',
```

Gate the More-sheet row and each screen with `useCan(PERMISSIONS.APPROVALS_ACT)`.

## Navigation & routes (Expo Router)

- **More sheet** (`src/features/more/components/MoreSheet.tsx`): add row
  `{ key: 'approvals', label: 'Approvals', icon: SealCheck, href: '/(app)/approvals', visible: canApprovals }`.
- Nested dynamic routes:

```
app/(app)/approvals/
  index.tsx              → ApprovalsHubScreen        (5 queue cards)
  [queue]/index.tsx      → ApprovalsQueueScreen      (tabs + filters + list)
  [queue]/[id].tsx       → ApprovalDetailScreen      (audit + actions)
```

Each route file is a thin re-export of the feature component (matches the `areas/` pattern).

## Screens

### 1. Hub — `ApprovalsHubScreen`

Header + a vertical list of **redirect cards**, one per catalogue queue. Card shows queue
label, subtitle, chevron. Active queue (`listings-status`) is tappable → `/(app)/approvals/listings-status`.
Deferred queues render greyed with a **Coming soon** pill and are non-interactive.

### 2. Queue — `ApprovalsQueueScreen`

Driven by the queue def resolved from the `[queue]` param. If the def is `deferred`, show a
"Coming soon" empty state.

- **Header**: `def.title` + `def.subtitle`.
- **Filters** (`QueueFilters`, full parity): search input (title/price/agent) + Approver picker
  - Agent picker + Reset. Pickers are `@gorhom/bottom-sheet` selection sheets (mobile manner):
  * Approver options ← `/api/v1/users/approvers`.
  * Agent options ← `/api/v1/agents?search=` (debounced, searchable).
- **Tabs**: underline tabs `Pending | Approved | Changes Requested` with per-tab counts
  (from queue response `counts`). Reuse the existing mobile underline-tab component/style.
- **List**: `useInfiniteQuery` (limit 10), infinite scroll (Areas `use-neighbourhoods-infinite`
  pattern). Renders `ApprovalRequestCard`. Loading / empty / end states.

### 3. `ApprovalRequestCard` (listing variant)

Ports the web rich card: thumbnail (house-icon fallback), title-with-pipe-tags, property type,
price + unit, a key/value grid (Community, Area, Developer, Size, Total Floors, Floor Level,
Bedrooms, Bathrooms, Agent, Permit No., Approval For, Submitted By), `ApprovalStatusBadge`,
requested-at timestamp, and the before→after changed-field diff (from an update snapshot).
Two actions:

- **Audit** → `/(app)/approvals/listings-status/{id}`.
- **Detail** → `/listings/edit/[id]` with `params { id: resourceId, kind: 'primary'|'secondary' }`
  (kind resolved from `listingPreview.kind`, falling back on `resourceType`).

### 4. Detail / Audit — `ApprovalDetailScreen`

Single scrollable column (mobile) of the web two-column layout:

- Approval-request subject + changed-field diff (`asUpdateSnapshot`).
- Listing preview section (image → full-screen on tap) with the key/value grid.
- **History timeline** newest-first: event label + actor + timestamp, note bubbles
  (changes-requested notes tinted `destructive`).
- **`ApprovalChainPanel`**: ordered steps, each step's approvers + decision + note, current step marked.
- **Actions** (only when `request.canAct`): sticky bottom bar → **Approve** and **Request changes**.
  Request-changes opens `RequestChangesSheet` (required note). Both call mutations that invalidate
  the queue list, this request's detail, and the pending count.

## Feature module — `src/features/approvals/`

```
models/approval.ts        Ported/trimmed DTOs: ApprovalQueueSlug, statuses, ApprovalStep,
                          ApprovalEvent, ListingPreview, ListingFieldChange, ListingUpdateSnapshot,
                          ApprovalRequestListItem, ApprovalRequestDetail, ApprovalQueueResponse,
                          ApprovalQueueParams; helper asUpdateSnapshot.
constants/queues.ts       Ported APPROVAL_QUEUES catalogue + getQueueDef. Only listings-status
                          non-deferred this iteration.
services.ts               axios apiClient calls: getQueue, getRequest, approve, requestChanges,
                          resubmit, getPendingCount, getApprovers, searchAgents. Defensive
                          normalizers (toArea-style) around unknown payloads.
hooks/
  use-approvals-queue.ts  Tab + filters state; useInfiniteQuery; flattened items + counts.
  use-approval-detail.ts  useQuery(detail) + useMutation(approve / requestChanges) with
                          query invalidation.
  use-approvers.ts        useQuery approver options.
  use-agent-search.ts     Debounced searchable agent options.
components/
  ApprovalsHubScreen.tsx
  QueueCard.tsx
  ApprovalsQueueScreen.tsx
  QueueFilters.tsx        Search + approver sheet + agent sheet + reset.
  ApprovalRequestCard.tsx
  ApprovalStatusBadge.tsx
  ApprovalChainPanel.tsx
  ApprovalDetailScreen.tsx
  RequestChangesSheet.tsx
```

## Conventions

- Server state via **TanStack Query**; no RTK (that's web-only). Client filter/tab state via local `useState`.
- Styling: **NativeWind** semantic tokens only (`bg-background`, `text-foreground`, `text-destructive`,
  `border-border`, `bg-muted`…) — no hard-coded hex, no `dark:` classes.
- Bottom sheets via `@gorhom/bottom-sheet` (already used by MoreSheet); require `<PortalHost />` (already mounted).
- Icons: `lucide-react-native`. Atoms: existing `Text`, `Button`, `Input`, `Badge`, RNR primitives.
- `Readonly<{...}>` prop types; strict TS; classes merged with `cn()`.
- Visual polish driven by the **ui-ux-pro-max** skill at build time.
- No new runtime dependencies.

## Out of scope

- Submit-for-approval (agent-side origination) and acknowledge.
- Content for the other four queues (transactions / commission / portals / listings-update) — cards only.
- Pending-count badge on the More/tab entry (optional, deferred unless trivial).

## Verification

No unit tests (repo policy). Verify via `tsc --noEmit` + `pnpm lint` + manual QA on device:
hub → queue → tabs/filters/search → card Audit/Detail → detail chain/history → approve /
request-changes round-trip with a designated-approver account.
