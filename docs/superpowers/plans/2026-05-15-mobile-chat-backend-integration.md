# Mobile Chat Backend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mobile chat mock data layer with real backend calls so the inbox lists real conversations, the merged WhatsApp/Email thread loads from the API, sending posts to `/chat/send`, and new messages + status arrive live over socket.io.

**Architecture:** Approach A — axios service (`apiClient`) + TanStack Query hooks + a pure transform layer (backend shapes → existing mobile `ChatContact`/`Message` models) + a socket hook that appends to the query cache. Mirrors the established `src/features/leads` pattern. No Redux/RTK. UI components are reused unchanged except for swapping their data hook and adding loading/error/empty branches.

**Tech Stack:** TypeScript 5.9, React Native 0.81 / Expo 54, Expo Router, TanStack Query v5, axios, socket.io-client v4, date-fns v4, pnpm.

**Spec:** `docs/superpowers/specs/2026-05-15-mobile-chat-backend-integration-design.md`

> **AMENDMENT (user directive, 2026-05-15):** No automated tests. Vitest is
> NOT added (Task 1 dropped and reverted; `transforms.test.ts` and
> `vitest.config.ts` are not created). The pure transform layer (`transforms.ts`)
> is implemented directly and verified by `pnpm exec tsc --noEmit` + `pnpm lint`
> + the final manual QA checklist. Every "write the failing test", "run test",
> and `pnpm test` step below is VOID — replace each with: implement directly,
> then run `pnpm exec tsc --noEmit && pnpm lint`. Task numbering in this doc is
> unchanged; the controller dispatches the equivalent test-free task set
> (effective tasks: 2→types, 3→transforms, 4→services, 5→keys, 6→send hook,
> 7→socket hook, 8→use-conversation, 9→inbox hook, 10→inbox screen,
> 11→conversation screen, 12→cleanup+QA).

**Deviations from spec (intentional, codebase-driven):**

- `src/lib/socket.ts` is **not** modified: `getSocket()` already exists and `resolveSocketUrl()` is already env-driven (`EXPO_PUBLIC_SOCKET_URL`) with documented intent. No port-swap added — follow the existing convention.
- RBAC constant is `PERMISSIONS.CHAT_WRITE` (`'chat:write'`); the mobile permission catalog has no `chat:create`.
- `ConversationScreen` prop `contactId` is renamed to `conversationId` (now a real UUID) for clarity; the route file is updated to match.

---

## File Structure

**Create:**

- `src/features/chat/api/types.ts` — backend DTO types (`ApiConversation`, `ApiMessage`, `SendMessageInput`) + `extractRows` helper.
- `src/features/chat/api/transforms.ts` — pure backend→model mappers (the tested core).
- `src/features/chat/api/transforms.test.ts` — vitest unit tests.
- `src/features/chat/api/services.ts` — axios calls.
- `src/features/chat/hooks/keys.ts` — TanStack query keys.
- `src/features/chat/hooks/use-chat-inbox.ts` — inbox list query.
- `src/features/chat/hooks/use-send-message.ts` — send mutation.
- `src/features/chat/hooks/use-chat-socket.ts` — realtime cache updates.
- `vitest.config.ts` — vitest config (node env, scoped to `src/**/*.test.ts`).

**Modify:**

- `package.json` — add `vitest` devDep + `test` / `test:watch` scripts.
- `src/features/chat/hooks/use-conversation.ts` — full rewrite, real data, same return shape + extra fields.
- `src/features/chat/components/ChatInboxScreen.tsx` — use `useChatInbox()`, loading/error/empty.
- `src/features/chat/components/ConversationScreen.tsx` — `conversationId` prop, loading/error, pass Composer gating.
- `src/features/chat/components/Composer.tsx` — add `emailDisabled` + `sendDisabled` props.
- `app/(app)/chat/[id].tsx` — pass `conversationId` prop.

**Delete:**

- `src/features/chat/constants/mock-data.ts` (last task, after nothing imports it).

---

## Task 1: Add vitest tooling

**Files:**

- Modify: `package.json:5-15` (scripts), `package.json:82-97` (devDependencies)
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest**

Run:

```bash
cd /Users/nabeel.ahmed/Desktop/Projects/boh/boh-mobile && pnpm add -D vitest@^3.2.4
```

Expected: `vitest` added under devDependencies, `pnpm-lock.yaml` updated.

- [ ] **Step 2: Add test scripts**

In `package.json`, the `"scripts"` block, add the two test scripts after `"format:check"`:

```json
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,md}\"",
    "test": "vitest run",
    "test:watch": "vitest",
    "prepare": "husky"
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts`:

```ts
import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@theme': path.resolve(__dirname, 'theme/index.ts'),
    },
  },
});
```

- [ ] **Step 4: Verify the runner starts (no tests yet)**

Run:

```bash
pnpm test
```

Expected: exits 0 with "No test files found, exiting with code 0" (or similar). No error.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore(chat): add vitest for transform unit tests"
```

---

## Task 2: Backend DTO types + extractRows helper

**Files:**

- Create: `src/features/chat/api/types.ts`
- Test: `src/features/chat/api/transforms.test.ts` (created here, expanded in Task 3)

- [ ] **Step 1: Write the failing test**

Create `src/features/chat/api/transforms.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { extractRows } from './types';

