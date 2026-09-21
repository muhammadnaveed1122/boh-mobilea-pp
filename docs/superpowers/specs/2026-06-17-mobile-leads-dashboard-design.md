# Mobile Leads Dashboard — Design Spec

**Date:** 2026-06-17
**Repo:** `boh-mobile`
**Goal:** Bring the web `/my-account/manage-leads` dashboard to mobile as native components — full functional parity, mobile-native layout.

---

## 1. Summary

The agent home in `boh-mobile` is currently a thin `LeadsScreen` (stat tiles + recent leads). The web `manage-leads` page is a rich hub: KPI stats, Today's Priorities, a Kanban pipeline board, secondary status panels, a list/table view, multi-filter bar, assignment, status changes, viewing scheduler, and notes.

This spec replaces the thin home with a **Leads Dashboard** that reaches functional parity with web, restructured for a phone via a top **segmented control with three sub-views**:

| Sub-view     | Web equivalent                                  | Purpose                                                                                |
| ------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Overview** | `KpiRow` + `TodaysPriorities` + pipeline counts | At-a-glance: full stats, ranked priorities, pipeline summary                           |
| **Pipeline** | `PipelineBoard` + `SecondaryPanels`             | The board — swipe-column stages incl. secondary stages; status change via action sheet |
| **List**     | `LeadListView`                                  | Flat searchable/filterable lead list (upgrade of existing `AllLeadsScreen`)            |

Web's drag-drop becomes **tap → action sheet**. Web's board/list toggle becomes the **segmented control**.

---

## 2. Information Architecture & Routing

- New component **`LeadsDashboardScreen`** hosts a segmented control (`Overview | Pipeline | List`) and renders the active sub-view. State of the active tab lives in local component state (default `Overview`).
- **Mount points:**
  - Agent home — `app/(public)/index.tsx` renders `LeadsDashboardScreen` for authenticated non-customers (replaces the current `LeadsScreen`).
  - Leads tab — `app/(app)/leads/index.tsx` renders the same `LeadsDashboardScreen`.
  - The two entry points share one component; deep-link param `?view=pipeline|list|overview` may preset the active sub-view (used by "Open board" / "See all" links inside Overview).
- Existing routes unchanged: `/leads/[id]` (detail), `/leads/create`, `/leads/all`. `/leads/all` may be retired in favor of the List sub-view, but is left intact for now.
- **Permission gating:** screen requires `LEADS_READ || LEADS_READ_ALL` (existing `useRequirePermission`). Per-action gating reuses `useLeadPermissions` (`canUpdate`, `canAssign`, `canViewContact`, `canCall`, `canChat`) and `LEADS_CREATE` for the FAB.

---

## 3. Data Layer

All endpoints exist on the backend under prefix `/api/v1`. Confirmed:

| Purpose                              | Endpoint                               | Notes                                                                                                                                                                  |
| ------------------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard KPIs + priorities + counts | `GET /api/v1/leads/overview`           | query: `agentId?`, `teamId?`, `dateFrom?`, `dateTo?`. Returns `{ kpis[], tabCounts[], pipelineCounts[], priorities[] }`                                                |
| List leads                           | `GET /api/v1/leads`                    | supports `page,limit,status,statuses[],isAssigned,assigneeId,search,priority,channel,externalSource,dateFrom,dateTo,callOutcome,portalSource,sortBy,sortOrder` (+more) |
| Update lead (status/assign/priority) | `PATCH /api/v1/leads/:id`              | body: `{ status?, assigneeId?, priority?, ... }`                                                                                                                       |
| Create viewing                       | `POST /api/v1/leads/:leadId/viewings`  | body per `CreateLeadViewingDto`; `setStatusToViewing` flag                                                                                                             |
| Agents (assignee picker)             | `GET /api/v1/agents`                   | query: `page,limit,isActive,search`                                                                                                                                    |
| Notes                                | `GET/POST /api/v1/leads/:leadId/notes` | POST body `{ content }`                                                                                                                                                |

### New services (extend `src/features/leads/services.ts`)

