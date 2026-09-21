# Unified Leads Dashboard — Mobile (Phase 1)

**Date:** 2026-06-19
**Repo:** `boh-mobile`
**Status:** Approved design → ready for implementation plan

## Goal

Port the **value** of the web Leads dashboard (`/my-account/manage-leads`) to the mobile app in a mobile-native manner, and make the leads module the **single source of truth** for lead stats. Phase 1 delivers the overview dashboard. Buy / Sell / Rent / Portal category screens are **navigation placeholders only** this phase — their real implementations come later.

## Context — what exists today

### Web (source of value, `boh-lead-magnet`)

- Route `/my-account/manage-leads` → `LeadsOverviewPage`: 6 KPI cards (count + trend% + direction + sparkline), **Today's Priorities** ranked action list, and a lead board/list.
- Separate pages: `/buy`, `/sell`, `/rent` (`IntentSubpage`), `/portal` (`PortalLeadsPage`).
- Overview page interactions: KPI cards are read-only; Today's Priorities items are clickable → lead detail; `actionType` per priority maps to a next-action label (Contact Now / Follow Up / Convert to Deal / …) with status-driven color.

### Backend (shared, `boh-lead-magnet-backend`)

All consumed endpoints exist and are `@AuthenticatedOnly()` (mobile token works):

- `GET /leads/overview` → `LeadsDashboardResponseDto`:
  - `kpis[]`: `{ key, label, count, trend: { percent, direction: 'up'|'down'|'flat', sparkline: number[] } }`
  - `tabCounts[]`: `{ key, label, count }`
  - `pipelineCounts[]`: `{ status, count }`
  - `priorities[]`: `{ leadId, name, avatarUrl, reason, conditionRank, actionType, property?: { thumbnailUrl?, price? } }`
  - query: `agentId?`, `teamId?`, `dateFrom?`, `dateTo?`
- `GET /leads/portal-overview` → `{ channelCounts: { all, whatsapp, calls, emails }, cards[] }`
- `GET /leads/funnel-stats` → `{ totalLeads, closedDeals, activeLeads }` (being retired from home)
- `GET /leads` list — rich filter set incl. `intentBucket: 'buy'|'rent'|'sell'`, `isPortal`, `statuses[]`, `priority`, `search`, pagination.

### Mobile (target, `boh-mobile`)

- Root `/` → for authenticated staff renders `LeadsScreen` (`src/features/leads/components/LeadsScreen.tsx`): mini 2-stat tiles + recent-3 leads + **Attendance widget** + **Recent Listings**. This is the "home" that becomes the new dashboard.
- `/leads` tab → `AllLeadsScreen` (full filterable list). Stays as the "View All" target.
- `/leads/[id]` → lead detail (actions already live here). Unchanged.
- Data layer: axios `apiClient`, react-query. Only `funnel-stats` + leads list wired so far.
- Design system: NativeWind v4 + Tailwind, semantic tokens, CVA atoms (`Card`, `Badge`, `Button`, `Text`, `Icon`, `Skeleton`, `EmptyState`, `Avatar`). `react-native-svg@15.12.1` installed (enables sparklines). Status/priority badge color maps already exist (`STATUS_BADGE_VARIANT`, `PRIORITY_BADGE_VARIANT`).

## Decisions (locked with user)

