# Buy / Sell / Rent / Portal Leads — Mobile Pages (Design)

**Date:** 2026-06-19
**Repo:** `boh-mobile`
**Branch:** `feat/leads-dashboard`
**Status:** Approved design → ready for implementation plan

## Goal

Make the four category nav cards (Buy, Sell, Rent, Portal) on the leads dashboard open real screens that port the value of the web pages `/my-account/manage-leads/{buy,sell,rent,portal}` in a mobile-native way. The web uses a drag-and-drop kanban; mobile replaces it with a **stage-chips + vertical list + move-sheet** pattern.

## Context

### Web (value source, `boh-lead-magnet`)

- **Intent subpages** (`IntentSubpage`, buy/sell/rent): header (title, board/list toggle, date range, create), **market tabs** (All Leads / Primary / Secondary = `hasLink` undefined/true/false), filter bar (search, assignment, priority, source, stage, assignee), **kanban board** (7 columns: New, Contacted, Qualified, Viewing, Working Deal, Closed Deal, Lost Deal) + **secondary panels** (Did Not Respond, Future Prospect, Unqualified), OR list view. Card: name, persona, property summary, budget, priority/overdue badge, assignee, source, next-action, last note, email/call/whatsapp. Drag = `PATCH /leads/{id}` `{status}`.
- **Portal page** (`PortalLeadsPage`): header, **channel tabs** (All / WhatsApp / Calls / Emails = `pfChannel` undefined/whatsapp/call/email, with counts), **4 summary cards**, filter bar (+ portal source, call outcome), portal table with adaptive columns. Portal source: Property Finder live; Bayut/Dubizzle deferred → "coming soon".
- Shared list endpoint `GET /leads` with params: `intentBucket`, `isPortal`, `hasLink`, `pfChannel`, `callOutcome`, `portalSource`, `status`, `search`, `priority`, `isAssigned`, `assigneeId`, `dateFrom/dateTo`, pagination.
- Portal overview `GET /leads/portal-overview` → `{ channelCounts:{all,whatsapp,calls,emails}, cards:[{key,label,count}] }`.

### Mobile (target, current state)

- `app/(app)/leads/{buy,sell,rent,portal}.tsx` exist as **stub screens** ("coming soon" `EmptyState`). Routes registered.
- Dashboard category cards already deep-link to them.
- **Salvageable** (deleted in an earlier purge, recover from git `a514cb4^` and adapt): `StatusChangeSheet`, `AssignAgentSheet`, `LeadActionSheet`, `LeadsFilterSheet`, `ListView`, `use-board-leads`, `dashboard-filter.store`.
- **Surviving** backing hooks: `useUpdateLeadStatus` (`hooks/use-lead-mutations`), `use-update-lead`, `use-agents-list`, `useAllLeadsInfinite` (`hooks/use-all-leads`), `usePortalOverview` (`hooks/use-portal-overview`).
- `LeadCard` (`components/LeadCard.tsx`): renders name, masked email/phone, status + priority badges, segments, **call + chat** buttons, tap → `/leads/[id]`.
- `constants/board.ts`: `PRIMARY_STAGES` (New, Contacted, Qualified, Viewing_Scheduled, Working_Deal, Closed_Deal, Lost_Deal), `SECONDARY_STAGES` (Did_Not_Respond, Future_Prospect, Unqualified), `BOARD_STAGE_ORDER` = both.
- `LeadsQuery` currently has `intentBucket` but **not** `isPortal`, `hasLink`, `pfChannel`.

## Decisions (locked with user)

1. **Pipeline UX:** stage chips (horizontal, scrollable) filter a vertical list; move via bottom sheet. No kanban, no drag.
2. **Scope:** all 4 pages this phase — one shared screen for intent (buy/sell/rent), plus portal.
3. **Actions:** move-to-stage + assign + the card's existing call/chat. Tap card → detail for the rest.
4. **Filters:** full — filter sheet (priority, assignment, assignee) + market tabs (All/Primary/Secondary) for intent.
5. **Stage-chip counts:** labels only this phase (active filter shows "N leads" total). Per-chip count badges deferred (needs a backend stage-counts endpoint).
6. **Move → Viewing:** sets `status = Viewing_Scheduled` directly. No viewing-capture sheet this phase.

## Architecture

One config-driven shell, **`LeadsBrowseScreen`**, renders all 4 routes. Route files are thin wrappers passing a config:

```ts
type BrowseConfig =
  | { mode: 'intent'; intentBucket: 'buy' | 'sell' | 'rent'; title: string }
  | { mode: 'portal'; title: string };
```

- `app/(app)/leads/buy.tsx` → `<LeadsBrowseScreen config={{ mode:'intent', intentBucket:'buy', title:'Buy Leads' }} />` (sell/rent analogous).
- `app/(app)/leads/portal.tsx` → `<LeadsBrowseScreen config={{ mode:'portal', title:'Portal Leads' }} />`.

Filter/tab state is **local to the screen** via `useReducer` (no global store — 4 routes would collide):

```ts
interface BrowseState {
  search: string; // debounced before query
  stage: LeadStatus | null; // null = All
  marketTab: 'all' | 'primary' | 'secondary'; // intent only
  channelTab: 'all' | 'whatsapp' | 'calls' | 'emails'; // portal only
  portalSource: 'property_finder' | 'bayut' | 'dubizzle' | null; // portal only
  priority: LeadPriority | null;
  assignment: 'all' | 'assigned' | 'unassigned';
  assigneeId: string | null;
}
```