- `getLeadsOverview(params: OverviewQuery): Promise<LeadsOverview>`
- `getAgents(params: AgentsQuery): Promise<PaginatedAgents>` (or reuse an existing agents service if present)
- `createLeadViewing(leadId, payload): Promise<LeadViewing>`
- `getLeadNotes(leadId)` / `createLeadNote(leadId, { content })`
- `updateLead` already exists — used for status/assign/priority mutations.

### New hooks (TanStack Query, follow existing patterns)

- `useLeadsOverview(params)` — query key `['leads','overview',params]`, `staleTime` ~30s.
- `useBoardLeads(status, filters)` — infinite query per stage column, key `['leads','board',status,filters]`, page size 20.
- `useAgentsList(search)` — for assignee picker.
- `useUpdateLeadStatus(id)` / `useAssignLead(id)` — thin wrappers over `updateLead`; on success invalidate `['leads']`, `['leads','overview']`, `['leads','board', ...]`.
- `useCreateViewing(leadId)` — invalidates board + overview.
- `useLeadNotes(leadId)` / `useCreateLeadNote(leadId)`.

### Type changes (`src/features/leads/types.ts`)

- Add `LeadsOverview` (kpis, tabCounts, pipelineCounts, priorities), `OverviewKpi`, `PriorityItem`, `PipelineCount`.
- Extend `LeadsQuery` with: `statuses?: LeadStatus[]`, `isAssigned?`, `channel?`, `externalSource?`, `dateFrom?`, `dateTo?`, `callOutcome?`, `portalSource?`.
- Extend `LeadListItem` to carry card fields the board/list need: `priority`, `preferredCity?`, `budgetRange?`, `externalSource?`, `channel?`, `assignee?: { id, name, avatarUrl? }`, `isAssigned`, `lastNote?: { content, createdAt } | null`, `interest?`. (Confirm `/leads` list response actually returns these; map what exists, fall back gracefully.)

---

## 4. Components

Reuse the atomic UI kit (`Text`, `Card`, `Badge`, `Button`, `Icon`, `Avatar`), NativeWind tokens, `cn()`. New components under `src/features/leads/components/dashboard/`:

### Shared

- **`LeadsDashboardScreen`** — segmented control + sub-view switch + shared FAB (`LEADS_CREATE` → `/leads/create`) + pull-to-refresh.
- **`LeadsSegmentedControl`** — Overview/Pipeline/List, native segmented control styling.
- **`LeadStatusBadge` / `LeadPriorityBadge`** — reuse existing badge variant maps.
- **`LeadQuickActions`** — Email / Call / WhatsApp row; gated by `useLeadPermissions`; Call → soft-phone dialer (existing call flow), WhatsApp → `wa.me` deep link, Email → mail composer / detail.
- **`LeadActionSheet`** — bottom sheet from a card's kebab: Move stage, Assign, Set priority, Add note, Open detail.

### Overview sub-view

- **`OverviewView`** — vertical scroll.
- **`KpiGrid`** — 2-col grid of KPI cards (value, label, trend % + direction). From `overview.kpis`.
- **`PrioritiesCarousel`** — horizontal `FlatList` of `PriorityCard` (name, persona, reason). From `overview.priorities`. Tap → detail.
- **`PipelineSummary`** — rows per stage with count + proportional bar; secondary stages (Did Not Respond / Future Prospect / Unqualified) under an "Other" divider. From `overview.pipelineCounts`. Tap stage → Pipeline sub-view preset to that stage.

### Pipeline sub-view (swipe-column board)

- **`PipelineView`** — horizontal pager (`react-native-pager-view` if already a dep, else horizontal `FlatList` paged) of stage columns; quick-filter chips + Filters entry at top; a stage strip showing current column + counts.
- **`PipelineColumn`** — header (stage name + count), vertical infinite `FlatList` of `PipelineLeadCard`, "Load more" on end-reached. One `useBoardLeads(status, filters)` per mounted column (mount current ± neighbors for swipe).
- **`PipelineLeadCard`** — avatar, name, persona/property/budget, priority + source badges, quick actions, kebab → `LeadActionSheet`.
- Stage order: New, Contacted, Qualified, Viewing_Scheduled, Working_Deal, Closed_Deal, Lost_Deal, then secondary: Did_Not_Respond, Future_Prospect, Unqualified.

### List sub-view

