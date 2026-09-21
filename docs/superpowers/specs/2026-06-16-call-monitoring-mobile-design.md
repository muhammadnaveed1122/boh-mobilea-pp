# Call Monitoring — Mobile Feature Design

**Date:** 2026-06-16
**Repo:** `boh-mobile` (Expo Router, React Native 0.81, Expo SDK 54)
**Goal:** Full feature parity with the web `/my-account/call-monitoring` page, adapted to a mobile-native experience.

## Background

The web frontend (`boh-lead-magnet`) has a call-monitoring page at `/my-account/call-monitoring` built on RTK Query. It is a read-centric, data-heavy page: stats cards, source tabs, filters, a records table, and a slide-in detail panel with recording playback, callback, DNC management, and history/notes/transcript tabs. It also has CSV export.

The NestJS backend already exposes the full API surface at `/api/v1/call-service/*`, gated by the `calls:monitor` permission. **No backend work is required.** The mobile app consumes the same endpoints via its existing axios client (`src/lib/api.ts`), whose request interceptor auto-injects the Bearer token.

There is **no websocket for live call events** on the backend — web uses React Query polling. Mobile matches this, adding pull-to-refresh and refetch-on-focus.

## Decisions (confirmed with user)

- **Scope:** Full parity. CSV export retained via mobile share-sheet.
- **Navigation:** New bottom tab, gated by `calls:monitor`.
- **Detail view:** Full-screen push route (`calls/[uuid]`).
- **Real-time:** Polling + pull-to-refresh + refetch-on-focus (no socket).
- **Call back action:** Server callback mutation (`POST /call-service/calls/callback`), matching web — not on-device SIP dialer.
- **New dependencies:** `expo-audio`, `expo-file-system`, `expo-sharing` — approved.

## Backend API surface (consumed, no changes)

Global prefix `/api`, URI versioning `v1`. All require JWT + `calls:monitor` unless noted.

| Purpose                       | Method + Path                                     |
| ----------------------------- | ------------------------------------------------- |
| List call records (CDRs)      | `GET /api/v1/call-service/calls`                  |
| Call stats                    | `GET /api/v1/call-service/calls/stats`            |
| Recording stream (audio blob) | `GET /api/v1/call-service/calls/:uuid/recording`  |
| Initiate callback             | `POST /api/v1/call-service/calls/callback`        |
| DNC batch check               | `GET /api/v1/call-service/dnc/check?phones=a,b,c` |
| DNC add                       | `POST /api/v1/call-service/dnc`                   |
| DNC remove                    | `DELETE /api/v1/call-service/dnc/:phone`          |

Query params forwarded to the call list/stats (proxied upstream, not validated by backend):
`from`, `to`, `agentExtension`, `direction`, `carrier`, `countryIso`, `source`, `search`, `limit`, `offset`.

The recording endpoint streams binary audio (`audio/wav` default) and requires the Bearer header — it cannot be fed to a player as a plain URL.

Callback body: `{ customerPhone: string; agentExtension: string; agentName?: string }`.
DNC add body: `{ phone: string; note?: string }`.

## Architecture

New self-contained feature module, separate from the existing `callService` SIP brain (which handles live calls, CallKeep, SIP.js). It may import shared enums from `callService/constants/call.ts` where they overlap, but owns its own data models, hooks, and components.

```
src/features/callMonitoring/
  models/
    call-record.ts      CallRecord interface (port from web)
    call-stats.ts       CallStats interface (port from web)
    query.ts            CallLogQuery, CallsListResponse
  services.ts           axios calls to /api/v1/call-service/*
  hooks/
    use-call-records.ts   useInfiniteQuery, page -> offset/limit
    use-call-stats.ts      global + filtered stats
    use-dnc-check.ts       batch check current page numbers
    use-recording-player.ts  download-then-play (see Recording)
    use-callback.ts        callback mutation
    use-dnc-mutations.ts   add / remove DNC
    use-call-export.ts     build CSV + share-sheet
  store/
    filter.store.ts      zustand (mirrors leads/store/filter.store.ts)
  utils/
    call-format.ts       port of web callLogFormat.ts
  constants.ts           PAGE_SIZE=20, source + outcome maps
  components/
    StatsRow.tsx
    SourceTabs.tsx
    FilterSheet.tsx
    CallList.tsx
    CallRecordCard.tsx
    RecordingButton.tsx
    detail/
      CallDetailHeader.tsx
      QuickActions.tsx
      FactsGrid.tsx
      SpeedToLeadCard.tsx
      DetailTabs.tsx        History / Notes / Transcript
```

### Routing & navigation

- Tab screen: `app/(app)/calls/index.tsx` → renders `<CallMonitoringScreen/>`, guarded by `useRequirePermission([PERMISSIONS.CALLS_MONITOR])`.
- Detail screen: `app/(app)/calls/[uuid].tsx` → full-screen push, slide animation (default).
- Add `CALLS_MONITOR = 'calls:monitor'` to `src/lib/rbac/permissions.ts`.
- Bottom tab is conditionally shown only when `useCan('calls:monitor')` is true. If `BottomTabBar` cannot filter items, render the tab unconditionally and let `useRequirePermission` redirect on deny (decide during implementation by inspecting `BottomTabBar`).

### Data layer

All requests use the existing `apiClient` (axios) — the interceptor injects auth and unwraps the `{ success, data }` envelope. React Query (`staleTime` 30s default, `refetchOnReconnect`).

