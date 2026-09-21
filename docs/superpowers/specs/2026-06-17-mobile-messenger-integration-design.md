# Mobile Messenger Integration + Voice Recording — Design

**Date:** 2026-06-17
**Repo:** `boh-mobile`
**Status:** Design — pending approval

## 1. Goal

Add Meta Messenger as a first-class channel in the mobile chat, matching the existing WhatsApp UX: inbound display, outbound text, media (photo/video/document), message reactions, and message reply. Additionally add **voice-note recording** (net-new — no channel has it yet) across Messenger + WhatsApp.

The middle "channel selector" screen currently shows Messenger as a disabled "Coming soon" tile. This work makes it live.

## 2. Backend reality (verified — zero backend changes required)

The NestJS backend already ships a complete Messenger module (`boh-lead-magnet-backend/src/modules/chat/messenger/`), registered in `chat.module.ts`, gated on `ENABLE_MESSENGER=true`. Confirmed working surface:

- **Inbound webhook**: verify token + HMAC-SHA256 signature, dedupe by `mid`, echo-skip, typing events, CDN→Azure media mirroring.
- **Outbound text**: `POST /api/v1/chat/messenger/messages` body `{ conversationId, content }`.
- **Outbound media/voice**: `POST /api/v1/chat/messenger/messages/media` multipart (`file` + `conversationId` field). Audio native for `audio/mp4|aac|mpeg|amr|ogg`, else sent as file.
- **Typing**: `POST /api/v1/chat/messenger/conversations/:id/typing`.
- **Conversations** surface in the unified `GET /chat/conversations` (channel-agnostic `findAll`), and `GET /chat/conversations/:id/messages` returns messenger messages.
- **Reactions**: `PUT /chat/messages/:id/reactions` persists + emits socket for ANY channel; Meta-sync fires only for WhatsApp (Messenger reaction = local-only — acceptable per "best-effort").
- **Sockets**: same event names as WhatsApp (`message:incoming`, `message:outgoing`, `typing:indicator`).

### Three constraints that drive the mobile design

1. **Messenger is NOT routable through `/chat/send`** — that handler 400s on `channel=messenger`. Messenger uses its **own two endpoints**, keyed by `conversationId` (PSID resolved server-side). No `to`/`leadId` in the body.
2. **Messenger is reply-only (inbound-first)** — Meta policy: the customer must message first. No agent-initiated Messenger thread. Threads appear in the inbox when a customer writes. The selector's Messenger tile opens the **inbox filtered to Messenger**, never a compose/new-chat screen.
3. **No native reply primitive + no Meta reaction push for Messenger** — outbound reply sends as plain text (local quote UI only); reactions persist + show locally but do not round-trip to Facebook. This is the agreed "display inbound, best-effort outbound" scope.

## 3. UX decisions (locked via visual companion)

- **Voice gesture: Hold + lock (full parity).** Press-and-hold mic to record; slide ↑ locks hands-free (then shows ✕ cancel / ➤ send); release sends if not locked; slide ← cancels.
- **Composer media layout: single `＋` → bottom sheet** with Photo / Video / Document / Camera. Mic sits on the right and swaps to a Send button when text is present. This replaces today's `Alert.alert`-based attach menu.

## 4. Approaches considered

**A. Extend the existing unified pipeline with a Messenger branch (recommended).**
Keep one `Composer`, one `MessageList`, one `useConversation`. Add `'messenger'` to the channel model; add a Messenger send path inside `useConversation.send()` that calls new Messenger service functions; the conversation screen detects a Messenger conversation and adapts (no Send-via toggle, no template/24h logic). Reuses all rendering, optimistic-send, retry, socket, reaction code.
_Trade-off:_ `send()` gains a third branch; manageable since the branching already exists for email vs whatsapp.

**B. Fork a dedicated Messenger conversation stack** (separate hook + screens).
_Trade-off:_ Large duplication of bubble/list/reaction/socket logic; guaranteed drift. Rejected.

**C. Add a backend `/chat/send` messenger route** so mobile stays uniform.
_Trade-off:_ Violates "no backend changes"; backend deliberately separates Messenger. Rejected.

→ **Approach A.**

## 5. Architecture & components

### 5.1 Channel model — `src/features/chat/models/channel.ts`

- `Channel = 'whatsapp' | 'email' | 'messenger'`.
- Add `CHANNEL_META.messenger` (label "Messenger", icon `MessageCircle` or `MessagesSquare`, a new accent — introduce `--messenger` token or reuse `--info`; chip variant `infoSoft` initially).
- `CHANNEL_FILTERS` append `'messenger'`.
- Note: `accentToken`/`chipVariant` unions widen to include the messenger choice.

### 5.2 Message + payload types — `src/features/chat/models/message.ts`

- `MediaKind` adds `'audio'`.
- `SendPayload` adds a messenger variant:
  `{ channel: 'messenger'; text: string; attachment?: PickedAsset; replyTo?: MessageReplyRef }`.
- `PickedAsset` gains `kind: 'audio'` support (voice notes); add optional `durationMs?` for the voice bubble.

### 5.3 API layer

- **`api/types.ts`**: add `SendMessengerInput = { conversationId; content?: string }` and `SendMessengerMediaInput = { conversationId; caption?; file: { uri; name; type } }`.
- **`api/services.ts`**: add
  - `sendMessengerMessage(input)` → `POST /chat/messenger/messages`.
  - `sendMessengerMedia(input)` → `POST /chat/messenger/messages/media` (FormData, `Content-Type: undefined` like existing `sendMessage`).