describe('extractRows', () => {
  it('returns an array as-is', () => {
    expect(extractRows<number>([1, 2])).toEqual([1, 2]);
  });

  it('unwraps { rows }', () => {
    expect(extractRows<number>({ rows: [3] })).toEqual([3]);
  });

  it('unwraps { items }', () => {
    expect(extractRows<number>({ items: [4] })).toEqual([4]);
  });

  it('unwraps { data: [...] }', () => {
    expect(extractRows<number>({ data: [5] })).toEqual([5]);
  });

  it('unwraps { data: { rows } }', () => {
    expect(extractRows<number>({ data: { rows: [6] } })).toEqual([6]);
  });

  it('returns [] for null/undefined/garbage', () => {
    expect(extractRows<number>(null)).toEqual([]);
    expect(extractRows<number>(undefined)).toEqual([]);
    expect(extractRows<number>(42)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module './types'` / `extractRows is not exported`.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/chat/api/types.ts`:

```ts
/** Backend message direction. */
export type ApiMessageDirection = 'inbound' | 'outbound';

/** Backend delivery status. */
export type ApiMessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

/** A message row as returned by the chat API (`MessageResource`). */
export interface ApiMessage {
  id: string;
  conversationId: string;
  channel?: string | null;
  direction: ApiMessageDirection;
  type?: string | null;
  content?: string | null;
  mediaUrl?: string | null;
  mediaId?: string | null;
  caption?: string | null;
  metadata?: Record<string, unknown> | null;
  status?: ApiMessageStatus | null;
  createdAt: string;
}

/** An enriched conversation row from `GET /chat/conversations`. */
export interface ApiConversation {
  id: string;
  channel?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  leadId?: string | null;
  agentId?: string | null;
  status?: string | null;
  unreadCount?: number | null;
  latestMessage?: ApiMessage | null;
  lastMessageAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Body for `POST /chat/send` (unified channel). */
export interface SendMessageInput {
  channel: 'unified';
  conversationId: string;
  to?: string;
  leadId?: string;
  content: string;
  subject?: string;
}

/**
 * The chat API returns lists in several shapes depending on endpoint and the
 * envelope-unwrapping interceptor. Normalize to a plain array.
 */
export function extractRows<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.rows)) return obj.rows as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (obj.data && typeof obj.data === 'object') {
      const inner = obj.data as Record<string, unknown>;
      if (Array.isArray(inner.rows)) return inner.rows as T[];
      if (Array.isArray(inner.items)) return inner.items as T[];
    }
  }
  return [];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS — 6 `extractRows` assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/features/chat/api/types.ts src/features/chat/api/transforms.test.ts
git commit -m "feat(chat): backend DTO types + extractRows normalizer"
```

---

## Task 3: Pure transform layer (TDD)

**Files:**

- Create: `src/features/chat/api/transforms.ts`
- Test: `src/features/chat/api/transforms.test.ts` (append)

- [ ] **Step 1: Append the failing tests**

Append to `src/features/chat/api/transforms.test.ts`:

```ts
import {
  dayLabel,
  formatClockTime,
  formatInboxTime,
  mapStatus,
  mediaPlaceholder,
  resolveChannel,
  toChatContact,
  toMessage,
  toMessages,
} from './transforms';
import type { ApiConversation, ApiMessage } from './types';

const REF = new Date('2026-05-15T12:00:00.000Z');

describe('formatClockTime', () => {
  it('formats an ISO time as h:mm a', () => {
    expect(formatClockTime('2026-05-15T09:41:00.000Z', REF)).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
  });
  it('returns empty string for null', () => {
    expect(formatClockTime(null, REF)).toBe('');
  });
});

describe('dayLabel', () => {
  it('Today for same day', () => {
    expect(dayLabel('2026-05-15T08:00:00.000Z', REF)).toBe('Today');
  });
  it('Yesterday for the prior day', () => {
    expect(dayLabel('2026-05-14T08:00:00.000Z', REF)).toBe('Yesterday');
  });
  it('weekday for within the last week', () => {
    expect(dayLabel('2026-05-11T08:00:00.000Z', REF)).toBe('Mon');
  });
  it('MMM d for older', () => {
    expect(dayLabel('2026-04-03T08:00:00.000Z', REF)).toBe('Apr 3');
  });
});

describe('resolveChannel', () => {
  it('email when channel is email', () => {
    expect(resolveChannel({ channel: 'email' })).toBe('email');
  });
  it('email when unified with a subject', () => {
    expect(resolveChannel({ channel: 'unified', metadata: { subject: 'Hi' } })).toBe('email');
  });
  it('whatsapp by default', () => {
    expect(resolveChannel({ channel: 'whatsapp' })).toBe('whatsapp');
  });
  it('whatsapp for sms/mms (collapsed)', () => {
    expect(resolveChannel({ channel: 'sms' })).toBe('whatsapp');
  });
});

describe('mapStatus', () => {
  it('pending and sent both map to sent', () => {
    expect(mapStatus('pending')).toBe('sent');
    expect(mapStatus('sent')).toBe('sent');
  });
  it('delivered and read pass through', () => {
    expect(mapStatus('delivered')).toBe('delivered');
    expect(mapStatus('read')).toBe('read');
  });
  it('failed degrades to sent', () => {
    expect(mapStatus('failed')).toBe('sent');
  });
});

describe('mediaPlaceholder', () => {
  it('maps known media types', () => {
    expect(mediaPlaceholder('image')).toBe('[Image]');
    expect(mediaPlaceholder('document')).toBe('[Document]');
  });
  it('empty string for text/unknown', () => {
    expect(mediaPlaceholder('text')).toBe('');
    expect(mediaPlaceholder(null)).toBe('');
  });
});

const baseMsg: ApiMessage = {
  id: 'srv-1',
  conversationId: 'c1',
  channel: 'whatsapp',
  direction: 'outbound',
  type: 'text',
  content: 'Hello there',
  status: 'delivered',
  createdAt: '2026-05-15T09:41:00.000Z',
};

describe('toMessage', () => {
  it('maps an outbound whatsapp text message', () => {
    const m = toMessage(baseMsg, REF);
    expect(m).toMatchObject({
      id: 'srv-1',
      channel: 'whatsapp',
      direction: 'out',
      text: 'Hello there',
      status: 'delivered',
      dayLabel: 'Today',
    });
    expect(m.subject).toBeUndefined();
  });

  it('maps an inbound email with subject and no status', () => {
    const m = toMessage(
      {
        ...baseMsg,
        id: 'srv-2',
        direction: 'inbound',
        channel: 'unified',
        content: 'Body text',
        metadata: { subject: 'Inquiry' },
      },
      REF,
    );
    expect(m.channel).toBe('email');
    expect(m.direction).toBe('in');
    expect(m.subject).toBe('Inquiry');
    expect(m.status).toBeUndefined();
  });

  it('uses caption then media placeholder when content is empty', () => {
    expect(
      toMessage({ ...baseMsg, content: '', caption: 'Floor plan', type: 'document' }, REF).text,
    ).toBe('Floor plan');
    expect(toMessage({ ...baseMsg, content: null, caption: null, type: 'image' }, REF).text).toBe(
      '[Image]',
    );
  });
});

describe('toMessages', () => {
  it('sorts ascending by createdAt', () => {
    const rows: ApiMessage[] = [
      { ...baseMsg, id: 'b', createdAt: '2026-05-15T10:00:00.000Z' },
      { ...baseMsg, id: 'a', createdAt: '2026-05-15T09:00:00.000Z' },
    ];
    expect(toMessages(rows, REF).map((m) => m.id)).toEqual(['a', 'b']);
  });
});

const baseConv: ApiConversation = {
  id: 'c1',
  channel: 'whatsapp',
  customerName: 'Sarah Al Mansouri',
  customerPhone: '+971500000000',
  unreadCount: 3,
  lastMessageAt: '2026-05-15T09:41:00.000Z',
  latestMessage: { ...baseMsg, content: 'See you Thursday' },
};

describe('toChatContact', () => {
  it('maps an enriched conversation', () => {
    const c = toChatContact(baseConv, REF);
    expect(c).toMatchObject({
      id: 'c1',
      name: 'Sarah Al Mansouri',
      lastMessage: 'See you Thursday',
      lastChannel: 'whatsapp',
      unread: 3,
    });
  });

  it('falls back name → phone → email → Unknown', () => {
    expect(toChatContact({ ...baseConv, customerName: null }, REF).name).toBe('+971500000000');
    expect(
      toChatContact(
        { ...baseConv, customerName: null, customerPhone: null, customerEmail: 'a@b.co' },
        REF,
      ).name,
    ).toBe('a@b.co');
    expect(
      toChatContact(
        { ...baseConv, customerName: null, customerPhone: null, customerEmail: null },
        REF,
      ).name,
    ).toBe('Unknown');
  });

  it('formatInboxTime: clock today, dayLabel otherwise', () => {
    expect(formatInboxTime('2026-05-15T09:41:00.000Z', REF)).toMatch(/(AM|PM)$/);
    expect(formatInboxTime('2026-05-14T09:41:00.000Z', REF)).toBe('Yesterday');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module './transforms'`.

- [ ] **Step 3: Write the implementation**

Create `src/features/chat/api/transforms.ts`:

```ts
import { differenceInCalendarDays, format, isToday, isYesterday, parseISO } from 'date-fns';

import type { Channel } from '../models/channel';
import type { Message, MessageStatus } from '../models/message';
import type { ChatContact } from '../models/conversation';
import type { ApiConversation, ApiMessage, ApiMessageStatus } from './types';

/** Subset of fields needed to decide whether a record is an email. */
interface ChannelLike {
  channel?: string | null;
  type?: string | null;
  metadata?: Record<string, unknown> | null;
}

export function resolveChannel(m: ChannelLike): Channel {
  const ch = (m.channel ?? '').toLowerCase();
  if (ch === 'email') return 'email';

  const t = (m.type ?? '').toLowerCase();
  if (t === 'email' || t === 'mail') return 'email';

  const meta = m.metadata ?? {};
  const metaType = meta.type;
  if (typeof metaType === 'string' && metaType.toLowerCase() === 'email') return 'email';

  const subject = meta.subject;
  if ((ch === 'unified' || ch === '') && typeof subject === 'string' && subject.trim() !== '') {
    return 'email';
  }
  return 'whatsapp';
}

export function mapStatus(status: ApiMessageStatus | null | undefined): MessageStatus | undefined {
  switch (status) {
    case 'delivered':
      return 'delivered';
    case 'read':
      return 'read';
    case 'pending':
    case 'sent':
    case 'failed':
      return 'sent';
    default:
      return 'sent';
  }
}

const MEDIA_PLACEHOLDERS: Record<string, string> = {
  image: '[Image]',
  video: '[Video]',
  audio: '[Audio]',
  voice: '[Audio]',
  document: '[Document]',
  location: '[Location]',
  contacts: '[Contact]',
  sticker: '[Sticker]',
};

export function mediaPlaceholder(type: string | null | undefined): string {
  if (!type) return '';
  return MEDIA_PLACEHOLDERS[type.toLowerCase()] ?? '';
}

function safeParse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = parseISO(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatClockTime(iso: string | null | undefined, now: Date = new Date()): string {
  void now; // signature symmetry with dayLabel; clock time is absolute
  const d = safeParse(iso);
  return d ? format(d, 'h:mm a') : '';
}

export function dayLabel(iso: string | null | undefined, now: Date = new Date()): string {
  const d = safeParse(iso);
  if (!d) return '';
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  const diff = differenceInCalendarDays(now, d);
  if (diff > 1 && diff < 7) return format(d, 'EEE');
  return format(d, 'MMM d');
}

/** Inbox preview time: clock if today, otherwise the day label. */
export function formatInboxTime(iso: string | null | undefined, now: Date = new Date()): string {
  const d = safeParse(iso);
  if (!d) return '';
  return isToday(d) ? formatClockTime(iso, now) : dayLabel(iso, now);
}

function bodyText(m: Pick<ApiMessage, 'content' | 'caption' | 'type'>): string {
  if (m.content && m.content.trim() !== '') return m.content;
  if (m.caption && m.caption.trim() !== '') return m.caption;
  return mediaPlaceholder(m.type);
}

export function toMessage(m: ApiMessage, now: Date = new Date()): Message {
  const channel = resolveChannel(m);
  const direction = m.direction === 'outbound' ? 'out' : 'in';
  const subjectRaw = m.metadata?.subject;
  const subject =
    channel === 'email' && typeof subjectRaw === 'string' && subjectRaw.trim() !== ''
      ? subjectRaw
      : undefined;
  return {
    id: m.id,
    channel,
    direction,
    text: bodyText(m),
    subject,
    time: formatClockTime(m.createdAt, now),
    status: direction === 'out' ? mapStatus(m.status) : undefined,
    dayLabel: dayLabel(m.createdAt, now),
  };
}

export function toMessages(rows: ApiMessage[], now: Date = new Date()): Message[] {
  return [...rows]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((m) => toMessage(m, now));
}

export function toChatContact(c: ApiConversation, now: Date = new Date()): ChatContact {
  const lm = c.latestMessage ?? null;
  const lastChannel = lm ? resolveChannel(lm) : resolveChannel({ channel: c.channel });
  const lastMessage = lm ? bodyText(lm) : '';
  const name =
    (c.customerName && c.customerName.trim() !== '' ? c.customerName : null) ??
    (c.customerPhone && c.customerPhone.trim() !== '' ? c.customerPhone : null) ??
    (c.customerEmail && c.customerEmail.trim() !== '' ? c.customerEmail : null) ??
    'Unknown';
  return {
    id: c.id,
    name,
    lastMessage,
    lastChannel,
    lastTime: formatInboxTime(c.lastMessageAt, now),
    unread: c.unreadCount ?? 0,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS — all `transforms` + `extractRows` describe blocks green.

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors for the new files.

- [ ] **Step 6: Commit**

```bash
git add src/features/chat/api/transforms.ts src/features/chat/api/transforms.test.ts
git commit -m "feat(chat): pure backend->model transform layer with unit tests"
```

---

## Task 4: Chat API services

**Files:**

- Create: `src/features/chat/api/services.ts`

- [ ] **Step 1: Write the implementation**

Create `src/features/chat/api/services.ts`:

```ts
import { apiClient } from '@/lib/api';

import { type ApiConversation, type ApiMessage, extractRows, type SendMessageInput } from './types';

const BASE = '/api/v1/chat';

export async function getConversations(): Promise<ApiConversation[]> {
  const { data } = await apiClient.get<unknown>(`${BASE}/conversations`);
  return extractRows<ApiConversation>(data);
}

export async function getConversation(id: string): Promise<ApiConversation> {
  const { data } = await apiClient.get<ApiConversation>(`${BASE}/conversations/${id}`);
  return data;
}

export async function getMessages(conversationId: string): Promise<ApiMessage[]> {
  const { data } = await apiClient.get<unknown>(`${BASE}/conversations/${conversationId}/messages`);
  return extractRows<ApiMessage>(data);
}

export async function sendMessage(input: SendMessageInput): Promise<void> {
  await apiClient.post(`${BASE}/send`, input);
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await apiClient.patch(`${BASE}/conversations/${conversationId}/read`);
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/chat/api/services.ts
git commit -m "feat(chat): chat API service functions"
```

---

## Task 5: Query keys

**Files:**

- Create: `src/features/chat/hooks/keys.ts`

- [ ] **Step 1: Write the implementation**

Create `src/features/chat/hooks/keys.ts`:

```ts
export const chatKeys = {
  all: ['chat'] as const,
  conversations: () => [...chatKeys.all, 'conversations'] as const,
  conversation: (id: string) => [...chatKeys.all, 'conversation', id] as const,
  messages: (id: string) => [...chatKeys.all, 'messages', id] as const,
};
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/chat/hooks/keys.ts
git commit -m "feat(chat): tanstack query keys"
```

---

## Task 6: Send-message mutation hook

**Files:**

- Create: `src/features/chat/hooks/use-send-message.ts`

- [ ] **Step 1: Write the implementation**

Create `src/features/chat/hooks/use-send-message.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { sendMessage } from '../api/services';
import type { SendMessageInput } from '../api/types';
import { chatKeys } from './keys';

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, SendMessageInput>({
    mutationFn: sendMessage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) }).catch(() => {});
      qc.invalidateQueries({ queryKey: chatKeys.conversations() }).catch(() => {});
    },
  });
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/chat/hooks/use-send-message.ts
git commit -m "feat(chat): send-message mutation hook"
```

---

## Task 7: Realtime socket hook

**Files:**

- Create: `src/features/chat/hooks/use-chat-socket.ts`

Reuses the socket singleton already connected app-wide by `NotificationsProvider`
(`src/features/notifications/components/NotificationsProvider.tsx:109`). `getSocket()`
already exists in `src/lib/socket.ts:42`.

- [ ] **Step 1: Write the implementation**

Create `src/features/chat/hooks/use-chat-socket.ts`:

```ts
import { useEffect } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { getSocket } from '@/lib/socket';

import { toMessage } from '../api/transforms';
import type { ApiMessage } from '../api/types';
import type { Message } from '../models/message';
import { chatKeys } from './keys';

const CHAT_EVENTS = [
  'message:incoming',
  'message:outgoing',
  'message:status',
  'chat:message:new',
  'whatsapp:message:new',
  'whatsapp:conversation:update',
] as const;

/** Pull a `MessageResource` out of the various socket payload shapes. */
function extractMessage(payload: unknown): ApiMessage | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  const candidate =
    obj.message && typeof obj.message === 'object' ? (obj.message as Record<string, unknown>) : obj;
  if (typeof candidate.id === 'string' && typeof candidate.conversationId === 'string') {
    return candidate as unknown as ApiMessage;
  }
  return null;
}

/**
 * Append socket-delivered messages into the active conversation's query cache
 * and refresh the inbox. Safe-net invalidation covers truncated payloads.
 */
export function useChatSocket(conversationId: string | undefined): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;
    const socket = getSocket();
    if (!socket) return;

    const handle = (payload: unknown): void => {
      const msg = extractMessage(payload);
      const affects = msg ? msg.conversationId === conversationId : true; // status-only / conversation-update payloads → refetch
      if (msg && msg.conversationId === conversationId) {
        qc.setQueryData<Message[]>(chatKeys.messages(conversationId), (prev) => {
          const next = toMessage(msg);
          const list = prev ?? [];
          if (list.some((m) => m.id === next.id)) {
            return list.map((m) => (m.id === next.id ? next : m));
          }
          return [...list, next].sort((a, b) => a.id.localeCompare(b.id) && 0); // keep order; resort below
        });
        // Re-sort by re-deriving from server on the safety refetch (below);
        // the optimistic append keeps the UI responsive in the meantime.
      }
      if (affects) {
        qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) }).catch(() => {});
        qc.invalidateQueries({ queryKey: chatKeys.conversations() }).catch(() => {});
      }
    };

    for (const evt of CHAT_EVENTS) socket.on(evt, handle);
    return () => {
      for (const evt of CHAT_EVENTS) socket.off(evt, handle);
    };
  }, [conversationId, qc]);
}
```

> Note: ordering correctness is guaranteed by the safety `invalidateQueries`
> (refetch → `toMessages` re-sorts ascending). The optimistic `setQueryData`
> append only needs to show the new bubble immediately; the refetch reconciles.

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors. If lint flags the `&& 0` sort expression as confusing, replace the append branch with the simpler:

```ts
return [...list, next];
```

(The trailing refetch re-sorts, so a plain append is correct and clearer — prefer this form.)

- [ ] **Step 3: Apply the clearer append form**

Edit `src/features/chat/hooks/use-chat-socket.ts` — replace:

```ts
return [...list, next].sort((a, b) => a.id.localeCompare(b.id) && 0); // keep order; resort below
```

with:

```ts
return [...list, next];
```

- [ ] **Step 4: Typecheck + lint again**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/chat/hooks/use-chat-socket.ts
git commit -m "feat(chat): realtime socket cache-update hook"
```

