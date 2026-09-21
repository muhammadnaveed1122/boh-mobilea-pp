# Mobile Call Logs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the web Speed-to-Lead call logs page to the mobile app at full feature parity with native mobile UX and identical permission gating.

**Architecture:** New feature module `src/features/speedToLead/calls/` mirroring `features/leads/`. List + recording + feedback hit the real backend (`/api/v1/speed-to-lead/calls`); stats header and detail-tab content (transcript / live notes / AI summary / call history) are client-side **mock**, ported verbatim from web (web does the same — backend has no detail/stats endpoints yet). New gated bottom tab "Calls" → list screen → push to detail screen.

**Tech Stack:** Expo Router, TanStack Query v5 (`useInfiniteQuery`), Zustand, NativeWind v4, `@gorhom/bottom-sheet`, `@react-native-community/datetimepicker`, `expo-audio`, `expo-file-system`, `expo-sharing`, Lucide icons.

> **Verification model:** This repo has **no test runner** (per `CLAUDE.md` + project rule). Do NOT write unit tests or TDD steps. Each task verifies via `pnpm exec tsc --noEmit`, `pnpm lint`, and a manual-QA checkpoint, then commits.

> **Source-of-truth files to port from (web repo `/Users/nabeel.ahmed/Desktop/Projects/boh/boh-lead-magnet`):**
>
> - Types: `src/features/speed-to-lead/calls/models/call.ts`
> - Constants/mock: `src/features/speed-to-lead/calls/constants/callsConstants.ts`
> - Status badge: `src/features/speed-to-lead/calls/components/CallStatusBadge.tsx`
> - Format fns: `src/features/speed-to-lead/calls/components/CallsTable.tsx:49-66`, `CallDrawer.tsx:41-85`
> - Recording/feedback/CSV: `hooks/useRecordingPlayer.ts`, `api/callsApi.ts`, `hooks/useCallsTable.ts:152-193`

---

## File Structure

**Create:**

```
src/features/speedToLead/calls/
  types.ts
  constants.ts                # mappings, labels, format fns, mock stats
  mock-detail.ts              # getMockCallDetail + TRANSCRIPTS_BY_LANGUAGE (ported)
  services/calls.api.ts       # getCallLogs, submitFeedback, getRecordingFileUri
  hooks/
    use-debounced-value.ts
    use-call-logs.ts
    use-call-detail.ts
    use-call-feedback.ts
    use-recording-player.ts
    use-calls-export.ts
  components/
    CallStatusBadge.tsx
    CallCard.tsx
    CallStatsHeader.tsx
    CallFilterPills.tsx
    CallFiltersSheet.tsx
    CallsScreen.tsx
  detail/
    CallDetailScreen.tsx
    RecordingPlayer.tsx
    AiSummaryCard.tsx
    CallDetailTabs.tsx
    TranscriptTab.tsx
    LiveNotesTab.tsx
    CallHistoryTab.tsx
    FeedbackChips.tsx
  store/selected-call.store.ts
app/(app)/calls/index.tsx
app/(app)/calls/[leadId].tsx
```

**Modify:**

- `src/features/new-projects/components/BottomTabBar.tsx` — add Calls tab + visibility
- `app/(app)/_layout.tsx` — register the two stack screens

---

## Task 0: Install dependencies

**Files:** `package.json` (via expo install)

- [ ] **Step 1: Install Expo native modules (SDK-pinned versions)**

Run:

```bash
cd /Users/nabeel.ahmed/Desktop/Projects/boh/boh-mobile
npx expo install expo-audio expo-file-system expo-sharing
```

Expected: `package.json` gains `expo-audio`, `expo-file-system`, `expo-sharing` at SDK 54-compatible versions. (`@gorhom/bottom-sheet@^5.2.14` and `@react-native-community/datetimepicker@8.4.4` are already present — do not reinstall.)

- [ ] **Step 2: Rebuild dev client (native modules added)**

Run: `npx expo prebuild --clean` is NOT needed for managed dev-client; instead rebuild the dev client:

```bash
npx expo run:ios   # or run:android
```

