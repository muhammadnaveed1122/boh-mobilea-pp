# Call Monitoring (Mobile) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the web `/my-account/call-monitoring` feature to the Expo Router mobile app at full parity — stats, source tabs, filters, records list, detail screen with recording playback, callback, DNC management, and CSV share-export — gated by the `calls:monitor` permission.

**Architecture:** New self-contained `src/features/callMonitoring/` module consuming the existing backend `/api/v1/call-service/*` endpoints via the shared axios `apiClient`. TanStack Query for server state, local React state for filters (newer leads pattern), NativeWind atoms for UI. The web table becomes a `FlatList` of cards; the slide-in detail panel becomes a full-screen pushed route. A new bottom tab (permission-gated) is the entry point.

**Tech Stack:** React Native 0.81 / Expo SDK 54, Expo Router, TanStack Query v5, axios, NativeWind v4, `expo-audio` (recording playback with auth headers), `expo-file-system` + `expo-sharing` (CSV export), `expo-clipboard` (copy number).

**Verification convention:** This repo has **no test runner** (see CLAUDE.md + user rule). Every task verifies with `pnpm exec tsc --noEmit` and `pnpm lint`, plus the manual-QA checklist in the final task. No unit tests.

**Note on deviations from the spec:** (1) Filters are held in local screen state (the newer `AllLeadsScreen`/`use-all-leads` pattern), not a Zustand store. (2) The filter UI uses a full-screen `Modal` sheet (mirroring `LeadsFiltersSheet`), not `@gorhom/bottom-sheet`. (3) Recording plays directly from the authed stream URL via `expo-audio`'s `{ uri, headers }` source — no temp-file download. (4) `PERMISSIONS.CALLS_MONITOR` already exists in `src/lib/rbac/permissions.ts`, so no permission constant is added.

---

## File structure

Created under `src/features/callMonitoring/`:

```
models/
  call-record.ts      CallRecord, CallsListResponse
  call-stats.ts       CallStats
  query.ts            CallLogQuery
constants.ts          PAGE_SIZE, SOURCE_TABS
utils/call-format.ts  duration/date/number formatters + badge & source variant maps
services.ts           axios calls to /api/v1/call-service/*
hooks/
  use-call-records.ts
  use-call-stats.ts
  use-dnc-check.ts
  use-callback.ts
  use-dnc-mutations.ts
  use-recording-player.ts
  use-call-export.ts
components/
  StatsRow.tsx
  SourceTabs.tsx
  RecordingButton.tsx
  CallRecordCard.tsx
  CallFilterSheet.tsx
  CallList.tsx
  CallMonitoringScreen.tsx
  detail/
    CallDetailScreen.tsx
    QuickActions.tsx
    FactsGrid.tsx
    SpeedToLeadCard.tsx
    DetailTabs.tsx
```

Routes created:

```
app/(app)/calls/index.tsx     tab root screen
app/(app)/calls/[uuid].tsx    detail route
```

Modified:

```
app/(app)/_layout.tsx                                    register calls/index + calls/[uuid]
src/features/new-projects/components/BottomTabBar.tsx    add Calls tab + permission gate
```

---

## Task 1: Install dependencies

**Files:** `package.json` (via `expo install`)

- [ ] **Step 1: Install the four Expo packages with SDK-aligned versions**

Run from the repo root:

```bash
cd /Users/nabeel.ahmed/Desktop/Projects/boh/boh-mobile
pnpm exec expo install expo-audio expo-file-system expo-sharing expo-clipboard
```

`expo install` picks versions compatible with SDK 54. These are config-plugin-free / autolinked native modules.

- [ ] **Step 2: Verify they resolve**

Run:

```bash
node -e "const d=require('./package.json').dependencies; ['expo-audio','expo-file-system','expo-sharing','expo-clipboard'].forEach(k=>console.log(k, d[k]||'MISSING'))"
```

Expected: each prints a version, none `MISSING`.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(call-monitoring): add expo-audio, file-system, sharing, clipboard deps"
```

> A native rebuild (`pnpm ios` / `pnpm android` dev client or EAS) is required before recording playback works on device, since these add native modules. Note this for the QA task.

---

## Task 2: Data models + constants

**Files:**

- Create: `src/features/callMonitoring/models/call-record.ts`
- Create: `src/features/callMonitoring/models/call-stats.ts`
- Create: `src/features/callMonitoring/models/query.ts`
- Create: `src/features/callMonitoring/constants.ts`

- [ ] **Step 1: Create `models/call-record.ts`** (ported verbatim from web `callServiceApi.ts`)

```typescript
export interface CallRecord {
  id: string;
  uuid: string;
  callerIdName: string | null;
  callerIdNumber: string | null;
  destinationNumber: string | null;
  direction: 'inbound' | 'outbound' | null;
  startTime: string | null;
  duration: number;
  billsec: number;
  status: string | null;
  hangupCause: string | null;
  recordingPath: string | null;
  extensionNumber: string | null;
  carrier: string | null;
  countryIso: string | null;
  source: 'speed_to_lead' | 'dialer' | 'reception' | 'webhook' | null;
  isDnc?: boolean;
  extension: {
    extension: string;
    agentName: string | null;
    department: { name: string } | null;
  } | null;
}

export interface CallsListResponse {
  records?: CallRecord[];
  rows?: CallRecord[];
  data?: CallRecord[];
  total?: number;
  count?: number;
  limit?: number;
  offset?: number;
}

/** Normalize the backend's records|rows|data variants into a single array. */
export function extractRecords(res: CallsListResponse | undefined): CallRecord[] {
  return res?.records ?? res?.rows ?? res?.data ?? [];
}

/** Normalize the total-count variants. */
export function extractTotal(res: CallsListResponse | undefined, fallback: number): number {
  return res?.total ?? res?.count ?? fallback;
}
```

- [ ] **Step 2: Create `models/call-stats.ts`**

```typescript
export interface CallStats {
  total_calls: number;
  inbound_calls: number;
  outbound_calls: number;
  answered_calls: number;
  missed_calls: number;
  total_minutes: number;
  average_duration: number;
  by_extension: {
    extension: string | null;
    agentName: string;
    total_calls: number;
    total_minutes: number;
  }[];
  by_carrier: { carrier: string | null; total_calls: number; total_minutes: number }[];
  by_country: { countryIso: string | null; total_calls: number; total_minutes: number }[];
  by_source?: { source: string | null; total_calls: number }[];
}
```

- [ ] **Step 3: Create `models/query.ts`**

```typescript
export interface CallLogQuery {
  from?: string;
  to?: string;
  agentExtension?: string;
  direction?: string;
  carrier?: string;
  countryIso?: string;
  source?: string;
  search?: string;
  limit?: number;
  offset?: number;
}
```

- [ ] **Step 4: Create `constants.ts`**

```typescript
export const PAGE_SIZE = 20;

export type SourceTabKey = '' | 'speed_to_lead' | 'dialer' | 'reception' | 'webhook';

export const SOURCE_TABS: { key: SourceTabKey; label: string }[] = [
  { key: '', label: 'All Calls' },
  { key: 'speed_to_lead', label: 'Speed to Lead' },
  { key: 'dialer', label: 'Dialer' },
  { key: 'reception', label: 'Reception' },
  { key: 'webhook', label: 'Webhook' },
];

export const OUTCOME_OPTIONS = ['Connected', 'No Answer', 'Busy', 'Disconnected'] as const;
export type OutcomeOption = (typeof OUTCOME_OPTIONS)[number];
```

- [ ] **Step 5: Verify and commit**

```bash
pnpm exec tsc --noEmit
git add src/features/callMonitoring/models src/features/callMonitoring/constants.ts
git commit -m "feat(call-monitoring): add data models and constants"
```

Expected: `tsc` exits 0.

---

## Task 3: Formatting + badge utilities

**Files:**

- Create: `src/features/callMonitoring/utils/call-format.ts`

Ported from web `callLogFormat.ts`. Badge/source helpers now return mobile `Badge` variant names instead of web CSS class strings.

- [ ] **Step 1: Create `utils/call-format.ts`**

```typescript
import type { BadgeProps } from '@/components/atoms/Badge';