1. **Placement:** the current home (`LeadsScreen`, root `/` for staff) becomes the new unified Leads Dashboard. It owns all lead stats — single source of truth.
2. **Home extras:** keep the **Attendance widget**; **remove Recent Listings** from home.
3. **Stat depth:** **full parity** — all 6 KPI cards with sparkline + trend% arrows, plus Today's Priorities.
4. **Category nav:** **2×2 category cards grid** (Buy / Sell / Rent / Portal) with count badge, routing to stub screens.
5. **Actions:** **match web overview** — read + tap-through to `/leads/[id]`; `actionType` shown as a colored CTA chip (web's statusNextAction colors). No new inline status/assign modals on the dashboard this phase (those belong to the later list/board screens).

## Screen layout (vertical scroll)

```
┌──────────────────────────────────────────────┐
│ Header: "Leads"  ·  [ date-range chip ▾ ]     │
├──────────────────────────────────────────────┤
│ KPI grid — 6 cards, 2 columns                 │
│   ┌ New 24  ▲12% ╱╲╱ ┐ ┌ Contacted 18 ▼4% ╲╱ ┐│
│   ... Qualified · Viewing · Closed · Lost      │
├──────────────────────────────────────────────┤
│ Today's Priorities                            │
│   • avatar  Ali Khan   reason…   [Contact Now]│
│             AED 2.1M  (thumb)                 │
│   • Sara …                       [Follow Up]  │
├──────────────────────────────────────────────┤
│ Browse by category   (2×2)                    │
│   [ Buy   42 ] [ Sell  18 ]                    │
│   [ Rent  30 ] [ Portal  9 ]                   │
├──────────────────────────────────────────────┤
│ Recent leads (3)              View All →       │
│   LeadCard × 3                                 │
├──────────────────────────────────────────────┤
│ Attendance widget (kept, unchanged)           │
└──────────────────────────────────────────────┘
```

No kanban — drag-drop does not port to mobile. Pipeline data (`pipelineCounts`) feeds the KPI/category counts, not a board.

## Components (new, under `src/features/leads/`)

| Component              | Responsibility                                                                                                          | Source                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `LeadsDashboardScreen` | Orchestrates sections, pull-to-refresh, loading/error/empty, permission gate. Replaces the leads body of `LeadsScreen`. | `useLeadsOverview`    |
| `KpiGrid`              | 2-col grid of `KpiCard` from `overview.kpis`                                                                            | `overview.kpis`       |
| `KpiCard`              | count, label, trend% with up/down/flat arrow + color, embedded `Sparkline`                                              | one `Kpi`             |
| `Sparkline`            | tiny `react-native-svg` `Polyline` normalized to card width; color by trend direction                                   | `number[]`            |
| `TodaysPriorities`     | section wrapper + empty/loading; renders `PriorityRow[]` ranked by `conditionRank`                                      | `overview.priorities` |
| `PriorityRow`          | avatar, name, reason, optional property price/thumb, `actionType` CTA chip; whole row taps → `/leads/[id]`              | one `PriorityItem`    |
| `CategoryCardsGrid`    | 2×2 grid of `CategoryCard`                                                                                              | counts (below)        |
| `CategoryCard`         | icon + label + count badge; `router.push` to stub route                                                                 | one category          |

**Reused unchanged:** `RecentLeadsSection`, `LeadCard`, `StatTile`, `Card`, `Badge`, `Button`, `Text`, `Icon`, `Avatar`, `Skeleton`, `EmptyState`, Attendance widget.

**Removed from home:** Recent Listings section.

## Data layer

`src/features/leads/services.ts`:

- `getLeadsOverview(params: LeadsOverviewQuery): Promise<LeadsOverview>` → `GET /leads/overview`
- `getPortalOverview(params?): Promise<PortalOverview>` → `GET /leads/portal-overview` (for Portal category count)

`src/features/leads/use-leads.ts` (or `use-leads-overview.ts`):

- `useLeadsOverview(range?: DateRange)` — key `['leads','overview', params]`, `staleTime` per existing default, decrypt priority contacts if present.
- `usePortalOverview()` — key `['leads','portal-overview']`, used for Portal card count only.

`src/features/leads/types.ts` — add:

```ts
type KpiTrend = { percent: number; direction: 'up' | 'down' | 'flat'; sparkline: number[] };
type Kpi = { key: string; label: string; count: number; trend: KpiTrend };
type TabCount = { key: string; label: string; count: number };
type PipelineCount = { status: LeadStatus; count: number };
type PriorityProperty = { thumbnailUrl?: string | null; price?: number | null };
type PriorityItem = {
  leadId: string;
  name: string;
  avatarUrl?: string | null;
  reason: string;
  conditionRank: number;
  actionType: string;
  property?: PriorityProperty | null;
};
type LeadsOverview = {
  kpis: Kpi[];
  tabCounts: TabCount[];
  pipelineCounts: PipelineCount[];
  priorities: PriorityItem[];
};
type PortalOverview = {
  channelCounts: { all: number; whatsapp: number; calls: number; emails: number };
  cards: TabCount[];
};
```

**Category counts source:**

- Buy / Sell / Rent → from `overview.tabCounts` (keyed by intent bucket). If `tabCounts` keys don't carry buy/sell/rent, fall back to one lightweight `GET /leads?intentBucket=…&limit=1` per bucket reading `total`. Resolve exact key shape during implementation by inspecting a live `overview` response.
- Portal → `portalOverview.channelCounts.all`.

`funnel-stats` / `useFunnelStats` removed from the home/dashboard path (overview supersedes). Leave the service function in place if other screens use it; otherwise delete.

## Routing — navigation placeholders

Register in `app/(app)/_layout.tsx`, add files:

```
app/(app)/leads/buy.tsx
app/(app)/leads/sell.tsx
app/(app)/leads/rent.tsx
app/(app)/leads/portal.tsx
```

Each: back-header + `EmptyState` ("Coming soon — Buy/Sell/Rent/Portal leads"). `CategoryCard` deep-links here via `router.push('/leads/buy')` etc. Real list/board impl is a later phase; these stubs make deep-links and the dashboard nav work now.

## States & parity details

- **Loading:** `Skeleton` placeholders for KPI grid (6) + priorities rows; category grid shows skeleton counts.
- **Error:** red banner + retry (existing pattern from `RecentLeadsSection` / `AllLeadsList`).
- **Empty priorities:** `EmptyState` ("No priorities right now").
- **Pull-to-refresh:** `RefreshControl` invalidates `['leads','overview']`, `['leads','portal-overview']`, and recent leads keys.
- **Trend arrow colors:** up = success, down = destructive, flat = muted.
- **actionType chip colors:** mirror web `statusNextAction` (Contact Now = destructive/red, Follow Up = info/blue, Convert to Deal = success/green, etc.).
- **Status/priority colors:** reuse existing `STATUS_BADGE_VARIANT` / `PRIORITY_BADGE_VARIANT`.
- **Permission gate:** keep existing `useRequirePermission([LEADS_READ, LEADS_READ_ALL])` behavior around the dashboard.
- **Contact decryption:** apply existing `decryptLeadContact` to any priority/recent contact fields.

## Out of scope (this phase)

- Buy / Sell / Rent / Portal list & board screens (stubs only).
- Inline status-change / assign / drag-drop on the dashboard.
- Date-range picker beyond a simple preset chip (full custom range can be a follow-up; ship with a sensible default + a couple presets).
- Charts beyond KPI sparklines.

## Verification (per project convention — no unit tests)

`tsc --noEmit` + lint clean; manual QA on device/simulator: dashboard renders with live data, KPIs + sparklines + trends correct vs web, priorities tap → detail, category cards route to stubs, recent + View All work, pull-to-refresh refetches, Attendance widget intact, Recent Listings gone, loading/error/empty states verified.