Expected: app boots with new native modules linked. (Note `pnpm nodeLinker: hoisted` — if metro can't resolve a native module, restart with `pnpm start -c`.)

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add expo-audio, expo-file-system, expo-sharing for call logs"
```

---

## Task 1: Types

**Files:** Create `src/features/speedToLead/calls/types.ts`

- [ ] **Step 1: Port the type module verbatim from web `models/call.ts`**

```ts
export enum CallStatus {
  IncomingAnswered = 'incoming_answered',
  IncomingDeclined = 'incoming_declined',
  IncomingMissed = 'incoming_missed',
  OutgoingAnswered = 'outgoing_answered',
  OutgoingDeclined = 'outgoing_declined',
  OutgoingMissed = 'outgoing_missed',
}

export enum CallHungUpBy {
  Agent = 'agent',
  Lead = 'lead',
}

export enum AgentFeedback {
  ScheduledDemoMeeting = 'scheduled_demo_meeting',
  PartialCall = 'partial_call',
  NotInterested = 'not_interested',
  FollowUpRequired = 'follow_up_required',
  WrongNumber = 'wrong_number',
}

export type CallTab = 'transcript' | 'liveNotes' | 'callHistory';

export interface CallLead {
  name: string;
  email: string;
  phone: string;
  ip: string;
  isDnc: boolean;
  repeatCount?: number;
}

export interface CallAgent {
  name: string;
  email: string;
  phone: string;
}

export interface TranscriptEntry {
  speaker: string;
  timestamp: string;
  text: string;
}

export interface CallHistoryEntry {
  id: string;
  dateTime: string;
  duration: number;
  status: CallStatus;
  agent: string;
  agentFeedback: AgentFeedback | null;
  isCurrent: boolean;
}

export interface Call {
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

export interface AiSummarySection {
  heading: string;
  items: string[];
}

export interface StructuredAiSummary {
  title: string;
  sections: AiSummarySection[];
  sentiment: string;
}

export interface LiveNotesSection {
  heading: string;
  lines: string[];
}

export interface StructuredLiveNotes {
  title: string;
  sections: LiveNotesSection[];
}

export interface CallDetail extends Call {
  rating: number;
  transcript: TranscriptEntry[];
  liveNotes: StructuredLiveNotes;
  aiSummary: StructuredAiSummary;
  callHistory: CallHistoryEntry[];
}

export interface CallStats {
  totalCalls: number;
  noAnswer: number;
  answered: number;
  missed: number;
}

export interface CallPickupRates {
  agentsPickupRate: number;
  clientsPickupRate: number;
  agentsAvgPickupTime: number;
  clientsAvgPickupTime: number;
}

export interface CallLogsResponse {
  items: Call[];
  total: number;
}

export interface CallLogsQuery {
  page?: number;
  perPage?: number;
  search?: string;
  widgetId?: string;
  agentId?: string;
  status?: string;
  dateFrom?: string;
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/features/speedToLead/calls/types.ts
git commit -m "feat(calls): add call log types"
```

---

## Task 2: Constants, mappings, format helpers

**Files:** Create `src/features/speedToLead/calls/constants.ts`

Mobile uses semantic theme tokens, NOT web hex. Map status colors to existing Badge `*Soft` variants and theme tokens.

- [ ] **Step 1: Write constants module**

```ts
import type { IconName } from '@/components/atoms/Icon';
import {
  AgentFeedback,
  CallHungUpBy,
  CallStatus,
  type CallPickupRates,
  type CallStats,
} from './types';

export const CALLS_PER_PAGE = 10;
export const SEARCH_DEBOUNCE_MS = 500;

export interface SelectOption {
  value: string;
  label: string;
}

export const CALL_STATUS_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All status' },
  { value: CallStatus.IncomingAnswered, label: 'Incoming Answered' },
  { value: CallStatus.IncomingDeclined, label: 'Incoming Declined' },
  { value: CallStatus.IncomingMissed, label: 'Incoming Missed' },
  { value: CallStatus.OutgoingAnswered, label: 'Outgoing Answered' },
  { value: CallStatus.OutgoingDeclined, label: 'Outgoing Declined' },
  { value: CallStatus.OutgoingMissed, label: 'Outgoing Missed' },
];

// Filter option lists — port the agent/widget options from web callsConstants.ts:33-46
// (AGENT_FILTER_OPTIONS, WIDGET_FILTER_OPTIONS). Copy values verbatim.
export const AGENT_FILTER_OPTIONS: SelectOption[] = [{ value: 'all', label: 'All agents' }];
export const WIDGET_FILTER_OPTIONS: SelectOption[] = [{ value: 'all', label: 'All widgets' }];

export const AGENT_FEEDBACK_LABELS: Record<AgentFeedback, string> = {
  [AgentFeedback.ScheduledDemoMeeting]: 'Scheduled Demo Meeting',
  [AgentFeedback.PartialCall]: 'Partial Call',
  [AgentFeedback.NotInterested]: 'Not Interested',
  [AgentFeedback.FollowUpRequired]: 'Follow Up Required',
  [AgentFeedback.WrongNumber]: 'Wrong Number',
};

// Feedback text color → semantic token class (web used hex; map to nearest token).
export const AGENT_FEEDBACK_COLOR_CLASS: Record<AgentFeedback, string> = {
  [AgentFeedback.ScheduledDemoMeeting]: 'text-success',
  [AgentFeedback.PartialCall]: 'text-warning',
  [AgentFeedback.NotInterested]: 'text-destructive',
  [AgentFeedback.FollowUpRequired]: 'text-info',
  [AgentFeedback.WrongNumber]: 'text-muted-foreground',
};

export type StatusTone = 'success' | 'destructive' | 'warning';

export interface StatusConfig {
  label: string;
  icon: IconName;
  tone: StatusTone; // success=green, destructive=red, warning=orange
}

// Mirrors web CallStatusBadge.tsx:44-89 (green=#039855, red=#D92D20, orange=#EC4A0A).
// Lucide icon names: PhoneIncoming, PhoneOutgoing, PhoneOff (declined), PhoneMissed (missed).
export function getStatusConfig(status: CallStatus): StatusConfig {
  switch (status) {
    case CallStatus.IncomingAnswered:
      return { label: 'Incoming Answered', icon: 'PhoneIncoming', tone: 'success' };
    case CallStatus.IncomingDeclined:
      return { label: 'Incoming Declined', icon: 'PhoneOff', tone: 'destructive' };
    case CallStatus.IncomingMissed:
      return { label: 'Incoming Missed', icon: 'PhoneMissed', tone: 'warning' };
    case CallStatus.OutgoingAnswered:
      return { label: 'Outgoing Answered', icon: 'PhoneOutgoing', tone: 'success' };
    case CallStatus.OutgoingDeclined:
      return { label: 'Outgoing Declined', icon: 'PhoneOff', tone: 'destructive' };
    case CallStatus.OutgoingMissed:
      return { label: 'Outgoing Missed', icon: 'PhoneMissed', tone: 'warning' };
  }
}

// Mirrors web CallStatusBadge.tsx:22-42
export function getHungUpLabel(status: CallStatus, hungUpBy: CallHungUpBy | null): string {
  if (!hungUpBy) return '';
  const party = hungUpBy === CallHungUpBy.Agent ? 'Agent' : 'Lead';
  switch (status) {
    case CallStatus.IncomingAnswered:
    case CallStatus.OutgoingAnswered:
      return `Hung up by ${party}`;
    case CallStatus.IncomingDeclined:
    case CallStatus.OutgoingDeclined:
      return `Declined by ${party}`;
    case CallStatus.IncomingMissed:
    case CallStatus.OutgoingMissed:
      return `Missed by ${party}`;
    default:
      return '';
  }
}

// Mirrors web CallsTable.tsx:49-66
export function formatDuration(seconds: number): string {
  if (seconds === 0) return '0';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${String(m)}m ${String(s)}s` : `${String(s)}s`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear());
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${year} ${hour}:${min}`;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// Mirrors web CallDrawer.tsx:60-85
export function formatHistoryTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatHistoryDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate())} ${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear())}`;
}

// Stats header is mock on web too (callsConstants.ts:247-259). Ported verbatim.
export const MOCK_CALL_STATS: CallStats = {
  totalCalls: 7,
  noAnswer: 1,
  answered: 4,
  missed: 2,
};

export const MOCK_PICKUP_RATES: CallPickupRates = {
  agentsPickupRate: 67,
  clientsPickupRate: 67,
  agentsAvgPickupTime: 7.8,
  clientsAvgPickupTime: 4.5,
};

export const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
```

- [ ] **Step 2: Verify Lucide icon names exist**

Run: `node -e "const i=require('lucide-react-native/dist/cjs/lucide-react-native.js'); console.log(['PhoneIncoming','PhoneOutgoing','PhoneOff','PhoneMissed'].map(n=>n+':'+!!i[n]))"`
Expected: all `true`. If `PhoneMissed` is absent in the installed version, substitute `'PhoneOff'` for missed and keep `tone:'warning'` for color distinction. Adjust `getStatusConfig` accordingly.