- `use-call-records`: `useInfiniteQuery`, key `['call-records', serverFilters]`, `initialPageParam: 0` (offset), `limit: PAGE_SIZE`. Compute `getNextPageParam` from `total` vs accumulated rows. Normalize response across `records | rows | data` and `total | count` (web does this).
- `use-call-stats`: two queries — one **global** (no source filter) to drive tab counts, one **scoped** by the active source tab to drive the stat cards.
- `use-dnc-check`: gather caller numbers on the current page into a comma-joined `phones` param; returns `Record<string, boolean>`.
- Client-side filters applied after fetch: `outcome`, `department` (parity with web). Server-side: `search`, `source`, `direction`, `agentExtension`, `from`, `to`.
- List: pull-to-refresh (`RefreshControl`) + `refetchOnFocus`.

### Screen UX (mobile adaptation)

The web table becomes a card `FlatList`.

- **StatsRow:** horizontal-scroll row of 4 KPI cards — Total calls, Connected, No answer, Avg talk time. Values from scoped stats query.
- **SourceTabs:** scrollable chip row — All Calls, Speed to Lead, Dialer, Reception, Webhook — with counts from the global stats `by_source`.
- **Search + Filters:** header search input debounced 300ms (reuse `useDebouncedValue`, mirroring `AllLeadsScreen`). A "Filters" button opens `FilterSheet` (`BottomSheetModal`) holding department, agent, direction, outcome, and date range (reuse the `DatePicker` atom). Applying updates the filter store, re-running queries.
- **CallRecordCard:** one card per record collapsing the web columns: direction icon, contact (callerIdName / callerIdNumber), agent + team, outcome badge, source badge, date/time, duration, and an inline `RecordingButton`. Tap → push detail route.
- **States:** skeleton rows while loading, `EmptyState` when no records, error state with retry — reuse existing atoms.

### Recording playback

The audio endpoint requires the Bearer header, so it cannot be passed to a player as a URL. Mirror the web blob approach:

1. `apiClient.get('/call-service/calls/:uuid/recording', { responseType: 'arraybuffer' })` — auth injected automatically.
2. Write the bytes to a temp file via `expo-file-system`.
3. Play the local file with `expo-audio` (`useAudioPlayer`).
4. The hook exposes `{ toggle(uuid), playingId, loadingId, error }` — same contract as the web `useCallRecordingPlayer`. Only one recording plays at a time; toggling another stops the current.

### Detail screen (`calls/[uuid]`)

Hydrate the record from the React Query cache (or refetch by uuid if missing).

- **CallDetailHeader:** contact name/number, direction, outcome badge.
- **QuickActions:** Call back (callback mutation — rings agent extension, then bridges customer), Copy number (clipboard), DNC toggle (add/remove mutation with optimistic local state). Call back resolves the current user's agent extension from auth/SIP config.
- **FactsGrid:** date/time, duration, source, outcome, agent, department, campaign, direction.
- **SpeedToLeadCard:** rendered only when `source === 'speed_to_lead'` — STL trigger, lead name, number, agent dialled.
- **Recording:** play/stop via the same recording hook.
- **DetailTabs** (`Tabs` atom): History (prior calls with the same contact number via a filtered `use-call-records` query), Notes, Transcript. Notes/Transcript render from record fields when present, otherwise an empty state.

### Export

The web CSV export becomes a mobile share-sheet: build a CSV string from the current filtered records, write a temp file via `expo-file-system`, and present it with `expo-sharing`. Triggered from an action in the screen header.

## Data models (ported from web)

`CallRecord`, `CallStats`, `CallLogQuery`, `CallsListResponse` are ported verbatim from `boh-lead-magnet/src/features/callService/api/callServiceApi.ts` into `callMonitoring/models/`. The format utilities (`formatDuration`, `formatDateTime`, `displayNumber`, `outcomeBadge`, `initials`, `sourceLabel`, `sourceBadgeCls`, `campaignLabel`) are ported from `callLogFormat.ts` into `call-format.ts`, restyled to NativeWind semantic tokens.

## Permissions

- Add `CALLS_MONITOR = 'calls:monitor'` to the mobile `PERMISSIONS` map.
- Screen guarded by `useRequirePermission([PERMISSIONS.CALLS_MONITOR])`.
- Tab visibility gated by `useCan(PERMISSIONS.CALLS_MONITOR)`.

## Verification

Per project convention (no unit tests in boh-mobile): verify via `tsc --noEmit`, lint, and manual QA on device/simulator. Manual QA checklist:

- Tab appears only with `calls:monitor`; hidden/redirected otherwise.
- Records load, paginate on scroll, pull-to-refresh works, refetch on focus.
- Source tabs filter and show correct counts; stat cards update per tab.
- Search + each filter (dept, agent, direction, outcome, date range) apply correctly.
- Recording downloads and plays; only one at a time; loading + error states.
- Detail screen: callback initiates, copy number works, DNC toggle adds/removes, history tab lists prior calls, notes/transcript render or empty.
- CSV export opens the share-sheet with a valid file.

## Out of scope (v1)

- Live call websocket updates (backend has none).
- Calling governance / policy screens (`calls:manage`).
- Editing notes/transcript (read-only display).

## Open implementation-time decisions

- Whether `BottomTabBar` supports conditional item rendering, or the tab is always present with a redirect guard.
- Source of the agent extension for callback (auth profile vs SIP config hook) — confirm during implementation.
