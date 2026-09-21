# Mobile Chat — Backend Integration Design Spec

**Date:** 2026-05-15
**Status:** Approved (design), pending implementation plan
**Scope:** Wire the already-built chat UI to the real backend. Contact (conversation)
listing + unified WhatsApp/Email conversation view + send + realtime receive.
**Companion spec:** `2026-05-15-chat-messaging-ui-design.md` (UI, mock state). This
spec replaces the mock data layer described there; UI components are unchanged.

## Goal

The mobile chat screens render mock data (`MOCK_CONTACTS`, `getMockConversation`,
local `useConversation` state). Replace the data layer with real backend calls so
the inbox lists real conversations, the conversation screen shows the real merged
WhatsApp + Email thread, sending hits the backend, and new/incoming messages and
delivery/read status arrive live over socket.io. UI components, routing, theme,
and animations stay exactly as the UI spec defines.

## Reference Implementations (web)

Two web surfaces in `boh-lead-magnet` were mapped as the source of truth:

- `src/features/chat/components/whatsapp/*` + route `my-account/chat/whatsapp-chat`
  — WhatsApp-only inbox + conversation, conversationId-based.
- `src/features/leads/components/sections/CommunicationSection.tsx` (route
  `my-account/manage-leads/[id]`) — unified WhatsApp + Email merged thread,
  `useSendUnifiedChatMessageMutation` against `POST /chat/send` with
  `channel: 'unified'`, email detection/threading via `metadata.subject` /
  `metadata.replyToMessageId`, channel badges, composer channel toggle.

Mobile is a hybrid: a **standalone unified inbox** (all conversations, like the
whatsapp-chat list but not channel-filtered) drilling into a **merged
conversation screen** (like CommunicationSection but keyed by `conversationId`
from the inbox, not lead-scoped).

## Backend Contract (consumed)

Base: `CONFIG.API_BASE_URL` + `/api/v1` (e.g. `http://localhost:3000/api/v1`).
Auth: JWT `Authorization: Bearer <token>` (existing axios interceptor). Perms:
`chat:read` (list/messages), `chat:create` (send).

| Purpose           | Method + path                          | Notes                                                                                                                   |
| ----------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Inbox list        | `GET /chat/conversations`              | No `channel` param (unified, all). Returns enriched conversations with `latestMessage`, `lastMessageAt`, `unreadCount`. |
| Conversation meta | `GET /chat/conversations/:id`          | Header + send context: `customerName`, `customerPhone`, `leadId`, `channel`, `status`.                                  |
| Messages          | `GET /chat/conversations/:id/messages` | No `channel` filter (unified). Returns `{ rows: MessageResource[], count }`.                                            |
| Send (WhatsApp)   | `POST /chat/send`                      | `{ channel:'unified', conversationId, to:<phone>, leadId?, content }`                                                   |
| Send (Email)      | `POST /chat/send`                      | `{ channel:'unified', conversationId, leadId, subject, content }`                                                       |
| Mark read         | `PATCH /chat/conversations/:id/read`   | Fired on conversation open.                                                                                             |

`MessageResource` (backend → transform input): `id, conversationId, channel,
direction ('inbound'|'outbound'), type, content, mediaUrl, mediaId, caption,
metadata (subject, cc, replyToMessageId), status
('pending'|'sent'|'delivered'|'read'|'failed'), createdAt, senderInfo`.

Enriched conversation: `id, channel, customerPhone, customerEmail, customerName,
leadId, agentId, status, unreadCount, latestMessage{content,type,channel,...},
lastMessageAt, metadata`.

## Architecture (Approach A — service + TanStack Query + transforms + socket)