export type BadgeVariant = NonNullable<BadgeProps['variant']>;

export function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${String(m)}m ${String(s).padStart(2, '0')}s` : `${String(s)}s`;
}

export function formatDateTime(iso: string | null): string {
  if (iso === null) return '—';
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  const isYest = d.toDateString() === yest.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Today · ${time}`;
  if (isYest) return `Yesterday · ${time}`;
  return `${d.toLocaleDateString()} · ${time}`;
}

/** CDR numbers can be URL-encoded ("%2B92…"=+92…) or junk ("false"). */
export function displayNumber(value: string | null): string {
  if (value === null || value === '' || value === 'false') return '—';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function outcomeBadge(status: string | null): { label: string; variant: BadgeVariant } {
  switch (status ?? '') {
    case 'answered':
      return { label: 'Connected', variant: 'successSoft' };
    case 'missed':
      return { label: 'No Answer', variant: 'mutedSoft' };
    case 'busy':
      return { label: 'Busy', variant: 'warningSoft' };
    case 'failed':
      return { label: 'Disconnected', variant: 'destructiveSoft' };
    default:
      return { label: status ?? '—', variant: 'mutedSoft' };
  }
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const SOURCE_LABELS: Record<string, string> = {
  speed_to_lead: 'Speed to Lead',
  dialer: 'Dialer',
  reception: 'Reception',
  webhook: 'Webhook',
};

export function sourceLabel(source: string | null): string {
  return source !== null && source in SOURCE_LABELS ? SOURCE_LABELS[source] : '—';
}

export function sourceBadgeVariant(source: string | null): BadgeVariant {
  switch (source ?? '') {
    case 'speed_to_lead':
      return 'infoSoft';
    case 'dialer':
      return 'secondary';
    case 'reception':
      return 'successSoft';
    case 'webhook':
      return 'warningSoft';
    default:
      return 'mutedSoft';
  }
}

export function campaignLabel(source: string | null): string {
  switch (source ?? '') {
    case 'dialer':
      return 'Manual call';
    case 'reception':
      return 'Reception';
    case 'speed_to_lead':
      return 'Speed to Lead';
    default:
      return '—';
  }
}
```

- [ ] **Step 2: Verify and commit**

```bash
pnpm exec tsc --noEmit
git add src/features/callMonitoring/utils/call-format.ts
git commit -m "feat(call-monitoring): add format + badge variant utilities"
```

Expected: `tsc` exits 0.

---

## Task 4: Service layer

**Files:**

- Create: `src/features/callMonitoring/services.ts`

- [ ] **Step 1: Create `services.ts`**

```typescript
import { apiClient } from '@/lib/api';
import type { CallsListResponse } from './models/call-record';
import type { CallStats } from './models/call-stats';
import type { CallLogQuery } from './models/query';

const BASE = '/api/v1/call-service';

/** Drop empty / 'all' params (matches web buildQs). axios serializes the rest. */
function buildParams(q: CallLogQuery): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(q).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== 'all') out[k] = String(v);
  });
  return out;
}

export async function getCallRecords(q: CallLogQuery): Promise<CallsListResponse> {
  const { data } = await apiClient.get<CallsListResponse>(`${BASE}/calls`, {
    params: buildParams(q),
  });
  return data;
}

export async function getCallStats(q: CallLogQuery): Promise<CallStats> {
  const { data } = await apiClient.get<CallStats>(`${BASE}/calls/stats`, {
    params: buildParams(q),
  });
  return data;
}

export async function checkDnc(phones: string[]): Promise<Record<string, boolean>> {
  const { data } = await apiClient.get<Record<string, boolean>>(`${BASE}/dnc/check`, {
    params: { phones: phones.join(',') },
  });
  return data;
}

export interface CallbackPayload {
  customerPhone: string;
  agentExtension: string;
  agentName?: string;
}

export async function initiateCallback(body: CallbackPayload): Promise<void> {
  await apiClient.post(`${BASE}/calls/callback`, body);
}

export async function addToDnc(body: { phone: string; note?: string }): Promise<void> {
  await apiClient.post(`${BASE}/dnc`, body);
}

export async function removeFromDnc(phone: string): Promise<void> {
  await apiClient.delete(`${BASE}/dnc/${encodeURIComponent(phone)}`);
}
```

- [ ] **Step 2: Verify and commit**

```bash
pnpm exec tsc --noEmit
git add src/features/callMonitoring/services.ts
git commit -m "feat(call-monitoring): add call-service API service layer"
```

Expected: `tsc` exits 0.

---

## Task 5: Query + mutation hooks

**Files:**

- Create: `src/features/callMonitoring/hooks/use-call-records.ts`
- Create: `src/features/callMonitoring/hooks/use-call-stats.ts`
- Create: `src/features/callMonitoring/hooks/use-dnc-check.ts`
- Create: `src/features/callMonitoring/hooks/use-callback.ts`
- Create: `src/features/callMonitoring/hooks/use-dnc-mutations.ts`

- [ ] **Step 1: Create `hooks/use-call-records.ts`** (infinite, offset paging)

```typescript
import { useInfiniteQuery } from '@tanstack/react-query';
import { PAGE_SIZE } from '../constants';
import { extractRecords, extractTotal, type CallsListResponse } from '../models/call-record';
import type { CallLogQuery } from '../models/query';
import { getCallRecords } from '../services';

export function useCallRecords(filters: CallLogQuery) {
  return useInfiniteQuery<CallsListResponse, Error>({
    queryKey: ['call-records', filters],
    queryFn: ({ pageParam }) =>
      getCallRecords({
        ...filters,
        limit: PAGE_SIZE,
        offset: (pageParam as number) * PAGE_SIZE,
      }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + extractRecords(p).length, 0);
      const total = extractTotal(last, loaded);
      return loaded < total ? all.length : undefined;
    },
  });
}
```

- [ ] **Step 2: Create `hooks/use-call-stats.ts`** (global + scoped)

```typescript
import { useQuery } from '@tanstack/react-query';
import type { CallStats } from '../models/call-stats';
import type { SourceTabKey } from '../constants';
import { getCallStats } from '../services';

interface StatsRange {
  from?: string;
  to?: string;
}

/** Stats with no source filter — drives tab counts; stays cached across tab switches. */
export function useGlobalCallStats(range: StatsRange) {
  return useQuery<CallStats, Error>({
    queryKey: ['call-stats', 'global', range],
    queryFn: () => getCallStats({ from: range.from || undefined, to: range.to || undefined }),
  });
}

/** Source-scoped stats for the KPI cards; disabled on the "All" tab. */
export function useScopedCallStats(range: StatsRange, source: SourceTabKey) {
  return useQuery<CallStats, Error>({
    queryKey: ['call-stats', 'scoped', range, source],
    queryFn: () =>
      getCallStats({ from: range.from || undefined, to: range.to || undefined, source }),
    enabled: source !== '',
  });
}
```

- [ ] **Step 3: Create `hooks/use-dnc-check.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { checkDnc } from '../services';

export function useDncCheck(phones: string[]) {
  return useQuery<Record<string, boolean>, Error>({
    queryKey: ['dnc-check', phones],
    queryFn: () => checkDnc(phones),
    enabled: phones.length > 0,
  });
}
```

- [ ] **Step 4: Create `hooks/use-callback.ts`**

```typescript
import { useMutation } from '@tanstack/react-query';
import { initiateCallback, type CallbackPayload } from '../services';

export function useCallback_() {
  return useMutation<void, Error, CallbackPayload>({
    mutationFn: (body) => initiateCallback(body),
  });
}
```

> Named `useCallback_` with a trailing underscore to avoid shadowing React's `useCallback`. Import as `useCallback_`.

- [ ] **Step 5: Create `hooks/use-dnc-mutations.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addToDnc, removeFromDnc } from '../services';