---

## Task 8: Rewrite use-conversation hook

**Files:**

- Modify (full rewrite): `src/features/chat/hooks/use-conversation.ts`

Must keep the exported `ChannelCounts` type and the existing return keys
(`contact`, `subtitle`, `messages`, `activeFilter`, `setActiveFilter`,
`sendChannel`, `setSendChannel`, `counts`, `send`) — `ChannelFilterBar.tsx:10`
imports `ChannelCounts` from here, and `ConversationScreen` destructures the
return. Adds `isLoading`, `isError`, `refetch`, `emailEnabled`, `isSending`.

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/features/chat/hooks/use-conversation.ts` with:

```ts
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import { getConversation, getMessages, markConversationRead } from '../api/services';
import { toChatContact, toMessages } from '../api/transforms';
import type { Channel, ChannelFilter } from '../models/channel';
import type { ChatContact } from '../models/conversation';
import type { Message, SendPayload } from '../models/message';
import { chatKeys } from './keys';
import { useChatSocket } from './use-chat-socket';
import { useSendMessage } from './use-send-message';

export interface ChannelCounts {
  all: number;
  whatsapp: number;
  email: number;
}

const FALLBACK_CONTACT: ChatContact = {
  id: '',
  name: 'Conversation',
  lastMessage: '',
  lastChannel: 'whatsapp',
  lastTime: '',
  unread: 0,
};