Mirrors the established `src/features/leads` / `src/features/auth` pattern
(plain axios service fn + `useQuery`/`useMutation` hook). No Redux/RTK (the app
uses TanStack Query; web's RTK slice is not ported).

New / changed files under `src/features/chat/`:

```text
api/
  services.ts        axios calls via existing apiClient (paths under /api/v1/chat)
  transforms.ts      PURE: backend shapes -> mobile models (unit-tested core)
  transforms.test.ts transform unit tests (see Testing)
hooks/
  use-chat-inbox.ts  useQuery(['chat','conversations']) -> ChatContact[]
  use-conversation.ts  REWRITE of existing mock hook — same return shape, real data
  use-send-message.ts  useMutation -> POST /chat/send, cache invalidation
  use-chat-socket.ts   attach listeners to the existing socket singleton
constants/
  mock-data.ts       no longer imported by screens; deleted. Representative
                     payload shapes copied into api/transforms.test.ts fixtures.
```

`src/lib/socket.ts`: add a `getSocket()` accessor returning the current
singleton (created by the existing `NotificationsProvider` → `connectSocket`),
and add a local `3000 → 3002` port-swap fallback in `resolveSocketUrl` so QA
(same-origin / `EXPO_PUBLIC_SOCKET_URL`) and local dev both work, env-driven, no
hardcoded host.

UI components (`ChatInboxScreen`, `ConversationScreen`, `MessageList`,
`Composer`, etc.) are **not modified** beyond swapping their data source hook and
adding loading / error / empty branches. `useConversation` keeps its exact
current return shape (`{ contact, subtitle, messages, activeFilter,
setActiveFilter, sendChannel, setSendChannel, counts, send }`).

## Data Flow

```text
Inbox screen
  useChatInbox() -> services.getConversations() -> transforms.toChatContacts()
  TanStack key: ['chat','conversations']
  row press -> router.push(`/(app)/chat/${conversation.id}`)   // id = conversationId (UUID)

Conversation screen  (id = conversationId from route)
  useConversation(id):
    getConversation(id)         key ['chat','conversation', id]   -> header/send ctx
    getMessages(id)             key ['chat','messages', id]       -> Message[]
    useChatSocket(id)           live append + invalidate
    on mount: markRead(id)
  send(payload):
    useSendMessage() -> POST /chat/send
      whatsapp: {channel:'unified', conversationId:id, to:phone, leadId?, content:text}
      email:    {channel:'unified', conversationId:id, leadId, subject, content:text}
    invalidate ['chat','messages',id] + ['chat','conversations']
```

## Transform Layer (the nuanced, TDD core)

Pure functions in `api/transforms.ts`, fully unit-tested.

**`toChatContact(conversation)` → `ChatContact`**

- `id` = conversation.id
- `name` = `customerName ?? customerPhone ?? customerEmail ?? 'Unknown'`
- `lastMessage` = `latestMessage.content`; media types → `'[Image]'` /
  `'[Document]'` / `'[Audio]'` / `'[Location]'` placeholder
- `lastChannel` = channel of `latestMessage` resolved via `resolveChannel`
  (below); fallback `conversation.channel`
- `lastTime` = `formatClockTime(lastMessageAt)` → e.g. `"9:41 AM"`
- `unread` = `unreadCount`

**`toMessage(resource)` → `Message`**

- `channel` = `resolveChannel(resource)`
- `direction` = `outbound → 'out'`, `inbound → 'in'`
- `text` = `content`; media → `caption` or `'[Image]'`/`'[Document]'`/… placeholder
- `subject` = `metadata.subject` (email only)
- `time` = `formatClockTime(createdAt)`
- `status` (outbound only) = map `pending|sent → 'sent'`, `delivered →
'delivered'`, `read → 'read'`, `failed → 'sent'` (failure surfaced via send-
  error toast, not a bubble state — mobile `MessageStatus` has no `failed`)
- `dayLabel` = `Today` | `Yesterday` | weekday (`Mon`) within 7d | `MMM D` else

**`resolveChannel(resource|latestMessage)` → `'whatsapp' | 'email'`**
Mirrors web `isEmailChatMessage`: `email` if `channel === 'email'` OR
(`channel === 'unified'` AND `metadata.subject` is a non-empty string) OR
`type`/`metadata.type` is `email`. Otherwise `whatsapp`. (SMS/MMS, if ever
returned, collapse to `whatsapp` for display — out of scope to surface.)

Messages sorted ascending by `createdAt` before grouping.

## Realtime (`use-chat-socket.ts`)

Reuse the socket.io singleton already connected by `NotificationsProvider`
(JWT in handshake `auth.token`). The hook, scoped to the active
`conversationId`, subscribes to the same event set the web uses:
`message:incoming`, `message:outgoing`, `message:status`, `chat:message:new`,
`whatsapp:message:new`, `whatsapp:conversation:update`.

On an event whose payload `conversationId` matches the active conversation:

1. Append the transformed message into the `['chat','messages',id]` TanStack
   cache via `queryClient.setQueryData` — dedupe by message `id`, re-sort by
   time, status events patch the matching message's `status`.
2. `invalidateQueries(['chat','conversations'])` so the inbox preview/unread
   refresh.
3. Always `invalidateQueries(['chat','messages',id])` as a safety refetch (web
   does the same — covers payloads the socket may truncate).

Listeners are added on mount / removed on unmount and on `conversationId`
change. If the socket is not yet connected, the queries' normal fetch + the
5-min `staleTime` still show data; live updates resume on (re)connect.

## UI Wiring (minimal churn)

- `ChatInboxScreen`: replace `MOCK_CONTACTS` with `useChatInbox()`. Add: spinner
  while `isLoading`, inline error + retry on `isError`, empty-state copy when
  zero conversations.
- Route param: `/(app)/chat/[id]` `id` is now a real conversation UUID supplied
  by the inbox push. Route shell unchanged (thin gate → screen).
- `useConversation(id)` rewritten internally; **same return shape** so
  `ConversationScreen` / `MessageList` / `Composer` need no structural change,
  only loading/empty branches in `ConversationScreen`.
- Composer email mode: backend email send requires `leadId`. If the
  conversation has no `leadId`, the email send-via option is disabled with a
  short inline note ("Email needs a linked lead"); WhatsApp still works.
- Send errors → existing toast pattern (`extractErrorMessage`), input preserved.
- `markRead(id)` fired once on conversation mount.
- Composer enablement may also respect `PERMISSIONS.CHAT_CREATE` (read-only
  users can view but not send) — reuse the existing permission hook.

## Environment / Config

Purely env-driven, no hardcoded host (per user). `EXPO_PUBLIC_API_BASE_URL`
selects backend (QA has seeded test conversations for verification; code is
identical across envs). `EXPO_PUBLIC_SOCKET_URL` overrides socket origin; when
unset, `resolveSocketUrl` returns the API origin with a local `:3000 → :3002`
swap so a locally-run backend's separate socket port works without extra config.

## Out of Scope (YAGNI — flagged, not built)

- Nested email thread grouping (`EmailThreadGroup` tree). Mobile renders emails
  flat in the merged timeline with the email channel chip + `subject`.
- Email reply-to threading UI (`replyToMessageId` compose affordance). Plain
  email send only this pass.
- WhatsApp 24h-window template picker. If the backend rejects an out-of-window
  send, surface the error via toast (no template UI).
- Media attachment **send** + rich media rendering. Text + caption/placeholder
  only; existing non-functional composer toolbar buttons stay inert (per UI spec).
- SMS / MMS channels; CC/BCC email fields; message pagination/infinite scroll
  (load full thread, as web whatsapp list does); "start new conversation" (inbox
  only lists existing conversations, so `conversationId` always present).

## Testing

The repo has **no test runner** (pre-commit is lint + prettier only). The
risk concentrates entirely in the pure transform functions, so:

- Add `vitest` as a dev-dependency scoped to transform tests only
  (`src/features/chat/api/transforms.test.ts`), plus a `pnpm test` script. No CI
  / pre-commit change. This is the single infra addition and is called out for
  the user-review gate.
- TDD `transforms.ts`: `toChatContact`, `toMessage`, `resolveChannel`,
  `formatClockTime`, `dayLabel`, status mapping — using fixtures derived from
  real backend payload shapes (seed from current `mock-data.ts` + the mapped
  `MessageResource` contract).
- Hooks / socket: no automated tests (RN runtime, no harness); verified
  manually against QA seeded data — inbox lists real conversations, open a
  thread, send WhatsApp + Email, confirm live inbound + status ticks.

Acceptance:

1. `/chat` lists real conversations (name, last message, time, unread) from
   `GET /chat/conversations`; tap opens the real thread.
2. Conversation screen shows the real merged WhatsApp + Email timeline with
   correct channel chips, day dividers, and outbound status ticks.
3. Sending WhatsApp and Email posts to `/chat/send` and the message appears;
   email disabled when no `leadId`.
4. An inbound message / status change sent from the web counterpart appears
   live in the open mobile thread and updates the inbox preview/unread.