- **`ListView`** — wraps/refactors existing `AllLeadsScreen` body: sticky search + filter chips, infinite `FlatList` of compact `LeadListRow` (avatar, name, persona/source, priority badge, stage badge). Tap → detail.

### Filters

- **`LeadsFilterSheet`** — bottom sheet shared by all three sub-views. Sections: Assignment (Any/Assigned/Unassigned), Priority (Hot/Warm/Cold), Stage, Assignee (agent picker), Portal source (Property Finder/Bayut/Dubizzle), Call outcome (Connected/Missed/With recording), Date range (from/to), Clear all. Maps to `/leads` query params.

### Mutations / sheets

- **`AssignAgentSheet`** — agent list (search), select → `useAssignLead`.
- **`StatusChangeSheet`** — pick target stage → `useUpdateLeadStatus`; if target is Viewing_Scheduled, open `ViewingSchedulerSheet` instead.
- **`ViewingSchedulerSheet`** — date, start/end time, propertyType (new_project/sale/rent), conditional project/listing pickers, remarks, `setStatusToViewing`. → `useCreateViewing`.
- **`AddNoteSheet`** — content field → `useCreateLeadNote`.

---

## 5. State & Filters

- **Filter state:** a dashboard-scoped Zustand store (extend or parallel the existing `useLeadsFilterStore`) holding: `assignment`, `priority`, `stageFilter`, `assigneeId`, `portalSource`, `callOutcome`, `dateFrom`, `dateTo`, `searchInput`, `debouncedSearch`. Shared across the three sub-views so switching tabs preserves filters. `selectActiveFilterCount` drives the Filters chip badge.
- **Search debounce:** reuse `useSearchDebounceSync` pattern (300ms).
- **Cross-sub-view contract:** Overview "Open board"/stage tap and "See all" set the active sub-view + relevant filter, then switch.

---

## 6. Behavior / Error Handling / Edge Cases

- **Contact masking:** phone/email masked unless `canViewContact`; Call/Chat actions hidden without perms (reuse `useLeadPermissions`, `maskPhone`, `maskEmail`).
- **Loading:** skeletons per section (KPI grid, carousel, column lists). Initial board mounts current column first.
- **Empty states:** per stage ("No leads in {stage}"), per list (no results), per priorities ("No priorities today").
- **Errors:** inline retry per query (existing axios error-toast + suppress patterns); mutation failures show toast, optimistic update rolls back.
- **Optimistic updates:** status/assign apply optimistically to the affected column/list, invalidate on settle.
- **Pull-to-refresh:** invalidates overview + visible board/list queries.
- **Permissions denied:** screen redirects to `/` (existing gate).

---

## 7. Scope

**In scope (v1):** Overview (full KPIs, priorities, pipeline summary incl. secondary), Pipeline swipe-column board with all stages, List sub-view, shared multi-filter sheet, search, assignment, status change, viewing scheduler, add note, quick actions (email/call/whatsapp), create FAB, contact masking, permission gating.

**Out of scope (v1) — note, don't build:**

- PropertyFinder manual **sync** button (web has it; defer).
- Bulk actions / multi-select.
- Full notes thread management (read latest + add; full thread lives in lead detail).
- Drag-to-reorder (replaced by action sheet by design).

---

## 8. Testing / Verification

Per `boh-mobile` convention (no unit-test runner): verify via `tsc` typecheck + lint + manual QA on device/simulator. Manual QA checklist: each sub-view renders with live data; filters apply across sub-views; status change moves lead between columns; assign updates card; viewing scheduler creates viewing + sets stage; create FAB; contact masking honored for non-admin; permission-gated actions hidden appropriately; pull-to-refresh; infinite scroll per column and list.

---

## 9. Open Questions / Assumptions

- Assumes `/leads` list response includes (or can include) card fields: `priority`, `assignee`, `isAssigned`, `budgetRange`, `preferredCity`, `externalSource`, `lastNote`. If not, the card degrades gracefully and a backend follow-up is filed. **To confirm during implementation.**
- Pipeline board uses one infinite query per mounted column; mount current ± neighboring columns to keep swipe smooth without fetching all 10 at once.
- Pager library: use existing dep if present; otherwise paged horizontal `FlatList` (no new heavy dep).