/**
 * Real-data conversation state: loads the conversation + its messages, keeps
 * them live over socket.io, and exposes the same shape the UI already consumes
 * plus loading/error/send flags.
 */
export function useConversation(conversationId: string) {
  const convQuery = useQuery({
    queryKey: chatKeys.conversation(conversationId),
    queryFn: () => getConversation(conversationId),
    enabled: !!conversationId,
  });

  const msgsQuery = useQuery({
    queryKey: chatKeys.messages(conversationId),
    queryFn: () => getMessages(conversationId),
    enabled: !!conversationId,
    select: (rows) => toMessages(rows),
  });

  useChatSocket(conversationId);

  // Mark read once the conversation + messages have loaded.
  const hasUnread = (convQuery.data?.unreadCount ?? 0) > 0;
  useEffect(() => {
    if (!conversationId || !hasUnread) return;
    markConversationRead(conversationId).catch(() => {});
  }, [conversationId, hasUnread]);

  const [activeFilter, setActiveFilter] = useState<ChannelFilter>('all');
  const [sendChannel, setSendChannel] = useState<Channel>('whatsapp');

  const allMessages: Message[] = useMemo(() => msgsQuery.data ?? [], [msgsQuery.data]);

  const counts = useMemo<ChannelCounts>(
    () => ({
      all: allMessages.length,
      whatsapp: allMessages.filter((m) => m.channel === 'whatsapp').length,
      email: allMessages.filter((m) => m.channel === 'email').length,
    }),
    [allMessages],
  );

  const visibleMessages = useMemo(
    () =>
      activeFilter === 'all' ? allMessages : allMessages.filter((m) => m.channel === activeFilter),
    [allMessages, activeFilter],
  );

  const conv = convQuery.data;
  const contact = useMemo<ChatContact>(
    () => (conv ? toChatContact(conv) : { ...FALLBACK_CONTACT, id: conversationId }),
    [conv, conversationId],
  );

  const phone = conv?.customerPhone ?? undefined;
  const leadId = conv?.leadId ?? undefined;
  const emailEnabled = !!leadId;

  const sendMutation = useSendMessage(conversationId);
  const send = useCallback(
    (payload: SendPayload) => {
      if (payload.channel === 'email') {
        if (!leadId) return;
        sendMutation.mutate({
          channel: 'unified',
          conversationId,
          leadId,
          subject: payload.subject,
          content: payload.text,
        });
        return;
      }
      sendMutation.mutate({
        channel: 'unified',
        conversationId,
        to: phone,
        leadId,
        content: payload.text,
      });
    },
    [conversationId, phone, leadId, sendMutation],
  );

  return {
    contact,
    subtitle: 'All messages in one thread',
    messages: visibleMessages,
    activeFilter,
    setActiveFilter,
    sendChannel,
    setSendChannel,
    counts,
    send,
    isLoading: convQuery.isLoading || msgsQuery.isLoading,
    isError: convQuery.isError || msgsQuery.isError,
    refetch: () => {
      convQuery.refetch().catch(() => {});
      msgsQuery.refetch().catch(() => {});
    },
    emailEnabled,
    isSending: sendMutation.isPending,
  };
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors. (`ChannelFilterBar` still imports `ChannelCounts` from this module — unchanged export.)

- [ ] **Step 3: Run unit tests (regression)**

Run: `pnpm test`
Expected: PASS — transforms tests still green (no transform change).

- [ ] **Step 4: Commit**

```bash
git add src/features/chat/hooks/use-conversation.ts
git commit -m "feat(chat): wire use-conversation to real API + socket"
```

---

## Task 9: Inbox list hook

**Files:**

- Create: `src/features/chat/hooks/use-chat-inbox.ts`

- [ ] **Step 1: Write the implementation**

Create `src/features/chat/hooks/use-chat-inbox.ts`:

```ts
import { useQuery } from '@tanstack/react-query';

import { getConversations } from '../api/services';
import { toChatContact } from '../api/transforms';
import type { ApiConversation } from '../api/types';
import type { ChatContact } from '../models/conversation';
import { chatKeys } from './keys';

export function useChatInbox() {
  return useQuery<ApiConversation[], Error, ChatContact[]>({
    queryKey: chatKeys.conversations(),
    queryFn: getConversations,
    select: (rows) =>
      [...rows]
        .sort(
          (a, b) =>
            new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime(),
        )
        .map((c) => toChatContact(c)),
  });
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/chat/hooks/use-chat-inbox.ts
git commit -m "feat(chat): inbox conversations list hook"
```

---

## Task 10: Wire ChatInboxScreen

**Files:**

- Modify: `src/features/chat/components/ChatInboxScreen.tsx`

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/features/chat/components/ChatInboxScreen.tsx` with:

```tsx
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { EmptyState } from '@/components/atoms/EmptyState';
import { Text } from '@/components/atoms/Text';
import { MAIN_HEADER_HEIGHT } from '@/components/organisms';
import { useThemeColor } from '@theme';

import { useChatInbox } from '../hooks/use-chat-inbox';
import type { ChatContact } from '../models/conversation';
import { ContactRow } from './ContactRow';

export function ChatInboxScreen() {
  const insets = useSafeAreaInsets();
  const primary = useThemeColor('--primary');
  const { data, isLoading, isError, refetch } = useChatInbox();

  const openConversation = useCallback((id: string) => {
    router.push(`/chat/${id}`);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ChatContact }) => <ContactRow contact={item} onPress={openConversation} />,
    [openConversation],
  );

  const contacts = data ?? [];

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top + MAIN_HEADER_HEIGHT }}>
      <View className="px-4 pb-2 pt-4">
        <Text variant="heading">Messages</Text>
        <Text variant="muted" className="mt-0.5">
          WhatsApp & email in one place
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={primary} />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState
            icon="MessageSquareDashed"
            title="Couldn't load conversations"
            description="Check your connection and try again."
          />
          <Pressable
            onPress={() => refetch()}
            accessibilityRole="button"
            className="mt-4 rounded-full bg-primary px-5 py-2 active:opacity-80"
          >
            <Text className="font-semibold text-primary-foreground">Retry</Text>
          </Pressable>
        </View>
      ) : contacts.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState
            icon="MessageSquareDashed"
            title="No conversations yet"
            description="WhatsApp and email threads will appear here."
          />
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View className="ml-[68px] h-px bg-border" />}
          contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        />
      )}
    </View>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors. (`EmptyState` is the same atom `MessageList.tsx:4` already uses; `MessageSquareDashed` icon already used there.)

