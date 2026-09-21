# Mobile Call Logs — Design Spec

**Date:** 2026-06-16
**Repo:** `boh-mobile` (Expo Router, React Native 0.81, Expo SDK 54)
**Goal:** Port the web call-logs page (`/my-account/speed-to-lead/calls`) to mobile with native design language and identical permission gating.

---

## 1. Summary

Add a permission-gated **Calls** screen to the mobile app that mirrors the web Speed-to-Lead call logs page at full feature parity, adapted to mobile patterns:

- Scrollable list of call cards (avatar + stacked layout) with search + bottom-sheet filters + stats header.
- Tap a card → full-screen call detail (sticky header + recording player + AI summary + segmented Transcript/Notes/History tabs + agent feedback).
- Recording playback, agent feedback submission, CSV export via share sheet, long-press multi-select.

Reuses the existing backend API unchanged. Reuses the existing mobile RBAC module — the permission code already exists.

### Locked decisions (from brainstorming)

| Decision      | Choice                                                                        |
| ------------- | ----------------------------------------------------------------------------- |
| Feature scope | **Full parity** with web (incl. CSV export + bulk select)                     |
| Entry point   | **New gated bottom tab** "Calls"                                              |
| Filters UX    | **Bottom-sheet filter panel** + always-visible search + active-filter pills   |
| List card     | **Layout A** — avatar + stacked (richest)                                     |
| Detail screen | **Layout A** — sticky header + recording player + AI summary + segmented tabs |
| Audio library | **`expo-audio`** (current SDK 54 API; `expo-av` deprecated)                   |

---

## 2. Backend / API (no changes)

Reuse the web endpoints exactly. Base path `/api/v1`. Auth header auto-injected by `apiClient` ([src/lib/api.ts](../../../src/lib/api.ts)).

| Method | Endpoint                                 | Purpose                                                                                                                                             |
| ------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/speed-to-lead/calls`                   | Paginated call logs. Params: `page`, `perPage`, `search`, `widgetId`, `agentId`, `status`, `dateFrom`. Response `{ items: Call[], total: number }`. |
| GET    | `/speed-to-lead/calls/:leadId/recording` | Audio blob (bearer-auth).                                                                                                                           |
| POST   | `/speed-to-lead/calls/:leadId/feedback`  | Submit agent feedback `{ feedback, note }`.                                                                                                         |

Call detail (transcript / live notes / AI summary / call history) is served by the same calls data on web via `CallDetail`. **Confirm during implementation** whether detail comes from the list payload or a dedicated `GET /speed-to-lead/calls/:leadId` endpoint; web's `useCallDrawer` is the source of truth. If no detail endpoint exists, detail is hydrated from the list item + history is fetched per-lead.

### Permission / scoping

- Guard: `speed-to-lead:read` (backend `@RequirePermission('speed-to-lead:read')` on all three endpoints).
- **No data scoping** — any authenticated user with `speed-to-lead:read` sees all call logs (matches web exactly). Do not add client-side filtering by user/org.

---

## 3. Module layout

New feature module mirrors the existing `features/leads/` structure.

```
src/features/speedToLead/calls/
  types.ts                      # Call, CallDetail, CallLead, CallAgent + enums (port from web call.ts)
  services/
    calls.api.ts                # getCallLogs, getCallDetail, getRecordingBlob, submitFeedback
  hooks/
    use-call-logs.ts            # useInfiniteQuery + debounced search + filter state
    use-call-detail.ts          # useQuery(leadId)
    use-recording-player.ts     # expo-audio player; auth'd download → cache → play
    use-call-feedback.ts        # useMutation + cache invalidation
    use-calls-export.ts         # build CSV + expo-file-system + expo-sharing
  components/
    CallsScreen.tsx             # FlatList host; sticky search; stats header; selection mode
    CallCard.tsx                # list card — layout A
    CallStatusBadge.tsx         # status pill + direction icon (port web CallStatusBadge)
    CallFiltersSheet.tsx        # bottom sheet: widget / agent / status / date pickers + apply/clear
    CallFilterPills.tsx         # active-filter chips below search
    CallStatsHeader.tsx         # Total / Answered / Missed / pickup-rate
  detail/
    CallDetailScreen.tsx        # layout A host
    CallDetailHeader.tsx        # avatar + lead + status badge + back nav
    RecordingPlayer.tsx         # play/pause + scrub bar + duration
    AiSummaryCard.tsx
    CallDetailTabs.tsx          # segmented control
    TranscriptTab.tsx           # speaker turns, searchable
    LiveNotesTab.tsx            # structured sections
    CallHistoryTab.tsx          # prior calls with this lead
    FeedbackChips.tsx           # select + submit agent feedback