export function useDncMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['dnc-check'] }).catch(() => {});
  };

  const add = useMutation<void, Error, { phone: string; note?: string }>({
    mutationFn: (body) => addToDnc(body),
    onSuccess: invalidate,
  });

  const remove = useMutation<void, Error, string>({
    mutationFn: (phone) => removeFromDnc(phone),
    onSuccess: invalidate,
  });

  return { add, remove };
}
```

- [ ] **Step 6: Verify and commit**

```bash
pnpm exec tsc --noEmit
git add src/features/callMonitoring/hooks
git commit -m "feat(call-monitoring): add records/stats/dnc/callback query hooks"
```

Expected: `tsc` exits 0.

---

## Task 6: Recording player hook

**Files:**

- Create: `src/features/callMonitoring/hooks/use-recording-player.ts`

Plays the bearer-auth-protected stream directly via `expo-audio`'s `{ uri, headers }` source — no temp file. One recording at a time.

- [ ] **Step 1: Create `hooks/use-recording-player.ts`**

```typescript
import { useCallback, useEffect, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { CONFIG } from '@/lib/config';
import { useAuthStore } from '@/store/auth.store';

export interface RecordingPlayer {
  /** Start the given call's recording, or stop it if already playing. */
  toggle: (uuid: string) => void;
  playingId: string | null;
  loadingId: string | null;
  error: string | null;
}

export function useRecordingPlayer(): RecordingPlayer {
  const token = useAuthStore((s) => s.tokens?.accessToken ?? null);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Clear the playing flag when the clip finishes.
  useEffect(() => {
    if (status.didJustFinish) setPlayingId(null);
  }, [status.didJustFinish]);

  // The clip is "loaded" once buffered; drop the loading flag.
  useEffect(() => {
    if (status.isLoaded) setLoadingId(null);
  }, [status.isLoaded]);

  const toggle = useCallback(
    (uuid: string) => {
      setError(null);
      if (playingId === uuid) {
        player.pause();
        setPlayingId(null);
        return;
      }
      try {
        setLoadingId(uuid);
        const uri = `${CONFIG.API_BASE_URL}/api/v1/call-service/calls/${encodeURIComponent(
          uuid,
        )}/recording`;
        player.replace({
          uri,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        player.play();
        setPlayingId(uuid);
      } catch {
        setError('Could not load recording.');
        setPlayingId(null);
        setLoadingId(null);
      }
    },
    [playingId, player, token],
  );

  return { toggle, playingId, loadingId, error };
}
```

- [ ] **Step 2: Verify and commit**

```bash
pnpm exec tsc --noEmit
git add src/features/callMonitoring/hooks/use-recording-player.ts
git commit -m "feat(call-monitoring): add expo-audio recording playback hook"
```

Expected: `tsc` exits 0. (If `expo-audio` types are missing, Task 1 was skipped — install first.)

---

## Task 7: CSV export hook

**Files:**

- Create: `src/features/callMonitoring/hooks/use-call-export.ts`

Builds a CSV from the currently loaded records, writes it to the cache dir (SDK 54 `File`/`Paths` API), and opens the OS share sheet.

- [ ] **Step 1: Create `hooks/use-call-export.ts`**

```typescript
import { useState } from 'react';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { CallRecord } from '../models/call-record';
import { displayNumber, outcomeBadge } from '../utils/call-format';

function toCsv(records: CallRecord[]): string {
  const header = [
    'Direction',
    'Contact',
    'Number',
    'Agent',
    'Department',
    'Source',
    'Outcome',
    'Date',
    'Duration(s)',
  ];
  const rows = records.map((r) => [
    r.direction ?? '',
    r.callerIdName ?? '',
    displayNumber(r.direction === 'outbound' ? r.destinationNumber : r.callerIdNumber),
    r.extension?.agentName ?? r.extensionNumber ?? '',
    r.extension?.department?.name ?? '',
    r.source ?? '',
    outcomeBadge(r.status).label,
    r.startTime ?? '',
    String(r.billsec || r.duration || 0),
  ]);
  return [header, ...rows]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export function useCallExport() {
  const [exporting, setExporting] = useState(false);

  const exportCsv = async (records: CallRecord[], stampIso: string): Promise<void> => {
    if (records.length === 0) return;
    setExporting(true);
    try {
      const name = `call-logs-${stampIso.slice(0, 10)}.csv`;
      const file = new File(Paths.cache, name);
      if (file.exists) file.delete();
      file.create();
      file.write(toCsv(records));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export call logs',
          UTI: 'public.comma-separated-values-text',
        });
      }
    } finally {
      setExporting(false);
    }
  };

  return { exportCsv, exporting };
}
```

> `stampIso` is passed in by the caller (e.g. `new Date().toISOString()`); the screen owns the timestamp so this hook stays pure.

- [ ] **Step 2: Verify and commit**

```bash
pnpm exec tsc --noEmit
git add src/features/callMonitoring/hooks/use-call-export.ts
git commit -m "feat(call-monitoring): add CSV share-export hook"
```

Expected: `tsc` exits 0.

---

## Task 8: Presentational components — StatsRow, SourceTabs, RecordingButton, CallRecordCard

**Files:**

- Create: `src/features/callMonitoring/components/StatsRow.tsx`
- Create: `src/features/callMonitoring/components/SourceTabs.tsx`
- Create: `src/features/callMonitoring/components/RecordingButton.tsx`
- Create: `src/features/callMonitoring/components/CallRecordCard.tsx`

- [ ] **Step 1: Create `components/StatsRow.tsx`**

```typescript
import { ScrollView, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { Card } from '@/components/molecules/Card';
import type { CallStats } from '../models/call-stats';
import { formatDuration } from '../utils/call-format';

interface StatProps {
  label: string;
  value: string | number;
  sub?: string;
  dotClass: string;
}

function Stat({ label, value, sub, dotClass }: Readonly<StatProps>) {
  return (
    <Card className="min-w-40 px-4 py-3">
      <View className="flex-row items-center gap-2">
        <View className={`h-2 w-2 rounded-full ${dotClass}`} />
        <Text className="text-xs text-muted-foreground">{label}</Text>
      </View>
      <Text className="mt-1 text-2xl font-semibold text-foreground">{String(value)}</Text>
      {sub ? <Text className="text-xs text-muted-foreground">{sub}</Text> : null}
    </Card>
  );
}

export function StatsRow({ stats }: Readonly<{ stats: CallStats | undefined }>) {
  const total = stats?.total_calls ?? 0;
  const answered = stats?.answered_calls ?? 0;
  const answerRate = total > 0 ? Math.round((answered / total) * 100) : 0;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
    >
      <Stat label="Total calls" value={total} dotClass="bg-primary" />
      <Stat
        label="Connected"
        value={answered}
        sub={`${answerRate}% answer rate`}
        dotClass="bg-success"
      />
      <Stat label="No answer" value={stats?.missed_calls ?? 0} dotClass="bg-warning" />
      <Stat label="Avg talk time" value={formatDuration(stats?.average_duration ?? 0)} dotClass="bg-info" />
    </ScrollView>
  );
}
```

- [ ] **Step 2: Create `components/SourceTabs.tsx`**

```typescript
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { SOURCE_TABS, type SourceTabKey } from '../constants';

interface Props {
  value: SourceTabKey;
  onChange: (key: SourceTabKey) => void;
  countFor: (key: SourceTabKey) => number | undefined;
}

export function SourceTabs({ value, onChange, countFor }: Readonly<Props>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
    >
      {SOURCE_TABS.map((t) => {
        const active = value === t.key;
        const count = countFor(t.key);
        return (
          <Pressable
            key={t.key || 'all'}
            onPress={() => onChange(t.key)}
            className={cn(
              'flex-row items-center gap-1.5 rounded-full px-4 py-1.5',
              active ? 'bg-primary' : 'bg-secondary',
            )}
          >
            <Text
              className={cn(
                'text-sm font-medium',
                active ? 'text-primary-foreground' : 'text-secondary-foreground',
              )}
            >
              {t.label}
            </Text>
            {count !== undefined ? (
              <View className={cn('rounded-full px-1.5', active ? 'bg-white/20' : 'bg-background')}>
                <Text
                  className={cn(
                    'text-xs',
                    active ? 'text-primary-foreground' : 'text-muted-foreground',
                  )}
                >
                  {count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
```

- [ ] **Step 3: Create `components/RecordingButton.tsx`**

```typescript
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';
import type { RecordingPlayer } from '../hooks/use-recording-player';

interface Props {
  uuid: string;
  recordingPath: string | null;
  player: RecordingPlayer;
  /** Compact icon-only for list rows; labeled for the detail screen. */
  labeled?: boolean;
}

export function RecordingButton({ uuid, recordingPath, player, labeled }: Readonly<Props>) {
  const fg = useThemeColor('--foreground');
  const muted = useThemeColor('--muted-foreground');
  const disabled = recordingPath === null;
  const loading = player.loadingId === uuid;
  const playing = player.playingId === uuid;

  return (
    <Pressable
      disabled={disabled}
      onPress={() => player.toggle(uuid)}
      hitSlop={8}
      className="flex-row items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5"
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={muted} />
      ) : (
        <Icon name={playing ? 'Pause' : 'Play'} size={16} color={fg} />
      )}
      {labeled ? (
        <Text className="text-sm text-foreground">
          {disabled ? 'No recording' : playing ? 'Stop' : 'Play recording'}
        </Text>
      ) : null}
    </Pressable>
  );
}
```

- [ ] **Step 4: Create `components/CallRecordCard.tsx`**

```typescript
import { Pressable, View } from 'react-native';
import { Badge } from '@/components/atoms/Badge';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { Card } from '@/components/molecules/Card';
import { useThemeColor } from '@theme';
import type { CallRecord } from '../models/call-record';
import type { RecordingPlayer } from '../hooks/use-recording-player';
import {
  displayNumber,
  formatDateTime,
  formatDuration,
  initials,
  outcomeBadge,
  sourceBadgeVariant,
  sourceLabel,
} from '../utils/call-format';
import { RecordingButton } from './RecordingButton';

interface Props {
  record: CallRecord;
  isDnc: boolean;
  player: RecordingPlayer;
  onPress: () => void;
}

export function CallRecordCard({ record, isDnc, player, onPress }: Readonly<Props>) {
  const success = useThemeColor('--success');
  const primary = useThemeColor('--primary');
  const inbound = record.direction === 'inbound';
  const contactNumber = inbound ? record.callerIdNumber : record.destinationNumber;
  const badge = outcomeBadge(record.status);
  const agentName = record.extension?.agentName ?? record.extensionNumber ?? '—';
  const dept = record.extension?.department?.name;

  return (
    <Pressable onPress={onPress}>
      <Card className="px-4 py-3">
        {/* Row 1: direction + name/number + outcome */}
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1 flex-row items-center gap-2">
            <Icon
              name={inbound ? 'PhoneIncoming' : 'PhoneOutgoing'}
              size={18}
              color={inbound ? success : primary}
            />
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="font-medium text-foreground" numberOfLines={1}>
                  {record.callerIdName ?? '—'}
                </Text>
                {isDnc ? (
                  <Badge variant="destructiveSoft">
                    <Text>DNC</Text>
                  </Badge>
                ) : null}
              </View>
              <Text className="text-xs text-muted-foreground">{displayNumber(contactNumber)}</Text>
            </View>
          </View>
          <Badge variant={badge.variant}>
            <Text>{badge.label}</Text>
          </Badge>
        </View>

        {/* Row 2: agent + dept + source */}
        <View className="mt-2 flex-row items-center gap-2">
          <View className="h-6 w-6 items-center justify-center rounded-full bg-muted">
            <Text className="text-[10px] font-medium text-foreground">
              {agentName === '—' ? '?' : initials(agentName)}
            </Text>
          </View>
          <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
            {agentName}
            {dept ? ` · ${dept}` : ''}
          </Text>
          <Badge variant={sourceBadgeVariant(record.source)}>
            <Text>{sourceLabel(record.source)}</Text>
          </Badge>
        </View>

        {/* Row 3: time + duration + recording */}
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-xs text-muted-foreground">{formatDateTime(record.startTime)}</Text>
          <View className="flex-row items-center gap-3">
            <Text className="text-xs text-foreground">
              {formatDuration(record.billsec || record.duration)}
            </Text>
            <RecordingButton
              uuid={record.uuid}
              recordingPath={record.recordingPath}
              player={player}
            />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
```

- [ ] **Step 5: Verify and commit**

```bash
pnpm exec tsc --noEmit
git add src/features/callMonitoring/components/StatsRow.tsx src/features/callMonitoring/components/SourceTabs.tsx src/features/callMonitoring/components/RecordingButton.tsx src/features/callMonitoring/components/CallRecordCard.tsx
git commit -m "feat(call-monitoring): add stats, tabs, recording button, record card"
```

Expected: `tsc` exits 0.

---

## Task 9: Filter sheet

**Files:**

- Create: `src/features/callMonitoring/components/CallFilterSheet.tsx`

Mirrors `LeadsFiltersSheet` (full-screen `Modal` + palette `vars`). Holds direction, outcome, department, agent, and date range.

- [ ] **Step 1: Create `components/CallFilterSheet.tsx`**

```typescript
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { vars } from 'nativewind';
import { format } from 'date-fns';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useTheme } from '@theme';
import { tokens } from '@theme/tokens';
import { OUTCOME_OPTIONS } from '../constants';

export interface CallFilterDraft {
  direction?: string;
  outcome?: string;
  department?: string;
  agentExtension?: string;
  from?: string; // yyyy-MM-dd
  to?: string; // yyyy-MM-dd
}

interface PillProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function Pill({ label, active, onPress }: Readonly<PillProps>) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'rounded-full border px-3 py-1.5',
        active ? 'border-brand bg-brand' : 'border-border bg-transparent',
      )}
    >
      <Text className={cn('text-xs font-medium', active ? 'text-brand-foreground' : 'text-foreground')}>
        {label}
      </Text>
    </Pressable>
  );
}

function Section({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <View className="mb-5">
      <Text className="mb-2 text-sm font-semibold text-foreground">{title}</Text>
      {children}
    </View>
  );
}

interface Props {
  visible: boolean;
  initial: CallFilterDraft;
  agentOptions: { value: string; label: string }[];
  departmentOptions: string[];
  onClose: () => void;
  onApply: (next: CallFilterDraft) => void;
}

function parseYmd(s?: string): Date | null {
  return s ? new Date(`${s}T00:00:00`) : null;
}

export function CallFilterSheet({
  visible,
  initial,
  agentOptions,
  departmentOptions,
  onClose,
  onApply,
}: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const palette = vars(tokens[colorScheme]);
  const [draft, setDraft] = useState<CallFilterDraft>(initial);

  useEffect(() => {
    if (visible) setDraft(initial);
  }, [visible, initial]);

  const toggle = (key: keyof CallFilterDraft, value: string) =>
    setDraft((d) => ({ ...d, [key]: d[key] === value ? undefined : value }));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 bg-background" style={[palette, { paddingTop: insets.top }]}>
        <View className="flex-row items-center justify-between border-b border-border px-5 py-3">
          <Pressable onPress={onClose} hitSlop={8}>
            <Icon name="X" size={22} />
          </Pressable>
          <Text className="text-base font-semibold text-foreground">Filters</Text>
          <Pressable onPress={() => setDraft({})} hitSlop={8}>
            <Text className="text-sm font-medium text-brand">Reset</Text>
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <Section title="Direction">
            <View className="flex-row flex-wrap gap-2">
              <Pill label="Incoming" active={draft.direction === 'inbound'} onPress={() => toggle('direction', 'inbound')} />
              <Pill label="Outgoing" active={draft.direction === 'outbound'} onPress={() => toggle('direction', 'outbound')} />
            </View>
          </Section>

          <Section title="Outcome">
            <View className="flex-row flex-wrap gap-2">
              {OUTCOME_OPTIONS.map((o) => (
                <Pill key={o} label={o} active={draft.outcome === o} onPress={() => toggle('outcome', o)} />
              ))}
            </View>
          </Section>

          {agentOptions.length > 0 ? (
            <Section title="Agent">
              <View className="flex-row flex-wrap gap-2">
                {agentOptions.map((a) => (
                  <Pill
                    key={a.value}
                    label={a.label}
                    active={draft.agentExtension === a.value}
                    onPress={() => toggle('agentExtension', a.value)}
                  />
                ))}
              </View>
            </Section>
          ) : null}

          {departmentOptions.length > 0 ? (
            <Section title="Department">
              <View className="flex-row flex-wrap gap-2">
                {departmentOptions.map((d) => (
                  <Pill
                    key={d}
                    label={d}
                    active={draft.department === d}
                    onPress={() => toggle('department', d)}
                  />
                ))}
              </View>
            </Section>
          ) : null}

          <Section title="From">
            <DatePicker
              value={parseYmd(draft.from)}
              onChange={(d) => setDraft((prev) => ({ ...prev, from: format(d, 'yyyy-MM-dd') }))}
              placeholder="Start date"
            />
          </Section>
          <Section title="To">
            <DatePicker
              value={parseYmd(draft.to)}
              onChange={(d) => setDraft((prev) => ({ ...prev, to: format(d, 'yyyy-MM-dd') }))}
              placeholder="End date"
            />
          </Section>
        </ScrollView>

        <View
          className="border-t border-border bg-background px-5 py-3"
          style={{ paddingBottom: 12 + insets.bottom }}
        >
          <Button
            onPress={() => {
              onApply(draft);
              onClose();
            }}
          >
            <Text>Apply Filters</Text>
          </Button>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: Verify and commit**

```bash
pnpm exec tsc --noEmit
git add src/features/callMonitoring/components/CallFilterSheet.tsx
git commit -m "feat(call-monitoring): add filter sheet (direction/outcome/agent/dept/date)"
```

Expected: `tsc` exits 0.

---

## Task 10: List + screen

**Files:**

- Create: `src/features/callMonitoring/components/CallList.tsx`
- Create: `src/features/callMonitoring/components/CallMonitoringScreen.tsx`

- [ ] **Step 1: Create `components/CallList.tsx`** (FlatList of cards with pagination, refresh, states)

```typescript
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { EmptyState } from '@/components/atoms/EmptyState';
import { Text } from '@/components/atoms/Text';
import { useBottomTabBarSpace } from '@/features/new-projects/components/BottomTabBar';
import { useThemeColor } from '@theme';
import type { CallRecord } from '../models/call-record';
import type { RecordingPlayer } from '../hooks/use-recording-player';
import { CallRecordCard } from './CallRecordCard';

interface Props {
  records: CallRecord[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  isFetchingNextPage: boolean;
  dncMap: Record<string, boolean> | undefined;
  player: RecordingPlayer;
  ListHeaderComponent: React.ReactElement;
  onEndReached: () => void;
  onRefresh: () => void;
  onSelect: (record: CallRecord) => void;
}

export function CallList({
  records,
  total,
  isLoading,
  isError,
  isRefetching,
  isFetchingNextPage,
  dncMap,
  player,
  ListHeaderComponent,
  onEndReached,
  onRefresh,
  onSelect,
}: Readonly<Props>) {
  const tabBarSpace = useBottomTabBarSpace();
  const brand = useThemeColor('--brand');

  const footer = isFetchingNextPage ? (
    <View className="py-6">
      <ActivityIndicator color={brand} />
    </View>
  ) : null;

  const empty = useMemo(() => {
    if (isLoading) {
      return (
        <View className="items-center py-16">
          <ActivityIndicator color={brand} />
        </View>
      );
    }
    if (isError) {
      return <EmptyState icon="TriangleAlert" title="Couldn't load calls" description="Pull to retry." />;
    }
    return <EmptyState icon="Phone" title="No calls" description="No calls for the selected filters." />;
  }, [isLoading, isError, brand]);

  const isDncFor = (r: CallRecord): boolean =>
    (r.callerIdNumber !== null && (dncMap?.[r.callerIdNumber] ?? r.isDnc)) ?? false;

  return (
    <FlatList
      data={records}
      keyExtractor={(r) => r.id || r.uuid}
      renderItem={({ item }) => (
        <View className="px-4 pb-3">
          <CallRecordCard
            record={item}
            isDnc={isDncFor(item)}
            player={player}
            onPress={() => onSelect(item)}
          />
        </View>
      )}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={empty}
      ListFooterComponent={
        records.length > 0 ? (
          <View className="px-4 pb-2">
            <Text className="text-center text-xs text-muted-foreground">
              {records.length} of {total} call{total === 1 ? '' : 's'}
            </Text>
            {footer}
          </View>
        ) : (
          footer
        )
      }
      contentContainerStyle={{ paddingBottom: tabBarSpace + 24 }}
      showsVerticalScrollIndicator={false}
      onEndReachedThreshold={0.5}
      onEndReached={onEndReached}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching && !isFetchingNextPage}
          onRefresh={onRefresh}
          tintColor={brand}
        />
      }
    />
  );
}
```

- [ ] **Step 2: Create `components/CallMonitoringScreen.tsx`** (orchestrator)

```typescript
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';
import type { SourceTabKey } from '../constants';
import { extractRecords, extractTotal, type CallRecord } from '../models/call-record';
import { useCallRecords } from '../hooks/use-call-records';
import { useGlobalCallStats, useScopedCallStats } from '../hooks/use-call-stats';
import { useDncCheck } from '../hooks/use-dnc-check';
import { useRecordingPlayer } from '../hooks/use-recording-player';
import { useCallExport } from '../hooks/use-call-export';
import { outcomeBadge } from '../utils/call-format';
import { CallFilterSheet, type CallFilterDraft } from './CallFilterSheet';
import { CallList } from './CallList';
import { LeadSearchRowless } from './CallSearchRow';
import { SourceTabs } from './SourceTabs';
import { StatsRow } from './StatsRow';

function countActive(f: CallFilterDraft): number {
  return Object.values(f).filter((v) => v !== undefined && v !== '').length;
}

export function CallMonitoringScreen() {
  const insets = useSafeAreaInsets();
  const player = useRecordingPlayer();
  const { exportCsv, exporting } = useCallExport();

  const [tab, setTab] = useState<SourceTabKey>('');
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<CallFilterDraft>({});
  const [sheetVisible, setSheetVisible] = useState(false);

  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300);

  const serverFilters = useMemo(
    () => ({
      source: tab || undefined,
      search: debouncedSearch || undefined,
      direction: filters.direction || undefined,
      agentExtension: filters.agentExtension || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    }),
    [tab, debouncedSearch, filters],
  );

  const range = { from: filters.from, to: filters.to };
  const { data: globalStats } = useGlobalCallStats(range);
  const { data: scopedStats } = useScopedCallStats(range, tab);
  const stats = tab !== '' ? (scopedStats ?? globalStats) : globalStats;

  const recordsQuery = useCallRecords(serverFilters);
  useRefetchOnFocus(recordsQuery.refetch);

  const allRecords = useMemo<CallRecord[]>(
    () => recordsQuery.data?.pages.flatMap((p) => extractRecords(p)) ?? [],
    [recordsQuery.data],
  );
  const total = extractTotal(recordsQuery.data?.pages.at(-1), allRecords.length);

  // Client-side filters (parity with web): outcome + department.
  const records = useMemo(
    () =>
      allRecords.filter((r) => {
        if (filters.outcome && outcomeBadge(r.status).label !== filters.outcome) return false;
        if (filters.department && (r.extension?.department?.name ?? '') !== filters.department)
          return false;
        return true;
      }),
    [allRecords, filters.outcome, filters.department],
  );

  // DNC batch check for caller numbers on loaded pages.
  const phoneList = useMemo(
    () =>
      Array.from(
        new Set(allRecords.map((r) => r.callerIdNumber).filter((p): p is string => p !== null)),
      ),
    [allRecords],
  );
  const { data: dncMap } = useDncCheck(phoneList);

  // Filter options derived from data.
  const agentOptions = useMemo(
    () =>
      (stats?.by_extension ?? []).flatMap((e) =>
        e.extension === null ? [] : [{ value: e.extension, label: e.agentName || e.extension }],
      ),
    [stats],
  );
  const departmentOptions = useMemo(
    () =>
      Array.from(
        new Set(
          allRecords
            .map((r) => r.extension?.department?.name)
            .filter((n): n is string => n !== undefined),
        ),
      ),
    [allRecords],
  );

  const countFor = (key: SourceTabKey): number | undefined => {
    if (key === '') return globalStats?.total_calls;
    return globalStats?.by_source?.find((s) => s.source === key)?.total_calls;
  };

  const header = (
    <View className="gap-4 pb-2">
      <SourceTabs value={tab} onChange={setTab} countFor={countFor} />
      <StatsRow stats={stats} />
      <CallSearchRow
        value={searchInput}
        onChange={setSearchInput}
        onOpenFilters={() => setSheetVisible(true)}
        filterCount={countActive(filters)}
      />
    </View>
  );

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Title bar */}
      <View className="flex-row items-center justify-between px-4 pb-2 pt-1">
        <Text className="text-2xl font-semibold text-foreground">Call Logs</Text>
        <Pressable
          disabled={exporting || records.length === 0}
          onPress={() => exportCsv(records, new Date().toISOString())}
          hitSlop={8}
          className="flex-row items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5"
          style={{ opacity: exporting || records.length === 0 ? 0.5 : 1 }}
        >
          <Icon name="Download" size={16} color="#fff" />
          <Text className="text-sm font-medium text-primary-foreground">Export</Text>
        </Pressable>
      </View>

      <CallList
        records={records}
        total={total}
        isLoading={recordsQuery.isLoading}
        isError={recordsQuery.isError}
        isRefetching={recordsQuery.isRefetching}
        isFetchingNextPage={recordsQuery.isFetchingNextPage}
        dncMap={dncMap}
        player={player}
        ListHeaderComponent={header}
        onEndReached={() => {
          if (recordsQuery.hasNextPage && !recordsQuery.isFetchingNextPage) {
            recordsQuery.fetchNextPage().catch(() => {});
          }
        }}
        onRefresh={() => {
          recordsQuery.refetch().catch(() => {});
        }}
        onSelect={(record) => router.push(`/calls/${record.uuid}`)}
      />

      <CallFilterSheet
        visible={sheetVisible}
        initial={filters}
        agentOptions={agentOptions}
        departmentOptions={departmentOptions}
        onClose={() => setSheetVisible(false)}
        onApply={setFilters}
      />
    </View>
  );
}
```

> Two helper references above (`CallSearchRow`, and a stray `LeadSearchRowless` import) must be reconciled in Step 3 — the screen needs a small search row component. Remove the incorrect `LeadSearchRowless` import line and add the `CallSearchRow` import. This is fixed in Step 3.

- [ ] **Step 3: Create `components/CallSearchRow.tsx` and fix the screen import**

Create `src/features/callMonitoring/components/CallSearchRow.tsx`:

```typescript
import { Pressable, TextInput, View } from 'react-native';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onOpenFilters: () => void;
  filterCount: number;
}

export function CallSearchRow({ value, onChange, onOpenFilters, filterCount }: Readonly<Props>) {
  const muted = useThemeColor('--muted-foreground');
  return (
    <View className="flex-row items-center gap-2 px-4">
      <View className="h-11 flex-1 flex-row items-center gap-2 rounded-lg border border-input bg-background px-3">
        <Icon name="Search" size={18} color={muted} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Search lead, number or agent…"
          placeholderTextColor={muted}
          className="flex-1 text-foreground"
          returnKeyType="search"
        />
      </View>
      <Pressable
        onPress={onOpenFilters}
        className="h-11 flex-row items-center gap-1.5 rounded-lg border border-border px-3"
      >
        <Icon name="SlidersHorizontal" size={18} />
        {filterCount > 0 ? (
          <View className="h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1">
            <Text className="text-[11px] font-semibold text-brand-foreground">{filterCount}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}
```

Then in `CallMonitoringScreen.tsx` replace the line:

```typescript
import { LeadSearchRowless } from './CallSearchRow';
```

with:

```typescript
import { CallSearchRow } from './CallSearchRow';
```

(The `header` JSX already references `<CallSearchRow .../>`.)

- [ ] **Step 4: Verify and commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/features/callMonitoring/components/CallList.tsx src/features/callMonitoring/components/CallMonitoringScreen.tsx src/features/callMonitoring/components/CallSearchRow.tsx
git commit -m "feat(call-monitoring): add list, search row, and screen orchestrator"
```

Expected: `tsc` exits 0; lint passes (fix any import-order/sonar warnings it flags).

---

## Task 11: Detail screen + sub-components

**Files:**

- Create: `src/features/callMonitoring/components/detail/FactsGrid.tsx`
- Create: `src/features/callMonitoring/components/detail/SpeedToLeadCard.tsx`
- Create: `src/features/callMonitoring/components/detail/QuickActions.tsx`
- Create: `src/features/callMonitoring/components/detail/DetailTabs.tsx`
- Create: `src/features/callMonitoring/components/detail/CallDetailScreen.tsx`

The detail screen finds the record in the React Query cache by uuid (records already loaded by the list). If absent (e.g. deep link / cold start), it shows a not-found state.

- [ ] **Step 1: Create `detail/FactsGrid.tsx`**

```typescript
import { View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import type { CallRecord } from '../../models/call-record';
import {
  campaignLabel,
  formatDateTime,
  formatDuration,
  outcomeBadge,
  sourceLabel,
} from '../../utils/call-format';

function Fact({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <View className="w-1/2 px-1 py-2">
      <Text className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Text>
      <Text className="mt-0.5 text-sm text-foreground">{value}</Text>
    </View>
  );
}

export function FactsGrid({ call }: Readonly<{ call: CallRecord }>) {
  const inbound = call.direction === 'inbound';
  const agentName = call.extension?.agentName ?? call.extensionNumber ?? '—';
  return (
    <View className="flex-row flex-wrap px-3">
      <Fact label="Date & time" value={formatDateTime(call.startTime)} />
      <Fact label="Duration" value={formatDuration(call.billsec || call.duration)} />
      <Fact label="Source" value={sourceLabel(call.source)} />
      <Fact label="Outcome" value={outcomeBadge(call.status).label} />
      <Fact label="Agent" value={agentName} />
      <Fact label="Department" value={call.extension?.department?.name ?? '—'} />
      <Fact label="Campaign / Widget" value={campaignLabel(call.source)} />
      <Fact label="Direction" value={inbound ? 'Incoming' : 'Outgoing'} />
    </View>
  );
}
```

- [ ] **Step 2: Create `detail/SpeedToLeadCard.tsx`**

```typescript
import { View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { Card } from '@/components/molecules/Card';
import type { CallRecord } from '../../models/call-record';
import { displayNumber } from '../../utils/call-format';

function Cell({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <View className="w-1/2 py-1">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className="text-sm text-foreground">{value}</Text>
    </View>
  );
}

export function SpeedToLeadCard({ call }: Readonly<{ call: CallRecord }>) {
  if (call.source !== 'speed_to_lead') return null;
  const agentName = call.extension?.agentName ?? call.extensionNumber ?? '—';
  return (
    <View className="px-4 py-3">
      <Text className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        Speed to Lead
      </Text>
      <Card variant="infoSoft" className="flex-row flex-wrap px-3 py-2">
        <Cell label="Trigger" value="Auto-callback" />
        <Cell label="Lead name" value={call.callerIdName ?? '—'} />
        <Cell label="Lead number" value={displayNumber(call.callerIdNumber)} />
        <Cell label="Agent dialled" value={agentName} />
      </Card>
    </View>
  );
}
```

- [ ] **Step 3: Create `detail/QuickActions.tsx`** (call back, copy, DNC toggle)

```typescript
import { useState } from 'react';
import { Linking, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button } from '@/components/atoms/Button';
import { Text } from '@/components/atoms/Text';
import { showToast } from '@/lib/toast/toast.store';
import type { CallRecord } from '../../models/call-record';
import { useCallback_ } from '../../hooks/use-callback';
import { useDncMutations } from '../../hooks/use-dnc-mutations';
import { displayNumber } from '../../utils/call-format';

type CbState = 'idle' | 'calling' | 'success' | 'error';

export function QuickActions({ call }: Readonly<{ call: CallRecord }>) {
  const inbound = call.direction === 'inbound';
  const contactNumber = inbound ? call.callerIdNumber : call.destinationNumber;
  const [cbState, setCbState] = useState<CbState>('idle');
  const [isDnc, setIsDnc] = useState(call.isDnc ?? false);
  const callback = useCallback_();
  const dnc = useDncMutations();

  const cbLabel =
    cbState === 'calling'
      ? 'Ringing…'
      : cbState === 'success'
        ? 'Call initiated ✓'
        : cbState === 'error'
          ? 'Failed — retry?'
          : 'Call back';

  const handleCallBack = () => {
    if (!contactNumber) return;
    if (!call.extensionNumber) {
      Linking.openURL(`tel:${displayNumber(contactNumber)}`).catch(() => {});
      return;
    }
    setCbState('calling');
    callback.mutate(
      {
        customerPhone: contactNumber,
        agentExtension: call.extensionNumber,
        agentName: call.extension?.agentName ?? undefined,
      },
      {
        onSuccess: () => {
          setCbState('success');
          setTimeout(() => setCbState('idle'), 3000);
        },
        onError: () => {
          setCbState('error');
          setTimeout(() => setCbState('idle'), 3000);
        },
      },
    );
  };

  const handleCopy = () => {
    if (!contactNumber) return;
    Clipboard.setStringAsync(displayNumber(contactNumber)).catch(() => {});
    showToast('success', 'Number copied');
  };

  const handleDnc = () => {
    if (!contactNumber) return;
    if (isDnc) {
      dnc.remove.mutate(contactNumber, { onSuccess: () => setIsDnc(false) });
    } else {
      dnc.add.mutate({ phone: contactNumber }, { onSuccess: () => setIsDnc(true) });
    }
  };

  return (
    <View className="flex-row gap-2 px-4 py-3">
      <Button className="flex-1" disabled={cbState === 'calling'} onPress={handleCallBack}>
        <Text>{cbLabel}</Text>
      </Button>
      <Button variant="outline" onPress={handleCopy}>
        <Text>Copy</Text>
      </Button>
      {contactNumber !== null ? (
        <Button
          variant={isDnc ? 'destructive' : 'outline'}
          disabled={dnc.add.isPending || dnc.remove.isPending}
          onPress={handleDnc}
        >
          <Text>{isDnc ? 'DNC ✕' : 'DNC'}</Text>
        </Button>
      ) : null}
    </View>
  );
}
```

> Verified: `showToast(type, message)` is exported from `src/lib/toast/toast.store.ts` (positional args, `type` is `'success' | 'error' | 'info'`).

- [ ] **Step 4: Create `detail/DetailTabs.tsx`** (history / notes / transcript)

```typescript
import { useState } from 'react';
import { View } from 'react-native';
import { Badge } from '@/components/atoms/Badge';
import { Text } from '@/components/atoms/Text';
import { Tabs, TabsList, TabsTrigger } from '@/components/atoms/Tabs';
import { EmptyState } from '@/components/atoms/EmptyState';
import type { CallRecord } from '../../models/call-record';
import { useCallRecords } from '../../hooks/use-call-records';
import { extractRecords } from '../../models/call-record';
import { formatDateTime, formatDuration, outcomeBadge } from '../../utils/call-format';

export function DetailTabs({ call }: Readonly<{ call: CallRecord }>) {
  const [tab, setTab] = useState('history');
  const inbound = call.direction === 'inbound';
  const contactNumber = inbound ? call.callerIdNumber : call.destinationNumber;

  const historyQuery = useCallRecords({ search: contactNumber ?? '' });
  const history = (historyQuery.data?.pages.flatMap((p) => extractRecords(p)) ?? []).filter(
    (c) => c.uuid !== call.uuid,
  );

  return (
    <View className="px-4 py-3">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-row">
          <TabsTrigger value="history">
            <Text>History ({history.length})</Text>
          </TabsTrigger>
          <TabsTrigger value="notes">
            <Text>Notes</Text>
          </TabsTrigger>
          <TabsTrigger value="transcript">
            <Text>Transcript</Text>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <View className="pt-3">
        {tab === 'history' ? (
          history.length === 0 ? (
            <Text className="text-sm text-muted-foreground">No other calls with this number.</Text>
          ) : (
            <View className="gap-2">
              {history.map((h) => {
                const hb = outcomeBadge(h.status);
                return (
                  <View
                    key={h.uuid}
                    className="flex-row items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <Text className="text-sm text-foreground">
                      {h.direction === 'inbound' ? 'Incoming' : 'Outgoing'}
                    </Text>
                    <Badge variant={hb.variant}>
                      <Text>{hb.label}</Text>
                    </Badge>
                    <Text className="text-xs text-muted-foreground">{formatDateTime(h.startTime)}</Text>
                    <Text className="text-xs text-muted-foreground">
                      {formatDuration(h.billsec || h.duration)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )
        ) : null}

        {tab === 'notes' ? (
          <Text className="text-sm text-muted-foreground">No notes for this call yet.</Text>
        ) : null}

        {tab === 'transcript' ? (
          <EmptyState
            icon="FileText"
            title="Call transcripts"
            description="Coming soon — automatic transcription of recorded calls will appear here."
          />
        ) : null}
      </View>
    </View>
  );
}
```

> Verified: `Tabs` is `@rn-primitives/tabs` Root (accepts `value` + `onValueChange`); `TabsTrigger` takes `value` + children. Usage above matches the atom API.

- [ ] **Step 5: Create `detail/CallDetailScreen.tsx`**

```typescript
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Badge } from '@/components/atoms/Badge';
import { BackButton } from '@/components/atoms/BackButton';
import { EmptyState } from '@/components/atoms/EmptyState';
import { Text } from '@/components/atoms/Text';
import {
  extractRecords,
  type CallRecord,
  type CallsListResponse,
} from '../../models/call-record';
import { useRecordingPlayer } from '../../hooks/use-recording-player';
import { displayNumber, initials, outcomeBadge } from '../../utils/call-format';
import { RecordingButton } from '../RecordingButton';
import { DetailTabs } from './DetailTabs';
import { FactsGrid } from './FactsGrid';
import { QuickActions } from './QuickActions';
import { SpeedToLeadCard } from './SpeedToLeadCard';

/** Find a loaded record by uuid across every cached call-records infinite query. */
function useCachedRecord(uuid: string): CallRecord | undefined {
  const qc = useQueryClient();
  return useMemo(() => {
    const queries = qc.getQueriesData<{ pages: CallsListResponse[] }>({ queryKey: ['call-records'] });
    for (const [, data] of queries) {
      const pages = data?.pages ?? [];
      for (const page of pages) {
        const hit = extractRecords(page).find((r) => r.uuid === uuid);
        if (hit) return hit;
      }
    }
    return undefined;
  }, [qc, uuid]);
}

export function CallDetailScreen({ uuid }: Readonly<{ uuid: string }>) {
  const insets = useSafeAreaInsets();
  const player = useRecordingPlayer();
  const call = useCachedRecord(uuid);

  if (!call) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="px-4 py-2">
          <BackButton onPress={() => router.back()} />
        </View>
        <EmptyState
          icon="Phone"
          title="Call not found"
          description="Open this call from the list to see its details."
        />
      </View>
    );
  }

  const inbound = call.direction === 'inbound';
  const contactNumber = inbound ? call.callerIdNumber : call.destinationNumber;
  const name = call.callerIdName ?? 'Unknown';
  const badge = outcomeBadge(call.status);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-2 px-4 py-2">
        <BackButton onPress={() => router.back()} />
        <Text className="text-lg font-semibold text-foreground">Call detail</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Identity */}
        <View className="flex-row items-center gap-3 px-4 py-3">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Text className="text-sm font-medium text-foreground">
              {name === 'Unknown' ? '?' : initials(name)}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-foreground">{name}</Text>
            <Text className="text-sm text-muted-foreground">{displayNumber(contactNumber)}</Text>
          </View>
          <Badge variant={badge.variant}>
            <Text>{(inbound ? 'Incoming · ' : 'Outgoing · ') + badge.label}</Text>
          </Badge>
        </View>

        <QuickActions call={call} />
        <FactsGrid call={call} />
        <SpeedToLeadCard call={call} />

        {/* Recording */}
        <View className="px-4 py-3">
          <Text className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            Recording
          </Text>
          <View className="flex-row">
            <RecordingButton
              uuid={call.uuid}
              recordingPath={call.recordingPath}
              player={player}
              labeled
            />
          </View>
          {player.error && player.playingId === null ? (
            <Text className="mt-2 text-xs text-muted-foreground">{player.error}</Text>
          ) : null}
        </View>

        <DetailTabs call={call} />
      </ScrollView>
    </View>
  );
}
```

> Verified: `BackButton` accepts an optional `onPress` and defaults to `router.back()` when omitted. The explicit `onPress` above is fine (could also be dropped).

- [ ] **Step 6: Verify and commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/features/callMonitoring/components/detail
git commit -m "feat(call-monitoring): add detail screen (facts, actions, STL, tabs)"
```

Expected: `tsc` exits 0; lint passes.

---

## Task 12: Routes

**Files:**

- Create: `app/(app)/calls/index.tsx`
- Create: `app/(app)/calls/[uuid].tsx`
- Modify: `app/(app)/_layout.tsx`

- [ ] **Step 1: Create `app/(app)/calls/index.tsx`**

```typescript
import { Redirect } from 'expo-router';
import { CallMonitoringScreen } from '@/features/callMonitoring/components/CallMonitoringScreen';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';

export default function CallsRoute() {
  const state = useRequirePermission(PERMISSIONS.CALLS_MONITOR);
  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/" />;
  return <CallMonitoringScreen />;
}
```

- [ ] **Step 2: Create `app/(app)/calls/[uuid].tsx`**

```typescript
import { Redirect, useLocalSearchParams } from 'expo-router';
import { CallDetailScreen } from '@/features/callMonitoring/components/detail/CallDetailScreen';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';

export default function CallDetailRoute() {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const state = useRequirePermission(PERMISSIONS.CALLS_MONITOR);
  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/calls" />;
  return <CallDetailScreen uuid={uuid} />;
}
```

- [ ] **Step 3: Register the screens in `app/(app)/_layout.tsx`**

In the `<Stack>` block, add the tab-root screen alongside the other `animation: 'none'` entries, and the detail screen (default push animation needs no explicit entry, but register it for clarity). Add after the existing `<Stack.Screen name="profile" ... />` line:

```typescript
        <Stack.Screen name="calls/index" options={{ animation: 'none' }} />
        <Stack.Screen name="calls/[uuid]" />
```

- [ ] **Step 4: Verify and commit**

```bash
pnpm exec tsc --noEmit
git add "app/(app)/calls" "app/(app)/_layout.tsx"
git commit -m "feat(call-monitoring): add calls routes and register in app layout"
```

Expected: `tsc` exits 0.

---

## Task 13: Bottom tab entry + permission gate

**Files:**

- Modify: `src/features/new-projects/components/BottomTabBar.tsx`

- [ ] **Step 1: Add the Calls tab to `AUTHED_TABS`**

Insert a `calls` entry into the `AUTHED_TABS` array (place it before `chat` so the bar reads Listings · Leads · Home · Calls · Chat · Profile — adjust order to taste):

```typescript
const AUTHED_TABS: TabItem[] = [
  { key: 'listings', label: 'Listings', icon: 'List', href: '/listings' },
  { key: 'leads', label: 'Leads', icon: 'Users', href: '/leads' },
  { key: 'home', label: 'Home', icon: 'House', href: '/' },
  { key: 'calls', label: 'Calls', icon: 'Phone', href: '/calls' },
  { key: 'chat', label: 'Chat', icon: 'MessageCircle', href: '/chat' },
  { key: 'profile', label: 'Profile', icon: 'User', href: '/profile' },
];
```

- [ ] **Step 2: Compute the permission and add it to the gate map**

After the existing `const canChat = useCan(PERMISSIONS.CHAT_READ);` line, add:

```typescript
const canCalls = useCan(PERMISSIONS.CALLS_MONITOR);
```

Then in the `tabPermission` record inside the `TABS` useMemo, add the `calls` key and include `canCalls` in the dependency array:

```typescript
    const tabPermission: Record<string, boolean> = {
      listings: canListings,
      leads: canLeads,
      home: true,
      calls: canCalls,
      chat: canChat,
      profile: true,
    };
    return AUTHED_TABS.filter((t) => tabPermission[t.key] !== false);
  }, [isAuthenticated, isClient, isCustomer, canListings, canLeads, canChat, canCalls]);
```

- [ ] **Step 3: Verify and commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/features/new-projects/components/BottomTabBar.tsx
git commit -m "feat(call-monitoring): add permission-gated Calls bottom tab"
```

Expected: `tsc` exits 0; lint passes.

---

## Task 14: Final verification + manual QA

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck + lint**

```bash
pnpm exec tsc --noEmit && pnpm lint
```

Expected: both exit 0. Fix anything they report before proceeding.

- [ ] **Step 2: Native rebuild (recording playback needs the new native modules)**

```bash
pnpm ios   # or: pnpm android
```

Expected: app builds and boots in the simulator/emulator with a freshly compiled dev client.

- [ ] **Step 3: Manual QA checklist** (sign in as a user with `calls:monitor`)

Verify each:

- Calls tab appears in the bottom bar; sign in as a user WITHOUT `calls:monitor` and confirm the tab is hidden and `/calls` redirects to `/`.
- Records load as cards; scrolling to the bottom loads the next page; pull-to-refresh refreshes; leaving and returning to the tab refetches (focus).
- Source tabs switch the list and show counts; KPI stat cards update for the selected tab.
- Search (debounced) filters by lead/number/agent; the filter sheet applies direction, outcome, agent, department, and date range; the filter badge count reflects active filters.
- Tap a card → detail screen pushes; back gesture returns.
- Recording button plays audio (only one at a time); a record with no `recordingPath` shows a disabled "No recording" button.
- Detail: Call back initiates (label cycles Ringing → initiated/failed); Copy copies the number; DNC toggles add/remove and the badge updates; History tab lists prior calls with the same number; Notes/Transcript show their placeholders.
- Export opens the OS share sheet with a `call-logs-YYYY-MM-DD.csv` file containing the filtered rows.

- [ ] **Step 4: Final commit (if any QA fixes were made)**

```bash
git add -A
git commit -m "fix(call-monitoring): QA fixes"
```

---

## Self-review notes (addressed)

- **Spec coverage:** stats (Task 8), source tabs (8), filters incl. date range (9, 10), records list w/ pagination + pull-to-refresh + refetch-on-focus (10), recording playback (6, 7 button, 8/11 usage), detail w/ callback + copy + DNC + history/notes/transcript (11), CSV share-export (7, 10), permission gate (12, 13), new tab (13). All covered.
- **Naming consistency:** `useCallback_` used in both Task 5 (def) and Task 11 (QuickActions). `extractRecords`/`extractTotal` defined in Task 2, used in 5/10/11. `RecordingPlayer` type from Task 6 used in 8. `CallFilterDraft` from Task 9 used in 10.
- **Previously-flagged API assumptions now verified against source:** `showToast(type, message)` (`src/lib/toast/toast.store.ts`), `Tabs`/`TabsList`/`TabsTrigger` (`@rn-primitives/tabs`), `BackButton` optional `onPress`. No unverified API assumptions remain.