- [ ] **Step 3: Type-check + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS. (`IconName` import resolves from `@/components/atoms/Icon`; if the type isn't exported there, add `export type IconName = keyof typeof icons;` in that file in a separate small commit.)

- [ ] **Step 4: Commit**

```bash
git add src/features/speedToLead/calls/constants.ts
git commit -m "feat(calls): add constants, status mapping, format helpers"
```

---

## Task 3: Mock detail generator

**Files:** Create `src/features/speedToLead/calls/mock-detail.ts`

- [ ] **Step 1: Port `TRANSCRIPTS_BY_LANGUAGE` and `getMockCallDetail` verbatim**

Copy the following ranges from web `constants/callsConstants.ts` into `mock-detail.ts`, fixing imports to `./types`:

- The mock transcript arrays + `TRANSCRIPTS_BY_LANGUAGE` map (lines **279–608**).
- `getMockCallDetail` (lines **610–619**).
- `LANGUAGE_OPTIONS` (lines **48–55**).

The exported surface must be:

```ts
import type { Call, CallDetail, TranscriptEntry } from './types';
export const LANGUAGE_OPTIONS: { value: string; label: string }[]; // EN/AR/ES/FR/UR
export const TRANSCRIPTS_BY_LANGUAGE: Record<string, TranscriptEntry[] | undefined>;
export function getMockCallDetail(call: Call): CallDetail;
```

Do not alter the mock text — it must match web output exactly.

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/speedToLead/calls/mock-detail.ts
git commit -m "feat(calls): port mock call-detail generator from web"
```

---

## Task 4: API service layer

**Files:** Create `src/features/speedToLead/calls/services/calls.api.ts`

Recording differs from web: mobile cannot use `URL.createObjectURL`. Download the authed blob to a cache file via `expo-file-system` and return the file URI for `expo-audio`.

- [ ] **Step 1: Write the service**

```ts
import * as FileSystem from 'expo-file-system';
import { apiClient } from '@/lib/api';
import { CONFIG } from '@/lib/config';
import { getAuthToken } from '@/lib/api'; // see Step 2 note
import type { CallLogsQuery, CallLogsResponse } from '../types';

const BASE = '/api/v1/speed-to-lead';

function cleanParams(q: CallLogsQuery): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== '' && v !== 'all') out[k] = String(v);
  }
  return out;
}

export async function getCallLogs(query: CallLogsQuery): Promise<CallLogsResponse> {
  const { data } = await apiClient.get<{ data: CallLogsResponse } | CallLogsResponse>(
    `${BASE}/calls`,
    { params: cleanParams(query) },
  );
  // Backend may wrap in { data } (web uses transformResponse). Normalize both shapes.
  return 'items' in data ? (data as CallLogsResponse) : (data as { data: CallLogsResponse }).data;
}

export async function submitFeedback(
  leadId: string,
  feedback: string,
  note?: string,
): Promise<void> {
  await apiClient.post(`${BASE}/calls/${leadId}/feedback`, { feedback, note: note ?? '' });
}