- **`api/transforms.ts`**: `resolveChannel()` recognizes `m.channel === 'messenger'`; `mediaKind()` already maps `'audio'|'voice'` → ensure it yields `'audio'`.

### 5.4 Hooks

- **`use-send-messenger.ts`** (new): two mutations (text, media) invalidating `chatKeys.messages` + inbox, mirroring `use-send-message.ts`.
- **`use-conversation.ts`**:
  - `ChannelCounts` adds `messenger`.
  - `send()` adds a `payload.channel === 'messenger'` branch → optimistic bubble (reuse `buildOptimisticMessage` with `channel:'messenger'`) → call messenger text or media mutation with `conversationId`. No `to`/`leadId`.
  - `retry()` handles the messenger branch.
  - Expose whether the active conversation is Messenger (derive from `conv.channel`) so the screen can adapt.

### 5.5 Conversation screen — `ConversationScreen.tsx`

- When conversation channel is `messenger`:
  - Hide the WhatsApp/Email "Send via" toggle (Messenger is single-channel).
  - Skip WhatsApp 24h-window + template gating (`whatsappWindowOpen`/`whatsappNeedsTemplate` not applicable).
  - Filter bar: either hide (single channel) or show All/Messenger. Default: hide for messenger-only threads.
- Reaction long-press, reply swipe, media rendering all reused unchanged.

### 5.6 Composer — `Composer.tsx` (largest change)

- New **`AttachmentSheet`** component (RNR bottom-sheet via `@rn-primitives/portal` already mounted): Photo, Video, Document, Camera. Replaces `promptAttachment`/`Alert.alert`. Camera uses `expo-image-picker.launchCameraAsync`.
- Layout: leading `＋` opens the sheet; trailing control is **Mic** (idle) that becomes **Send** when `hasText || hasAttachment`.
- New **`VoiceRecorder`** sub-flow (Hold + lock):
  - `react-native-gesture-handler` long-press + pan; `react-native-reanimated` v4 for the slide/lock animation and waveform.
  - Recording bar: red dot, `m:ss` timer, live waveform, "‹ slide to cancel", lock affordance.
  - Records with **`expo-audio` (~1.1.1, already installed)** to `.m4a` (`audio/mp4`) — natively accepted by both Messenger and WhatsApp Meta APIs.
  - On send: emit a `SendPayload` with `attachment.kind='audio'`. For messenger → media endpoint; for whatsapp → existing `/chat/send` `file` + `type:'audio'`.
- `makeSendPayload` extended for the messenger channel and audio attachments.

### 5.7 Voice playback — `MediaMessage.tsx`

- Add `kind === 'audio'` rendering: play/pause button + duration + (optional) static waveform, backed by `expo-audio` player. Lazy media URL via existing `useMediaUrl`.

### 5.8 Selector + inbox routing

- **`ChatChannelSelector.tsx`**: enable the Messenger tile (remove `disabled`/"Coming soon"); `onPress` → `router.push('/chat/inbox?channel=messenger')`.
- **`ChatInboxScreen.tsx`**: accept an optional `channel` filter param; when `messenger`, show only Messenger conversations. (WhatsApp & Email tile keeps current unfiltered/unified behavior.)

### 5.9 WhatsApp voice (per "all channels")

- Reuse the same `VoiceRecorder`. WhatsApp audio send goes through the existing `/chat/send` `file` path with `type:'audio'`. Verify backend WhatsApp accepts `.m4a` audio during planning; if WhatsApp rejects a given format, surface as a failed bubble with retry (existing mechanism). Email has no voice (unchanged).

## 6. Data flow (Messenger outbound voice example)

1. Agent holds mic → `expo-audio` records `.m4a`; release/lock → stop.
2. Composer emits `SendPayload { channel:'messenger', attachment:{kind:'audio', uri, name, mimeType:'audio/mp4'} }`.
3. `useConversation.send()` inserts optimistic `pending` bubble, calls `sendMessengerMedia({ conversationId, file })`.
4. Service POSTs multipart to `/chat/messenger/messages/media`.
5. Backend uploads to Azure + sends buffer to Meta; emits `message:outgoing` over socket.
6. `useChatSocket` upserts the confirmed message; optimistic bubble reconciles to `sent`. On error → `failed` + retry.

## 7. Error handling

- Send failures → existing optimistic `failed` state + retry button (covers Messenger window-expiry rejections from Meta).
- Messenger reaction send: persists locally + socket regardless of Meta (best-effort, no failure surfaced).
- Voice: mic permission denied → inline alert; recording <1s → discard silently; cancel gesture → no send.
- Document picker unavailability already handled; camera permission handled via `expo-image-picker`.

## 8. Out of scope

- Agent-initiated Messenger threads (Meta policy).
- Round-tripping Messenger reactions/replies to Facebook (backend doesn't support; local-only).
- Email voice notes.
- Backend changes of any kind.

## 9. Verification (no test runner — per `boh-mobile` convention)

- `pnpm lint` + `tsc` clean.
- Manual QA on device: receive Messenger inbound (text+media), send text, send photo/video/document, send + play voice note, react to a Messenger message, reply to one; confirm WhatsApp voice note send/play; confirm selector → Messenger inbox routing.