## Layout — intent (buy/sell/rent)

```
‹ Back   Buy Leads                         [Filters ⚙ (n)]
[ All | Primary | Secondary ]                    ← MarketTabs (hasLink)
🔍 search…
[All][New][Contacted][Qualified][Viewing][Working][Closed][Lost][DNR][Future][Unqual]  ← StageChips
┌ LeadCard … 📞 💬 ⋮ ┐   (⋮ → LeadActionSheet: Move | Assign)
└ … infinite scroll …
                                                   (+ Create FAB → /leads/create)
```

## Layout — portal

```
‹ Back   Portal Leads                       [Filters ⚙ (n)]
[ All • | WhatsApp • | Calls • | Emails • ]       ← PortalChannelTabs + counts
┌All┐┌WhatsApp┐┌Calls┐┌Emails┐                    ← PortalSummaryCards (portal-overview.cards)
🔍 search…    [Source: Property Finder ▾]          ← Bayut/Dubizzle → "coming soon" message, empty list
[All][New][Contacted]…                            ← StageChips (same)
┌ LeadCard + portal pills (source; channel; recording on Calls) … ⋮ ┐
```

## Components

**New** (`src/features/leads/components/browse/`):
| Component | Responsibility |
|---|---|
| `LeadsBrowseScreen` | Shell: header, tabs, search, chips, list (FlatList infinite), FAB, sheet orchestration, `useReducer` filter state |
| `StageChips` | Horizontal scroll of `All` + `BOARD_STAGE_ORDER` chips; selecting sets `stage` |
| `MarketTabs` | All / Primary / Secondary segmented (intent mode) |
| `portal/PortalChannelTabs` | All / WhatsApp / Calls / Emails + counts (from `usePortalOverview().channelCounts`) |
| `portal/PortalSummaryCards` | 4 cards from `usePortalOverview().cards` |
| `portal/PortalSourceFilter` | Dropdown: Property Finder (live) / Bayut / Dubizzle (deferred) |

**Resurrect from `a514cb4^` + adapt** (into `browse/`):
| Component | Adaptation |
|---|---|
| `LeadActionSheet` | Card `⋮` → actions **Move** + **Assign** (drop Add-note) |
| `StatusChangeSheet` | Move-to-stage; **simplify**: remove `onNeedViewing` handoff — `Viewing_Scheduled` sets status directly |
| `AssignAgentSheet` | Assign agent (uses `use-agents-list` + update) |
| `LeadsFilterSheet` | Keep priority + assignment + assignee; drop unused controls |

**Reuse / modify:** `LeadCard` — add optional `onKebab?: (lead) => void`; when present render a `⋮` button that calls it. Existing call/chat buttons stay.

## Data layer

- `types.ts` — extend `LeadsQuery`:
  ```ts
  isPortal?: boolean;
  hasLink?: boolean;
  pfChannel?: 'whatsapp' | 'call' | 'email';
  ```
  Add `BrowseConfig` and `BrowseState` types (above).
- New hook `use-browse-leads.ts`:
  ```ts
  export function useBrowseLeads(config: BrowseConfig, state: BrowseState) {
    // builds LeadsQuery from config + state, infinite query keyed on both
  }
  ```
  Param mapping:
  - intent: `intentBucket` = config.intentBucket; `hasLink` = marketTab → undefined/`true`/`false`; `status` = state.stage ?? undefined.
  - portal: `isPortal: true`; `pfChannel` = channelTab → undefined/`whatsapp`/`call`/`email`; `portalSource` = state.portalSource ?? undefined.
  - both: `search` (debounced), `priority`, `isAssigned` (assignment → undefined/`true`/`false`), `assigneeId`, `status`.
  - Built on the `useAllLeadsInfinite` pattern (PAGE_SIZE 20, `getNextPageParam`).
- Move: existing `useUpdateLeadStatus`. Assign: existing assign mutation + `use-agents-list`.
- Portal counts/cards: existing `usePortalOverview(params)` (params from channelTab/source/search).

## States & behavior

- **Loading:** list shows `ActivityIndicator`; portal summary cards show "—" while loading.
- **Empty:** `EmptyState` ("No leads in this stage"). Deferred portal source (Bayut/Dubizzle) → distinct "This portal isn't connected yet" message, empty list.
- **Error:** red banner + retry (existing list pattern).
- **Pagination:** infinite scroll (`onEndReached`), footer spinner.
- **Pull-to-refresh:** invalidates the browse query (+ portal-overview on portal).
- **Move success:** sheet closes, list + relevant queries invalidate so the lead reflects the new stage.
- **Permissions:** Assign gated by `leads:assign`-equivalent (`useCan`); call/chat already gated in `LeadCard`. Create FAB gated by `LEADS_CREATE`.
- Stage chip "New" maps to `status='New'` only (Re_opened appears under All) — acceptable for phase 1.

## Out of scope (phase 1)

Board/list toggle (list only), viewing-scheduler on move, date-range filter, notes/add-note sheet, per-chip count badges, Bayut/Dubizzle data (coming-soon only), portal call-recording playback (show indicator only).

## Verification (no test runner — project convention)

`pnpm exec tsc --noEmit` + `pnpm lint` clean; manual QA per route: chips filter the list, search works, market/channel tabs scope correctly, move-to-stage updates the lead, assign works, call/chat/tap-detail work, portal summary cards + counts render, deferred portal source shows coming-soon, infinite scroll + pull-to-refresh, empty/error/loading states.