```

Route files (Expo Router):

```
app/(app)/calls/index.tsx       # gated list screen
app/(app)/calls/[leadId].tsx    # gated detail screen
```

---

## 4. Navigation & permission gate

1. **Tab registration** — add to BottomTabBar config ([src/features/new-projects/components/BottomTabBar.tsx](../../../src/features/new-projects/components/BottomTabBar.tsx)):

   ```ts
   { key: 'calls', label: 'Calls', icon: 'Phone', href: '/calls' }
   ```

   Gate visibility with `useCan(PERMISSIONS.SPEED_TO_LEAD_READ)` — same mechanism as `canListings` / `canLeads`. Tab is hidden for users without the permission, so the "6 tabs" case only occurs for full-access users (acceptable).

2. **Route guard** — both route screens wrap content in `useRequirePermission([PERMISSIONS.SPEED_TO_LEAD_READ])` returning `loading | allowed | denied`. `denied` → denied view; `loading` → spinner. Mirrors web `<AuthGuard>` + backend 403.

3. **Permission code** — already present: `PERMISSIONS.SPEED_TO_LEAD_READ = 'speed-to-lead:read'` ([src/lib/rbac/permissions.ts:159](../../../src/lib/rbac/permissions.ts#L159)). No additions needed.

---

## 5. Types (`types.ts`)

Port directly from web `features/speed-to-lead/calls/types/call.ts`:

```ts
enum CallStatus {
  IncomingAnswered = 'incoming_answered',
  IncomingDeclined = 'incoming_declined',
  IncomingMissed = 'incoming_missed',
  OutgoingAnswered = 'outgoing_answered',
  OutgoingDeclined = 'outgoing_declined',
  OutgoingMissed = 'outgoing_missed',
}
enum CallHungUpBy {
  Agent = 'agent',
  Lead = 'lead',
}
enum AgentFeedback {
  ScheduledDemoMeeting = 'scheduled_demo_meeting',
  PartialCall = 'partial_call',
  NotInterested = 'not_interested',
  FollowUpRequired = 'follow_up_required',
  WrongNumber = 'wrong_number',
}
interface CallLead {
  name: string;
  email: string;
  phone: string;
  ip: string;
  isDnc: boolean;
  repeatCount?: number;
}
interface CallAgent {
  name: string;
  email: string;
  phone: string;
}
interface Call {
  id: string;
  widget: string;
  lead: CallLead;
  dateTime: string;
  status: CallStatus;
  hungUpBy: CallHungUpBy | null;
  duration: number;
  referrer: string;
  agent: CallAgent | null;
  agentFeedback: AgentFeedback | null;
  agentFeedbackNote: string;
  hasRecording: boolean;
}
interface CallDetail extends Call {
  rating: number;
  transcript: TranscriptEntry[];
  liveNotes: StructuredLiveNotes;
  aiSummary: StructuredAiSummary;
  callHistory: CallHistoryEntry[];
}
```

---

## 6. List screen (`CallsScreen`)

- **FlatList** with heterogeneous header rows (follow `AllLeadsList` pattern): sticky search bar + filter button + active-filter pills + stats header, then call cards.
- **CallCard (layout A):** avatar (lead initials), name + DNC tag, phone; second line widget · date · duration; agent line; feedback line (color-coded); inline action buttons (Redial, Recording if `hasRecording`, Details). Tap card → detail. Long-press → enter selection mode.
- **Search:** debounced 500ms → `search` param.
- **Filters:** "Filters" button opens `CallFiltersSheet` (bottom sheet) with widget / agent / status dropdowns + date picker + Apply/Clear. Applied filters render as removable pills.
- **Pagination:** `useInfiniteQuery`; `getNextPageParam` returns next page while `loadedItems < total`. `onEndReached` → `fetchNextPage`. `RefreshControl` → refetch.
- **States:** loading skeleton/spinner, empty ("No calls found"), error box with retry (reuse leads styling).

### Stats header (`CallStatsHeader`)

Total Calls / Answered / No Answer / Missed + pickup-rate(s). Sourced from response metadata if present, else derived client-side from loaded items (note: derived stats reflect loaded pages only — prefer server-provided totals; flag if backend lacks them).

---

## 7. Detail screen (`CallDetailScreen`, layout A)

Top→bottom, single screen:

1. **Sticky header** — back nav, avatar, lead name + phone + widget, status badge.
2. **RecordingPlayer** — visible when `hasRecording`. Play/pause, scrub bar, elapsed/total. See §8.
3. **AiSummaryCard** — AI summary text + sentiment; copy button.
4. **Segmented tabs** — Transcript | Notes | History; swaps content below in place (no navigation).
   - **TranscriptTab:** speaker turns w/ timestamps, in-tab search.
   - **LiveNotesTab:** structured heading + bullet sections.
   - **CallHistoryTab:** prior calls w/ this lead (status icon, time, duration, date).
5. **FeedbackChips** — selectable agent-feedback options + optional note; submit → mutation.

Data via `useQuery(['stl-call', leadId])`. See §2 note on detail data source.

---

## 8. Recording playback (`use-recording-player`)

- Recording is bearer-auth protected → cannot pass a bare URL to the player.
- Flow: `apiClient.get('/speed-to-lead/calls/:leadId/recording', { responseType: 'blob'/'arraybuffer' })` → write bytes to cache file via `expo-file-system` → load file URI into `expo-audio` player → play/pause/seek.
- States: loading spinner while downloading, error message if unavailable (mirror web `useRecordingPlayer`). Clean up cached file / unload player on unmount.
- **New deps:** `expo-audio`, `expo-file-system`.

---

## 9. CSV export (`use-calls-export`)

- Long-press a card → selection mode; checkboxes + select-all in header; selection in screen state.
- Export action → build CSV string (web columns: #, Widget, Lead Name, Email, Phone, IP, Date & Time, Status, Duration, Referrer, Agent, Feedback) → write temp file via `expo-file-system` → open share sheet via `expo-sharing`.
- **New dep:** `expo-sharing` (+ `expo-file-system` from §8).

---

## 10. Feedback submission (`use-call-feedback`)

- `useMutation` → POST `/speed-to-lead/calls/:leadId/feedback` `{ feedback, note }`.
- On success invalidate `['stl-calls']` and `['stl-call', leadId]` (RTK `STL_CALLS` tag equivalent on web).
- Optimistic update optional; default to invalidate-on-success.

---

## 11. Styling

- NativeWind v4 + semantic theme tokens (`bg-background`, `text-foreground`, etc.) — no hard-coded hex.
- Reuse atoms/molecules: Button, Text (variants), Icon (Lucide), Avatar, Card.
- Status badge colors map to web: incoming-answered green, declined/missed red/orange, outgoing blue.

---

## 12. New dependencies

| Package            | Use                                       |
| ------------------ | ----------------------------------------- |
| `expo-audio`       | recording playback (SDK 54)               |
| `expo-file-system` | cache recording blob; write CSV temp file |
| `expo-sharing`     | CSV share sheet                           |

Install via `npx expo install` to get SDK-compatible versions. Note `pnpm nodeLinker: hoisted` gotcha for native modules — rebuild dev client after install.

---

## 13. Testing / verification

Per project rule (no unit tests in boh-mobile): **no test runner.** Verify via:

- `tsc --noEmit` (type-check)
- eslint
- Manual QA on device/simulator: tab visibility per permission, list paging/search/filters, detail tabs, recording playback, feedback submit, CSV share, denied-permission path.

---

## 14. Out of scope (v1)

- Realtime/WebSocket call updates (web is polling-only; not added).
- New backend endpoints (reuse existing; add detail endpoint only if web already relies on one).
- Push notification on new call log.

---

## 15. Implementation order (high level)

1. Deps install + types port.
2. API service layer + hooks (`use-call-logs`).
3. List screen + card + status badge + states.
4. Filters sheet + pills + stats header.
5. Tab registration + route guards.
6. Detail screen + tabs + data hook.
7. Recording player.
8. Feedback submission.
9. CSV export + selection mode.
10. Type-check + lint + manual QA pass.