/** Downloads the bearer-auth recording to a cache file, returns its local URI. */
export async function getRecordingFileUri(leadId: string): Promise<string> {
  const token = getAuthToken();
  const target = `${FileSystem.cacheDirectory}call-recording-${leadId}.mp3`;
  const res = await FileSystem.downloadAsync(
    `${CONFIG.API_BASE_URL}${BASE}/calls/${leadId}/recording`,
    target,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (res.status === 404) throw new Error('Recording not available for this call.');
  if (res.status >= 400) throw new Error(`Could not load recording (${res.status}).`);
  return res.uri;
}
```

- [ ] **Step 2: Ensure an auth-token getter exists in `src/lib/api.ts`**

The interceptor uses an in-memory `_authToken`. `getRecordingFileUri` needs to read it for `downloadAsync` (which bypasses the axios interceptor). If `src/lib/api.ts` does not already export a getter, add:

```ts
export function getAuthToken(): string | null {
  return _authToken;
}
```

next to the existing `setAuthToken`. Verify the export name; adjust the import in Step 1 to match what exists.

- [ ] **Step 3: Type-check + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/speedToLead/calls/services/calls.api.ts src/lib/api.ts
git commit -m "feat(calls): add call logs api service (list, feedback, recording download)"
```

---

## Task 5: Hooks — debounce, list, detail, feedback

**Files:** Create `hooks/use-debounced-value.ts`, `hooks/use-call-logs.ts`, `hooks/use-call-detail.ts`, `hooks/use-call-feedback.ts`

- [ ] **Step 1: `use-debounced-value.ts`**

```ts
import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
```

- [ ] **Step 2: `use-call-logs.ts`**

```ts
import { useInfiniteQuery } from '@tanstack/react-query';
import { getCallLogs } from '../services/calls.api';
import { CALLS_PER_PAGE } from '../constants';
import type { CallLogsResponse } from '../types';

export interface CallFilters {
  search?: string;
  widgetId?: string;
  agentId?: string;
  status?: string;
  dateFrom?: string;
}

export function useCallLogsInfinite(filters: CallFilters) {
  return useInfiniteQuery<CallLogsResponse, Error>({
    queryKey: ['stl-calls', filters],
    queryFn: ({ pageParam }) =>
      getCallLogs({ ...filters, page: pageParam as number, perPage: CALLS_PER_PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? all.length + 1 : undefined;
    },
  });
}
```

- [ ] **Step 3: `use-call-detail.ts`** — builds CallDetail from the cached list Call (no network), mirroring web's mock approach.

```ts
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getMockCallDetail } from '../mock-detail';
import { useSelectedCall } from '../store/selected-call.store';
import type { Call, CallDetail, CallLogsResponse } from '../types';

export function useCallDetail(leadId: string): CallDetail | null {
  const qc = useQueryClient();
  const selected = useSelectedCall((s) => s.call);
  return useMemo(() => {
    let call: Call | undefined = selected?.id === leadId ? selected : undefined;
    if (!call) {
      const queries = qc.getQueriesData<{ pages: CallLogsResponse[] }>({ queryKey: ['stl-calls'] });
      for (const [, data] of queries) {
        const found = data?.pages.flatMap((p) => p.items).find((c) => c.id === leadId);
        if (found) {
          call = found;
          break;
        }
      }
    }
    return call ? getMockCallDetail(call) : null;
  }, [qc, selected, leadId]);
}
```

- [ ] **Step 4: `use-call-feedback.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitFeedback } from '../services/calls.api';

export function useCallFeedback(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { feedback: string; note?: string }) =>
      submitFeedback(leadId, vars.feedback, vars.note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stl-calls'] }).catch(() => {});
    },
  });
}
```

- [ ] **Step 5: Type-check + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS (note: `use-call-detail` imports `selected-call.store`, created in Task 6 — if running tasks out of order, do Task 6 Step 1 first).

- [ ] **Step 6: Commit**

```bash
git add src/features/speedToLead/calls/hooks
git commit -m "feat(calls): add list/detail/feedback/debounce hooks"
```

---

## Task 6: Selected-call store + recording player + export hooks

**Files:** Create `store/selected-call.store.ts`, `hooks/use-recording-player.ts`, `hooks/use-calls-export.ts`

- [ ] **Step 1: `store/selected-call.store.ts`** (carries the tapped Call into the detail route)

```ts
import { create } from 'zustand';
import type { Call } from '../types';

interface SelectedCallState {
  call: Call | null;
  setCall: (call: Call | null) => void;
}

export const useSelectedCall = create<SelectedCallState>((set) => ({
  call: null,
  setCall: (call) => set({ call }),
}));
```

- [ ] **Step 2: `hooks/use-recording-player.ts`** (expo-audio)

```ts
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useState } from 'react';
import { getRecordingFileUri } from '../services/calls.api';

export function useRecordingPlayer(leadId: string) {
  const player = useAudioPlayer(); // empty source until loaded
  const status = useAudioPlayerStatus(player);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const toggle = useCallback(async () => {
    setError(null);
    if (status.playing) {
      player.pause();
      return;
    }
    if (loaded) {
      player.play();
      return;
    }
    setLoading(true);
    try {
      const uri = await getRecordingFileUri(leadId);
      player.replace({ uri });
      setLoaded(true);
      player.play();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [leadId, loaded, player, status.playing]);

  return {
    toggle,
    loading,
    error,
    playing: status.playing,
    position: status.currentTime ?? 0,
    duration: status.duration ?? 0,
  };
}
```

Note: confirm the `expo-audio` API surface (`useAudioPlayer`, `player.replace`, `useAudioPlayerStatus`) against the installed version's docs; adjust method names if the SDK 54 build differs.

- [ ] **Step 3: `hooks/use-calls-export.ts`**

```ts
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useCallback } from 'react';
import type { Call } from '../types';

// Columns mirror web useCallsTable.ts:152-193 exactly.
function buildCsv(calls: Call[]): string {
  const header = [
    '#',
    'Widget',
    'Lead Name',
    'Email',
    'Phone',
    'IP',
    'Date & Time',
    'Status',
    'Duration',
    'Referrer',
    'Agent',
    'Feedback',
  ].join(',');
  const rows = calls.map((c, i) =>
    [
      i + 1,
      `"${c.widget}"`,
      `"${c.lead.name}"`,
      `"${c.lead.email}"`,
      `"${c.lead.phone}"`,
      c.lead.ip,
      c.dateTime,
      c.status,
      c.duration,
      `"${c.referrer}"`,
      `"${c.agent?.name ?? ''}"`,
      c.agentFeedback ?? '',
    ].join(','),
  );
  return [header, ...rows].join('\n');
}

export function useCallsExport() {
  return useCallback(async (calls: Call[]) => {
    const csv = buildCsv(calls);
    const uri = `${FileSystem.cacheDirectory}calls-export.csv`;
    await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
      });
    }
  }, []);
}
```

- [ ] **Step 4: Type-check + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/speedToLead/calls/store src/features/speedToLead/calls/hooks
git commit -m "feat(calls): add selected-call store, recording player, csv export"
```

---

## Task 7: CallStatusBadge component

**Files:** Create `components/CallStatusBadge.tsx`

- [ ] **Step 1: Write component**

```tsx
import { View } from 'react-native';
import { Badge } from '@/components/atoms/Badge';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';
import { getStatusConfig, type StatusTone } from '../constants';
import type { CallStatus } from '../types';

const BADGE_VARIANT: Record<StatusTone, 'successSoft' | 'destructiveSoft' | 'warningSoft'> = {
  success: 'successSoft',
  destructive: 'destructiveSoft',
  warning: 'warningSoft',
};
const TEXT_CLASS: Record<StatusTone, string> = {
  success: 'text-success',
  destructive: 'text-destructive',
  warning: 'text-warning',
};
const TOKEN: Record<StatusTone, string> = {
  success: '--success',
  destructive: '--destructive',
  warning: '--warning',
};

export function CallStatusBadge({ status }: Readonly<{ status: CallStatus }>) {
  const { label, icon, tone } = getStatusConfig(status);
  const color = useThemeColor(TOKEN[tone]);
  return (
    <Badge variant={BADGE_VARIANT[tone]}>
      <View className="flex-row items-center gap-1">
        <Icon name={icon} size={13} color={color} />
        <Text className={`text-xs font-medium ${TEXT_CLASS[tone]}`}>{label}</Text>
      </View>
    </Badge>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS. (If `useThemeColor` isn't exported from `@theme`, import from its actual path per `theme/ThemeProvider.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add src/features/speedToLead/calls/components/CallStatusBadge.tsx
git commit -m "feat(calls): add CallStatusBadge"
```

---

## Task 8: CallCard component (layout A)

**Files:** Create `components/CallCard.tsx`

- [ ] **Step 1: Write component**

```tsx
import { Pressable, View } from 'react-native';
import { Avatar, AvatarFallback } from '@/components/atoms/Avatar';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { Card } from '@/components/molecules/Card';
import {
  AGENT_FEEDBACK_COLOR_CLASS,
  AGENT_FEEDBACK_LABELS,
  formatDateTime,
  formatDuration,
  initials,
} from '../constants';
import { CallStatusBadge } from './CallStatusBadge';
import type { Call } from '../types';

interface Props {
  call: Call;
  selected?: boolean;
  selectionMode?: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onRedial?: () => void;
  onPlayRecording?: () => void;
}

export function CallCard({
  call,
  selected,
  selectionMode,
  onPress,
  onLongPress,
  onRedial,
  onPlayRecording,
}: Readonly<Props>) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="mx-4 mb-2"
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
    >
      <Card className={`p-3 ${selected ? 'border-primary' : ''}`}>
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1 flex-row items-center gap-3">
            {selectionMode ? (
              <Icon name={selected ? 'CheckCircle2' : 'Circle'} size={22} />
            ) : (
              <Avatar alt={call.lead.name} className="h-9 w-9">
                <AvatarFallback>
                  <Text className="text-xs font-semibold">{initials(call.lead.name)}</Text>
                </AvatarFallback>
              </Avatar>
            )}
            <View className="flex-1">
              <View className="flex-row items-center gap-1">
                <Text className="font-semibold" numberOfLines={1}>
                  {call.lead.name}
                </Text>
                {call.lead.isDnc ? (
                  <View className="rounded bg-destructive/15 px-1">
                    <Text className="text-[9px] font-bold text-destructive">DNC</Text>
                  </View>
                ) : null}
              </View>
              <Text variant="muted" numberOfLines={1}>
                {call.lead.phone}
              </Text>
            </View>
          </View>
          <CallStatusBadge status={call.status} />
        </View>

        <Text variant="muted" className="mt-2" numberOfLines={1}>
          {call.widget} · {formatDateTime(call.dateTime)} · {formatDuration(call.duration)}
        </Text>
        {call.agent ? (
          <Text variant="muted" numberOfLines={1}>
            Agent: {call.agent.name}
          </Text>
        ) : null}
        {call.agentFeedback ? (
          <Text className={`mt-1 text-xs ${AGENT_FEEDBACK_COLOR_CLASS[call.agentFeedback]}`}>
            {AGENT_FEEDBACK_LABELS[call.agentFeedback]}
          </Text>
        ) : null}

        {!selectionMode ? (
          <View className="mt-2.5 flex-row gap-5">
            <Pressable className="flex-row items-center gap-1" onPress={onRedial}>
              <Icon name="RotateCw" size={14} />
              <Text className="text-xs text-primary">Redial</Text>
            </Pressable>
            {call.hasRecording ? (
              <Pressable className="flex-row items-center gap-1" onPress={onPlayRecording}>
                <Icon name="Play" size={14} />
                <Text className="text-xs text-primary">Recording</Text>
              </Pressable>
            ) : null}
            <Pressable className="flex-row items-center gap-1" onPress={onPress}>
              <Icon name="ChevronRight" size={14} />
              <Text className="text-xs text-primary">Details</Text>
            </Pressable>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS. (Verify Avatar's prop API against `src/components/atoms/Avatar.tsx`; adjust `alt`/`className` to match.)

- [ ] **Step 3: Commit**

```bash
git add src/features/speedToLead/calls/components/CallCard.tsx
git commit -m "feat(calls): add CallCard (avatar + stacked layout)"
```

---

## Task 9: Stats header + filter pills

**Files:** Create `components/CallStatsHeader.tsx`, `components/CallFilterPills.tsx`

- [ ] **Step 1: `CallStatsHeader.tsx`**

```tsx
import { View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { MOCK_CALL_STATS, MOCK_PICKUP_RATES } from '../constants';

function Stat({ label, value }: Readonly<{ label: string; value: string | number }>) {
  return (
    <View className="flex-1 rounded-lg bg-muted/40 p-3">
      <Text className="text-lg font-bold">{value}</Text>
      <Text variant="muted" className="text-xs">
        {label}
      </Text>
    </View>
  );
}

// NOTE: values are placeholder/mock (parity with web — no backend stats endpoint yet).
export function CallStatsHeader() {
  const s = MOCK_CALL_STATS;
  const r = MOCK_PICKUP_RATES;
  return (
    <View className="gap-2 px-4 pb-2">
      <View className="flex-row gap-2">
        <Stat label="Total" value={s.totalCalls} />
        <Stat label="Answered" value={s.answered} />
        <Stat label="No answer" value={s.noAnswer} />
        <Stat label="Missed" value={s.missed} />
      </View>
      <View className="flex-row gap-2">
        <Stat label="Agent pickup" value={`${r.agentsPickupRate}%`} />
        <Stat label="Client pickup" value={`${r.clientsPickupRate}%`} />
      </View>
    </View>
  );
}
```

- [ ] **Step 2: `CallFilterPills.tsx`**

```tsx
import { Pressable, ScrollView, View } from 'react-native';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';

export interface ActivePill {
  key: string;
  label: string;
}

interface Props {
  pills: ActivePill[];
  onRemove: (key: string) => void;
}

export function CallFilterPills({ pills, onRemove }: Readonly<Props>) {
  if (pills.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="px-4 pb-2"
      contentContainerClassName="gap-2"
    >
      {pills.map((p) => (
        <Pressable
          key={p.key}
          onPress={() => onRemove(p.key)}
          className="flex-row items-center gap-1 rounded-full bg-secondary px-3 py-1"
        >
          <Text className="text-xs">{p.label}</Text>
          <Icon name="X" size={12} />
        </Pressable>
      ))}
    </ScrollView>
  );
}
```

- [ ] **Step 3: Type-check + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/speedToLead/calls/components/CallStatsHeader.tsx src/features/speedToLead/calls/components/CallFilterPills.tsx
git commit -m "feat(calls): add stats header and active-filter pills"
```

---

## Task 10: Filters bottom sheet

**Files:** Create `components/CallFiltersSheet.tsx`

Uses `@gorhom/bottom-sheet` (installed) + `@react-native-community/datetimepicker` (installed).

- [ ] **Step 1: Write the sheet**

```tsx
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { forwardRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Button } from '@/components/atoms/Button';
import { Text } from '@/components/atoms/Text';
import { AGENT_FILTER_OPTIONS, CALL_STATUS_OPTIONS, WIDGET_FILTER_OPTIONS } from '../constants';
import type { CallFilters } from '../hooks/use-call-logs';

interface Props {
  value: CallFilters;
  onApply: (next: CallFilters) => void;
  onClear: () => void;
}

function OptionRow({
  options,
  selected,
  onSelect,
}: Readonly<{
  options: { value: string; label: string }[];
  selected?: string;
  onSelect: (v: string) => void;
}>) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const active = (selected ?? 'all') === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onSelect(o.value)}
            className={`rounded-full border px-3 py-1 ${active ? 'border-primary bg-primary/10' : 'border-border'}`}
          >
            <Text className={`text-xs ${active ? 'text-primary' : ''}`}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const CallFiltersSheet = forwardRef<BottomSheet, Props>(function CallFiltersSheet(
  { value, onApply, onClear },
  ref,
) {
  const [draft, setDraft] = useState<CallFilters>(value);
  const [showDate, setShowDate] = useState(false);

  return (
    <BottomSheet ref={ref} index={-1} snapPoints={['65%']} enablePanDownToClose>
      <BottomSheetView className="gap-4 px-4 pb-8">
        <Text variant="subheading">Filters</Text>

        <View className="gap-2">
          <Text variant="label">Status</Text>
          <OptionRow
            options={CALL_STATUS_OPTIONS}
            selected={draft.status}
            onSelect={(v) => setDraft((d) => ({ ...d, status: v === 'all' ? undefined : v }))}
          />
        </View>

        <View className="gap-2">
          <Text variant="label">Agent</Text>
          <OptionRow
            options={AGENT_FILTER_OPTIONS}
            selected={draft.agentId}
            onSelect={(v) => setDraft((d) => ({ ...d, agentId: v === 'all' ? undefined : v }))}
          />
        </View>

        <View className="gap-2">
          <Text variant="label">Widget</Text>
          <OptionRow
            options={WIDGET_FILTER_OPTIONS}
            selected={draft.widgetId}
            onSelect={(v) => setDraft((d) => ({ ...d, widgetId: v === 'all' ? undefined : v }))}
          />
        </View>

        <View className="gap-2">
          <Text variant="label">From date</Text>
          <Pressable
            onPress={() => setShowDate(true)}
            className="rounded-lg border border-border px-3 py-2"
          >
            <Text>{draft.dateFrom ?? 'Any date'}</Text>
          </Pressable>
          {showDate ? (
            <DateTimePicker
              value={draft.dateFrom ? new Date(draft.dateFrom) : new Date()}
              mode="date"
              onChange={(_e, date) => {
                setShowDate(Platform.OS === 'ios');
                if (date) setDraft((d) => ({ ...d, dateFrom: date.toISOString().slice(0, 10) }));
              }}
            />
          ) : null}
        </View>

        <View className="flex-row gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onPress={() => {
              setDraft({});
              onClear();
            }}
          >
            <Text>Clear</Text>
          </Button>
          <Button className="flex-1" onPress={() => onApply(draft)}>
            <Text>Apply</Text>
          </Button>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
});
```

- [ ] **Step 2: Confirm `GestureHandlerRootView` + `BottomSheetModalProvider` setup**

Check `app/_layout.tsx` wraps the tree in `GestureHandlerRootView` (required by gorhom). If absent, wrap the root there in a small separate commit. `BottomSheet` (not modal) does not require the provider, but gesture-handler root is mandatory.

- [ ] **Step 3: Type-check + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/speedToLead/calls/components/CallFiltersSheet.tsx
git commit -m "feat(calls): add filters bottom sheet"
```

---

## Task 11: CallsScreen (list host)

**Files:** Create `components/CallsScreen.tsx`

- [ ] **Step 1: Write the screen**

```tsx
import BottomSheet from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';
import { SEARCH_DEBOUNCE_MS } from '../constants';
import { useCallLogsInfinite, type CallFilters } from '../hooks/use-call-logs';
import { useCallsExport } from '../hooks/use-calls-export';
import { useDebouncedValue } from '../hooks/use-debounced-value';
import { useSelectedCall } from '../store/selected-call.store';
import { CallCard } from './CallCard';
import { CallFilterPills, type ActivePill } from './CallFilterPills';
import { CallFiltersSheet } from './CallFiltersSheet';
import { CallStatsHeader } from './CallStatsHeader';
import type { Call } from '../types';

type Row =
  | { kind: 'stats' }
  | { kind: 'error'; message: string }
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'call'; call: Call };

export function CallsScreen() {
  const brand = useThemeColor('--brand');
  const setSelected = useSelectedCall((s) => s.setCall);
  const exportCsv = useCallsExport();
  const sheetRef = useRef<BottomSheet>(null);

  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState<CallFilters>({});
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const debouncedSearch = useDebouncedValue(searchText, SEARCH_DEBOUNCE_MS);
  const effectiveFilters = useMemo<CallFilters>(
    () => ({ ...filters, search: debouncedSearch || undefined }),
    [filters, debouncedSearch],
  );

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useCallLogsInfinite(effectiveFilters);

  const calls = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  const pills = useMemo<ActivePill[]>(() => {
    const out: ActivePill[] = [];
    if (filters.status) out.push({ key: 'status', label: filters.status });
    if (filters.agentId) out.push({ key: 'agentId', label: 'Agent' });
    if (filters.widgetId) out.push({ key: 'widgetId', label: 'Widget' });
    if (filters.dateFrom) out.push({ key: 'dateFrom', label: filters.dateFrom });
    return out;
  }, [filters]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [{ kind: 'stats' }];
    if (isError) out.push({ kind: 'error', message: error?.message ?? 'Failed to load calls.' });
    if (calls.length === 0) out.push(isLoading ? { kind: 'loading' } : { kind: 'empty' });
    else for (const call of calls) out.push({ kind: 'call', call });
    return out;
  }, [calls, isError, error, isLoading]);

  const openDetail = (call: Call) => {
    setSelected(call);
    router.push(`/calls/${call.id}`);
  };

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleExport = async () => {
    await exportCsv(calls.filter((c) => selectedIds.has(c.id)));
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  return (
    <View className="flex-1 bg-background">
      <View className="gap-2 px-4 pb-2 pt-2">
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <Input
              placeholder="Search name, email, phone"
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>
          <Button variant="outline" size="icon" onPress={() => sheetRef.current?.expand()}>
            <Icon name="SlidersHorizontal" size={18} />
          </Button>
        </View>
      </View>

      <CallFilterPills
        pills={pills}
        onRemove={(key) => setFilters((f) => ({ ...f, [key]: undefined }))}
      />

      <FlatList
        data={rows}
        keyExtractor={(r, i) => (r.kind === 'call' ? r.call.id : `${r.kind}-${i}`)}
        renderItem={({ item }) => {
          switch (item.kind) {
            case 'stats':
              return <CallStatsHeader />;
            case 'error':
              return (
                <View className="mx-4 my-2 rounded-lg bg-destructive/10 p-3">
                  <Text className="text-destructive">{item.message}</Text>
                </View>
              );
            case 'loading':
              return (
                <View className="py-10">
                  <ActivityIndicator color={brand} />
                </View>
              );
            case 'empty':
              return (
                <View className="py-10">
                  <Text variant="muted" className="text-center">
                    No calls found.
                  </Text>
                </View>
              );
            case 'call':
              return (
                <CallCard
                  call={item.call}
                  selectionMode={selectMode}
                  selected={selectedIds.has(item.call.id)}
                  onPress={() => (selectMode ? toggleSelect(item.call.id) : openDetail(item.call))}
                  onLongPress={() => {
                    setSelectMode(true);
                    toggleSelect(item.call.id);
                  }}
                  onRedial={() => {}}
                  onPlayRecording={() => openDetail(item.call)}
                />
              );
          }
        }}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="py-6">
              <ActivityIndicator color={brand} />
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 120 }}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage().catch(() => {});
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={() => refetch().catch(() => {})}
            tintColor={brand}
          />
        }
      />

      {selectMode ? (
        <View className="absolute bottom-6 left-4 right-4 flex-row gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onPress={() => {
              setSelectMode(false);
              setSelectedIds(new Set());
            }}
          >
            <Text>Cancel</Text>
          </Button>
          <Button className="flex-1" disabled={selectedIds.size === 0} onPress={handleExport}>
            <Text>Export ({selectedIds.size})</Text>
          </Button>
        </View>
      ) : null}

      <CallFiltersSheet
        ref={sheetRef}
        value={filters}
        onApply={(next) => {
          setFilters(next);
          sheetRef.current?.close();
        }}
        onClear={() => {
          setFilters({});
          sheetRef.current?.close();
        }}
      />
    </View>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS. (Verify `Input` import path/props against `src/components/atoms/Input.tsx`. Cognitive-complexity: sonar caps at 20 — if `renderItem` trips it, extract a `CallRow` component.)

- [ ] **Step 3: Commit**

```bash
git add src/features/speedToLead/calls/components/CallsScreen.tsx
git commit -m "feat(calls): add CallsScreen list host with search, filters, selection, export"
```

---

## Task 12: List route + tab registration + stack screens

**Files:** Create `app/(app)/calls/index.tsx`; Modify `src/features/new-projects/components/BottomTabBar.tsx`, `app/(app)/_layout.tsx`

- [ ] **Step 1: Create the gated list route**

`app/(app)/calls/index.tsx`:

```tsx
import { Redirect } from 'expo-router';
import { CallsScreen } from '@/features/speedToLead/calls/components/CallsScreen';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';

export default function CallsRoute() {
  const state = useRequirePermission(PERMISSIONS.SPEED_TO_LEAD_READ);
  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/" />;
  return <CallsScreen />;
}
```

- [ ] **Step 2: Register stack screens** in `app/(app)/_layout.tsx` (add inside the `<Stack>`):

```tsx
<Stack.Screen name="calls/index" options={{ animation: 'none' }} />
<Stack.Screen name="calls/[leadId]" />
```

(Place `calls/index` alongside the other tab-root screens with `animation: 'none'`; leave `calls/[leadId]` with the default push slide.)

- [ ] **Step 3: Add the Calls tab** in `BottomTabBar.tsx`.

In `AUTHED_TABS` (lines 23-29), add after the `leads` entry:

```ts
{ key: 'calls', label: 'Calls', icon: 'Phone', href: '/calls' },
```

Add a permission check near the other `useCan` calls (lines 122-123):

```ts
const canCalls = useCan(PERMISSIONS.SPEED_TO_LEAD_READ);
```

Add `calls: canCalls,` to the `tabPermission` record (lines 132-138) and add `canCalls` to the `useMemo` dependency array (line 140). Ensure `PERMISSIONS` is imported in this file (it already is — used for `LISTINGS_READ`).

- [ ] **Step 4: Type-check + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Manual QA checkpoint**

Run the app. Verify:

- Logged in as a user WITH `speed-to-lead:read` → "Calls" tab visible; tapping it shows the list, stats header, real call data paginating, search + filter sheet working, pull-to-refresh.
- Logged in as a user WITHOUT the permission → no Calls tab; navigating to `/calls` directly redirects home.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/calls/index.tsx" "app/(app)/_layout.tsx" src/features/new-projects/components/BottomTabBar.tsx
git commit -m "feat(calls): add gated Calls tab and list route"
```

---

## Task 13: Detail screen — player, tabs, AI summary, feedback

**Files:** Create `detail/RecordingPlayer.tsx`, `detail/AiSummaryCard.tsx`, `detail/TranscriptTab.tsx`, `detail/LiveNotesTab.tsx`, `detail/CallHistoryTab.tsx`, `detail/CallDetailTabs.tsx`, `detail/FeedbackChips.tsx`, `detail/CallDetailScreen.tsx`

- [ ] **Step 1: `RecordingPlayer.tsx`**

```tsx
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { formatDuration } from '../constants';
import { useRecordingPlayer } from '../hooks/use-recording-player';

export function RecordingPlayer({ leadId }: Readonly<{ leadId: string }>) {
  const { toggle, loading, error, playing, position, duration } = useRecordingPlayer(leadId);
  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  return (
    <View className="mx-4 mb-2 rounded-xl border border-info/30 bg-info/10 p-3">
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={() => {
            toggle().catch(() => {});
          }}
          className="h-8 w-8 items-center justify-center rounded-full bg-primary"
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Icon name={playing ? 'Pause' : 'Play'} size={16} color="white" />
          )}
        </Pressable>
        <View className="h-1 flex-1 rounded-full bg-info/30">
          <View className="h-1 rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </View>
        <Text variant="muted" className="text-xs">
          {formatDuration(Math.round(duration))}
        </Text>
      </View>
      {error ? <Text className="mt-1 text-xs text-destructive">{error}</Text> : null}
    </View>
  );
}
```

- [ ] **Step 2: `TranscriptTab.tsx`, `LiveNotesTab.tsx`, `CallHistoryTab.tsx`, `AiSummaryCard.tsx`**

```tsx
// TranscriptTab.tsx
import { View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import type { TranscriptEntry } from '../types';

export function TranscriptTab({ entries }: Readonly<{ entries: TranscriptEntry[] }>) {
  return (
    <View className="gap-3 px-4 py-2">
      {entries.map((e, i) => (
        <View key={`${e.speaker}-${i}`}>
          <Text className="text-xs font-semibold text-primary">
            {e.speaker} · {e.timestamp}
          </Text>
          <Text variant="muted">{e.text}</Text>
        </View>
      ))}
    </View>
  );
}
```

```tsx
// LiveNotesTab.tsx
import { View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import type { StructuredLiveNotes } from '../types';

export function LiveNotesTab({ notes }: Readonly<{ notes: StructuredLiveNotes }>) {
  return (
    <View className="gap-4 px-4 py-2">
      {notes.sections.map((s, i) => (
        <View key={`${s.heading}-${i}`} className="gap-1">
          <Text variant="label">{s.heading}</Text>
          {s.lines.map((line, j) => (
            <Text key={j} variant="muted">
              • {line}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}
```

```tsx
// CallHistoryTab.tsx
import { View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { CallStatusBadge } from '../components/CallStatusBadge';
import { formatDuration, formatHistoryDate, formatHistoryTime } from '../constants';
import type { CallHistoryEntry } from '../types';

export function CallHistoryTab({ entries }: Readonly<{ entries: CallHistoryEntry[] }>) {
  return (
    <View className="gap-3 px-4 py-2">
      {entries.map((e) => (
        <View key={e.id} className="flex-row items-center justify-between gap-2">
          <View className="flex-1">
            <CallStatusBadge status={e.status} />
            <Text variant="muted" className="mt-1 text-xs">
              {formatHistoryDate(e.dateTime)} · {formatHistoryTime(e.dateTime)} ·{' '}
              {formatDuration(e.duration)}
            </Text>
          </View>
          {e.isCurrent ? <Text className="text-xs text-primary">Current</Text> : null}
        </View>
      ))}
    </View>
  );
}
```

```tsx
// AiSummaryCard.tsx
import { View } from 'react-native';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import type { StructuredAiSummary } from '../types';

export function AiSummaryCard({ summary }: Readonly<{ summary: StructuredAiSummary }>) {
  return (
    <View className="mx-4 mb-2 gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3">
      <View className="flex-row items-center gap-2">
        <Icon name="Brain" size={16} />
        <Text variant="label">AI Summary</Text>
      </View>
      {summary.sections.map((s, i) => (
        <View key={`${s.heading}-${i}`} className="gap-0.5">
          <Text className="text-xs font-semibold">{s.heading}</Text>
          {s.items.map((it, j) => (
            <Text key={j} variant="muted" className="text-xs">
              • {it}
            </Text>
          ))}
        </View>
      ))}
      <Text variant="muted" className="text-xs">
        Sentiment: {summary.sentiment}
      </Text>
    </View>
  );
}
```

- [ ] **Step 3: `CallDetailTabs.tsx`** (segmented control)

```tsx
import { Pressable, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import type { CallTab } from '../types';

const TABS: { id: CallTab; label: string }[] = [
  { id: 'transcript', label: 'Transcript' },
  { id: 'liveNotes', label: 'Notes' },
  { id: 'callHistory', label: 'History' },
];

export function CallDetailTabs({
  active,
  onChange,
}: Readonly<{ active: CallTab; onChange: (t: CallTab) => void }>) {
  return (
    <View className="mx-4 my-2 flex-row rounded-lg bg-muted/50 p-1">
      {TABS.map((t) => {
        const on = t.id === active;
        return (
          <Pressable
            key={t.id}
            onPress={() => onChange(t.id)}
            className={`flex-1 rounded-md py-2 ${on ? 'bg-background' : ''}`}
          >
            <Text
              className={`text-center text-xs ${on ? 'font-semibold' : 'text-muted-foreground'}`}
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

- [ ] **Step 4: `FeedbackChips.tsx`**

```tsx
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { AGENT_FEEDBACK_LABELS } from '../constants';
import { useCallFeedback } from '../hooks/use-call-feedback';
import { AgentFeedback } from '../types';

const OPTIONS = Object.values(AgentFeedback);

export function FeedbackChips({
  leadId,
  current,
}: Readonly<{ leadId: string; current: AgentFeedback | null }>) {
  const [selected, setSelected] = useState<AgentFeedback | null>(current);
  const mutation = useCallFeedback(leadId);

  const choose = (fb: AgentFeedback) => {
    setSelected(fb);
    mutation.mutate({ feedback: fb });
  };

  return (
    <View className="gap-2 px-4 py-3">
      <Text variant="label">Your feedback</Text>
      <View className="flex-row flex-wrap gap-2">
        {OPTIONS.map((fb) => {
          const on = selected === fb;
          return (
            <Pressable
              key={fb}
              onPress={() => choose(fb)}
              className={`rounded-full border px-3 py-1.5 ${on ? 'border-success bg-success/15' : 'border-border'}`}
            >
              <Text className={`text-xs ${on ? 'text-success' : ''}`}>
                {AGENT_FEEDBACK_LABELS[fb]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {mutation.isError ? (
        <Text className="text-xs text-destructive">Failed to save feedback. Tap to retry.</Text>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 5: `CallDetailScreen.tsx`** (host, layout A)

```tsx
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Avatar, AvatarFallback } from '@/components/atoms/Avatar';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { CallStatusBadge } from '../components/CallStatusBadge';
import { initials } from '../constants';
import { useCallDetail } from '../hooks/use-call-detail';
import { AiSummaryCard } from './AiSummaryCard';
import { CallDetailTabs } from './CallDetailTabs';
import { CallHistoryTab } from './CallHistoryTab';
import { FeedbackChips } from './FeedbackChips';
import { LiveNotesTab } from './LiveNotesTab';
import { RecordingPlayer } from './RecordingPlayer';
import { TranscriptTab } from './TranscriptTab';
import type { CallTab } from '../types';

export function CallDetailScreen({
  leadId,
  onBack,
}: Readonly<{ leadId: string; onBack: () => void }>) {
  const detail = useCallDetail(leadId);
  const [tab, setTab] = useState<CallTab>('transcript');

  if (!detail) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text variant="muted" className="text-center">
          Call details unavailable. Open this call from the list.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={onBack}>
          <Icon name="ChevronLeft" size={24} />
        </Pressable>
        <Avatar alt={detail.lead.name} className="h-9 w-9">
          <AvatarFallback>
            <Text className="text-xs font-semibold">{initials(detail.lead.name)}</Text>
          </AvatarFallback>
        </Avatar>
        <View className="flex-1">
          <Text className="font-semibold" numberOfLines={1}>
            {detail.lead.name}
          </Text>
          <Text variant="muted" numberOfLines={1}>
            {detail.lead.phone} · {detail.widget}
          </Text>
        </View>
        <CallStatusBadge status={detail.status} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {detail.hasRecording ? <RecordingPlayer leadId={leadId} /> : null}
        <AiSummaryCard summary={detail.aiSummary} />
        <CallDetailTabs active={tab} onChange={setTab} />
        {tab === 'transcript' ? <TranscriptTab entries={detail.transcript} /> : null}
        {tab === 'liveNotes' ? <LiveNotesTab notes={detail.liveNotes} /> : null}
        {tab === 'callHistory' ? <CallHistoryTab entries={detail.callHistory} /> : null}
        <FeedbackChips leadId={leadId} current={detail.agentFeedback} />
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 6: Type-check + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/speedToLead/calls/detail
git commit -m "feat(calls): add detail screen with player, tabs, ai summary, feedback"
```

---

## Task 14: Detail route

**Files:** Create `app/(app)/calls/[leadId].tsx`

- [ ] **Step 1: Write the gated detail route**

```tsx
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { CallDetailScreen } from '@/features/speedToLead/calls/detail/CallDetailScreen';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';

export default function CallDetailRoute() {
  const state = useRequirePermission(PERMISSIONS.SPEED_TO_LEAD_READ);
  const { leadId } = useLocalSearchParams<{ leadId: string }>();
  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/" />;
  return <CallDetailScreen leadId={leadId} onBack={() => router.back()} />;
}
```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Manual QA checkpoint**

Run the app. From the Calls list:

- Tap a call → detail opens: header + status, recording player (if `hasRecording`), AI summary, tabs switch between Transcript/Notes/History, feedback chips.
- Tap Play on a recording → audio downloads + plays; tap again pauses; non-existent recording shows error.
- Select a feedback chip → POST fires; reopen list → no crash.
- Long-press a card → selection mode; select several → Export → share sheet opens with a CSV.
- Back button returns to the list.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/calls/[leadId].tsx"
git commit -m "feat(calls): add gated call detail route"
```

---

## Task 15: Final verification pass

- [ ] **Step 1: Full type-check + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS with zero errors.

- [ ] **Step 2: Format check**

Run: `pnpm format:check`
Expected: PASS (or run `pnpm format` then re-commit).

- [ ] **Step 3: End-to-end manual QA matrix**

Verify against the spec's acceptance points:

- Permission-gated tab visibility (with / without `speed-to-lead:read`).
- List: real data, pagination/infinite scroll, debounced search, bottom-sheet filters apply + pills remove, pull-to-refresh, empty + error states.
- Detail: all tabs, recording playback, feedback submit.
- CSV export via share sheet.
- Light + dark theme both render (no hard-coded colors).

- [ ] **Step 4: Final commit (if any format/fixups)**

```bash
git add -A
git commit -m "chore(calls): final lint/format pass"
```

---

## Self-Review Notes (addressed)

- **Spec coverage:** list (T11), detail (T13), recording (T6/T13), feedback (T5/T13), CSV export (T6/T11), stats header (T9, mock-parity flagged), filters bottom-sheet (T10), permission gate + tab (T12/T14), types (T1), deps (T0). All spec sections mapped.
- **Mock vs real:** stats header + detail tabs are mock (web parity, no backend endpoint) — flagged in T9/T3 and code comments. List/recording/feedback are real backend.
- **Type consistency:** `CallFilters`, `Call`, `CallDetail`, `getStatusConfig`, `StatusTone`, `useCallLogsInfinite`, `useSelectedCall`, `getRecordingFileUri` names are consistent across tasks.
- **Known confirm-at-impl points (not placeholders):** `expo-audio` exact API surface (T6 S2), `getAuthToken` export name (T4 S2), Lucide icon availability (T2 S2), `GestureHandlerRootView` root (T10 S2), Avatar/Input prop APIs (T8/T11). Each has an explicit verification step.