- [ ] **Step 3: Commit**

```bash
git add src/features/chat/components/ChatInboxScreen.tsx
git commit -m "feat(chat): inbox screen on real conversations data"
```

---

## Task 11: Wire ConversationScreen + Composer gating + route

**Files:**

- Modify: `src/features/chat/components/Composer.tsx`
- Modify: `src/features/chat/components/ConversationScreen.tsx`
- Modify: `app/(app)/chat/[id].tsx`

- [ ] **Step 1: Add Composer gating props**

In `src/features/chat/components/Composer.tsx`, replace the `Props` interface (lines 15-19):

```tsx
interface Props {
  channel: Channel;
  onChannelChange: (channel: Channel) => void;
  onSend: (payload: SendPayload) => void;
}
```

with:

```tsx
interface Props {
  channel: Channel;
  onChannelChange: (channel: Channel) => void;
  onSend: (payload: SendPayload) => void;
  /** When false, the Email send option is disabled (no linked lead). */
  emailEnabled?: boolean;
  /** When true, the whole composer is disabled (no chat:write permission). */
  sendDisabled?: boolean;
}
```

- [ ] **Step 2: Disable the Email pill in SendViaToggle**

In `Composer.tsx`, replace the `SendViaToggle` function (lines 21-61) with:

```tsx
function SendViaToggle({
  channel,
  onChannelChange,
  emailEnabled = true,
}: Readonly<Pick<Props, 'channel' | 'onChannelChange' | 'emailEnabled'>>) {
  const successColor = useThemeColor('--success');
  const infoColor = useThemeColor('--info');

  return (
    <View className="flex-row items-center px-4 pb-2 pt-3">
      <Text className="mr-3 text-sm font-medium text-muted-foreground">Send via</Text>
      {(['whatsapp', 'email'] as const).map((c) => {
        const meta = CHANNEL_META[c];
        const isActive = channel === c;
        const accent = c === 'whatsapp' ? successColor : infoColor;
        const disabled = c === 'email' && !emailEnabled;
        return (
          <Pressable
            key={c}
            onPress={() => !disabled && onChannelChange(c)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive, disabled }}
            className={cn(
              'mr-2 flex-row items-center rounded-full border px-3 py-1.5 active:opacity-80',
              isActive ? 'border-transparent' : 'border-border bg-card',
              disabled ? 'opacity-40' : '',
            )}
            style={isActive ? { backgroundColor: accent } : undefined}
          >
            <Icon name={meta.icon} size={14} color={isActive ? '#FFFFFF' : accent} />
            <Text
              className={cn(
                'ml-1.5 text-sm font-semibold',
                isActive ? 'text-white' : 'text-foreground',
              )}
            >
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 3: Thread the new props through the Composer body**

In `Composer.tsx`, replace the `Composer` function signature + first lines (lines 80-88):

```tsx
export function Composer({ channel, onChannelChange, onSend }: Readonly<Props>) {
  const [text, setText] = useState('');
  const [subject, setSubject] = useState('');
  const mutedColor = useThemeColor('--muted-foreground');
  const primaryFg = useThemeColor('--primary-foreground');

  const isEmail = channel === 'email';
  const canSend = text.trim().length > 0 && (!isEmail || subject.trim().length > 0);
```

with:

```tsx
export function Composer({
  channel,
  onChannelChange,
  onSend,
  emailEnabled = true,
  sendDisabled = false,
}: Readonly<Props>) {
  const [text, setText] = useState('');
  const [subject, setSubject] = useState('');
  const mutedColor = useThemeColor('--muted-foreground');
  const primaryFg = useThemeColor('--primary-foreground');

  const isEmail = channel === 'email';
  const canSend =
    !sendDisabled && text.trim().length > 0 && (!isEmail || subject.trim().length > 0);
```

- [ ] **Step 4: Pass emailEnabled into the toggle**

In `Composer.tsx`, replace the `SendViaToggle` usage (line 105):

```tsx
<SendViaToggle channel={channel} onChannelChange={onChannelChange} />
```

with:

```tsx
<SendViaToggle channel={channel} onChannelChange={onChannelChange} emailEnabled={emailEnabled} />
```

- [ ] **Step 5: Rewrite ConversationScreen**

Replace the entire contents of `src/features/chat/components/ConversationScreen.tsx` with:

```tsx
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, useKeyboardState } from 'react-native-keyboard-controller';
import { StatusBar } from 'expo-status-bar';

import { EmptyState } from '@/components/atoms/EmptyState';
import { Text } from '@/components/atoms/Text';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';
import { useThemeColor } from '@theme';

import { useConversation } from '../hooks/use-conversation';
import { ChannelFilterBar } from './ChannelFilterBar';
import { Composer } from './Composer';
import { ConversationHeader } from './ConversationHeader';
import { MessageList } from './MessageList';

interface Props {
  conversationId: string;
}

export function ConversationScreen({ conversationId }: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardState((s) => s.isVisible);
  const primary = useThemeColor('--primary');
  const canWrite = useRequirePermission(PERMISSIONS.CHAT_WRITE) === 'allowed';

  const {
    contact,
    subtitle,
    messages,
    activeFilter,
    setActiveFilter,
    sendChannel,
    setSendChannel,
    counts,
    send,
    isLoading,
    isError,
    refetch,
    emailEnabled,
  } = useConversation(conversationId);

  // Keep the composer channel valid when email is unavailable.
  useEffect(() => {
    if (!emailEnabled && sendChannel === 'email') setSendChannel('whatsapp');
  }, [emailEnabled, sendChannel, setSendChannel]);

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="light" />
      <ConversationHeader name={contact.name} subtitle={subtitle} />
      <ChannelFilterBar active={activeFilter} counts={counts} onChange={setActiveFilter} />

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {isLoading ? (
          <View className="flex-1 items-center justify-center bg-background">
            <ActivityIndicator color={primary} />
          </View>
        ) : isError ? (
          <View className="flex-1 items-center justify-center bg-background px-8">
            <EmptyState
              icon="MessageSquareDashed"
              title="Couldn't load this conversation"
              description="Check your connection and try again."
            />
            <Pressable
              onPress={refetch}
              accessibilityRole="button"
              className="mt-4 rounded-full bg-primary px-5 py-2 active:opacity-80"
            >
              <Text className="font-semibold text-primary-foreground">Retry</Text>
            </Pressable>
          </View>
        ) : (
          <MessageList messages={messages} />
        )}
        <View style={{ paddingBottom: keyboardVisible ? 0 : insets.bottom }}>
          <Composer
            channel={sendChannel}
            onChannelChange={setSendChannel}
            onSend={send}
            emailEnabled={emailEnabled}
            sendDisabled={!canWrite}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
```

- [ ] **Step 6: Update the route to pass conversationId**

Replace the entire contents of `app/(app)/chat/[id].tsx` with:

```tsx
import { Redirect, useLocalSearchParams } from 'expo-router';

import { ConversationScreen } from '@/features/chat';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';

export default function ConversationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useRequirePermission(PERMISSIONS.CHAT_READ);

  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/chat" />;

  return <ConversationScreen conversationId={id} />;
}
```

- [ ] **Step 7: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors. (`ConversationScreen` is exported via `src/features/chat/index.ts:2` — the named export name is unchanged, only its prop changed.)

- [ ] **Step 8: Commit**

```bash
git add src/features/chat/components/Composer.tsx src/features/chat/components/ConversationScreen.tsx "app/(app)/chat/[id].tsx"
git commit -m "feat(chat): conversation screen on real data + composer gating"
```

---

## Task 12: Remove mock data + final verification

**Files:**

- Delete: `src/features/chat/constants/mock-data.ts`

- [ ] **Step 1: Confirm nothing imports the mock module**

Run:

```bash
grep -rn "constants/mock-data\|MOCK_CONTACTS\|MOCK_CONVERSATIONS\|getMockConversation" src app
```

Expected: no matches. (If any remain, they are a wiring bug from Tasks 8/10 — fix before deleting.)

- [ ] **Step 2: Delete the mock data file**

Run:

```bash
git rm src/features/chat/constants/mock-data.ts
```

- [ ] **Step 3: Full typecheck, lint, tests**

Run:

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
```

Expected: all pass. No reference to the deleted module.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(chat): remove UI mock data — backend integration complete"
```

- [ ] **Step 5: Manual QA against QA backend (record results)**

Set `EXPO_PUBLIC_API_BASE_URL` to the QA API and `EXPO_PUBLIC_SOCKET_URL` to the QA socket origin, run `pnpm start`, log in, then verify:

1. `/chat` lists real conversations (name, last-message preview, time, unread badge); pull data matches QA.
2. Tapping a row opens the thread; WhatsApp + Email messages interleave with correct channel chips, day dividers, and outbound status ticks.
3. Channel filter pills filter the timeline; counts are correct.
4. Sending a WhatsApp message posts to `/chat/send` and the bubble appears; the inbox preview updates.
5. On a conversation with a linked lead, the Email toggle is enabled and an email (subject + body) sends; on a conversation with no `leadId`, the Email pill is disabled.
6. From the web counterpart, send an inbound message / change status — it appears live in the open mobile thread and the inbox unread/preview updates.
7. A `chat:read`-only user can view but the composer is disabled.

Note any failures and open follow-up tasks; do not mark the feature done until 1–6 pass.

---

## Self-Review

**Spec coverage:**

- Inbox list (`GET /chat/conversations` → `ChatContact[]`) — Tasks 4, 9, 10. ✅
- Conversation meta + messages (`GET /chat/conversations/:id`, `/messages`) — Tasks 4, 8. ✅
- Send WhatsApp/Email (`POST /chat/send` unified, email needs leadId) — Tasks 6, 8, 11. ✅
- Mark read on open (`PATCH …/read`) — Tasks 4, 8. ✅
- Realtime socket append + invalidate — Task 7. ✅
- Transform layer (resolveChannel/toMessage/toChatContact/day+clock/status) — Task 3, TDD. ✅
- UI minimal churn + loading/error/empty + email gating + CHAT_WRITE gate + route param — Tasks 10, 11. ✅
- vitest infra (the one flagged addition) — Task 1. ✅
- Out-of-scope items (nested email threads, reply-to UI, template picker, media send, SMS, pagination) — not implemented, as specified. ✅

**Placeholder scan:** No TBD/TODO; every code step shows full code; the only "fix if lint flags" note (Task 7) ships with the concrete preferred replacement and an explicit apply step (Step 3). ✅

**Type consistency:** `ApiConversation`/`ApiMessage`/`SendMessageInput` defined in Task 2 are used unchanged in Tasks 4/6/7/8/9. `chatKeys` (Task 5) used identically in Tasks 6/7/8/9. `ChannelCounts` export preserved in Task 8 (consumed by `ChannelFilterBar`). `useConversation` return keys preserved + only additive fields consumed by the rewritten `ConversationScreen` (Task 11). `ConversationScreen` prop `conversationId` matches the Task 11 route change. `toChatContact`/`toMessages` signatures match call sites. ✅
