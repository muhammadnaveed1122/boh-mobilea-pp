# Chat Messaging UI — Design Spec

**Date:** 2026-05-15
**Status:** Approved (design), pending implementation plan
**Scope:** UI only. Locally interactive mock state. No API / socket / persistence.

## Goal

A multi-channel messaging surface where one contact thread shows **WhatsApp**
and **Email** messages interleaved in a single timeline. A main chat screen
(contacts inbox) drills into a per-contact conversation screen. Visual target:
the three provided mockups (gradient navy header, channel filter pills,
day-grouped bubbles with per-message channel chips and read ticks, dual-mode
composer).

## Routing

Convert `app/(app)/chat.tsx` (current placeholder) into a route folder:

- `app/(app)/chat/index.tsx` — inbox route shell. RBAC gate
  `PERMISSIONS.CHAT_READ` (mirrors existing placeholder). Renders
  `<ChatInboxScreen />`.
- `app/(app)/chat/[id].tsx` — conversation route shell. RBAC gate
  `PERMISSIONS.CHAT_READ`. Reads `id` via `useLocalSearchParams`, renders
  `<ConversationScreen id={id} />`.

Route files stay thin shells, matching the existing `app/(app)/leads/[id].tsx`
pattern (gate → delegate to feature screen component).

**Why this works with the global chrome:** `app/_layout.tsx` shows the global
`MainHeader` and `BottomTabBar` only for pathnames in `HEADER_TAB_PATHS` /
`TAB_PATHS`, which include `/chat`. The folder `index.tsx` still resolves to
`/chat`, so the inbox keeps the global header + tab bar with no layout change.
`/chat/[id]` resolves to `/chat/<id>`, which is in neither set, so the
conversation screen automatically renders with no global header / tab bar and
supplies its own full-bleed gradient header.

## Feature Folder

Follows the established `src/features/<feature>/` atomic structure (see
`src/features/leads/`).

```text
src/features/chat/
  models/
    channel.ts          Channel = 'whatsapp' | 'email'; ChannelMeta map (label, icon, token)
    message.ts          Message: id, channel, direction, text, subject?, time, status, dayLabel
    conversation.ts     Contact, Conversation summary types
  constants/
    mock-data.ts        Contacts list + threaded messages (Sarah Al Mansouri thread from mockups)
  hooks/
    use-conversation.ts Mock state: messages, activeFilter, channel counts, sendChannel, send()
  components/
    ChatInboxScreen.tsx     Inbox: header spacing + contact list
    ContactRow.tsx          Avatar + name + last-message preview + time + unread Badge + channel dot
    ConversationScreen.tsx  Shell: ConversationHeader + ChannelFilterBar + MessageList + Composer
    ConversationHeader.tsx  Gradient navy header: back, avatar, name, "All messages…" subtitle, call button
    ChannelFilterBar.tsx    All / WhatsApp / Email pills with count Badge
    MessageList.tsx         Day-grouped list, animated mount, auto-scroll to latest
    MessageBubble.tsx       Inbound/outbound bubble, channel chip, timestamp, read ticks
    DayDivider.tsx          Centered "Yesterday" / "Today" chip
    Composer.tsx            Send-via toggle; WhatsApp simple input ↔ Email subject + format toolbar
  index.ts                  Barrel
```

Component boundaries: `ConversationScreen` composes six single-purpose
children. Each child renders one visual unit and takes plain props — no
over-splitting into trivial sub-components (e.g. read-tick / channel-chip stay
inline within `MessageBubble`).

## Data Model

```ts
type Channel = 'whatsapp' | 'email';
type Direction = 'in' | 'out';
type MessageStatus = 'sent' | 'delivered' | 'read';

interface Message {
  id: string;
  channel: Channel;
  direction: Direction;
  text: string;
  subject?: string; // email only
  time: string; // display string e.g. "9:17 AM"
  status?: MessageStatus; // outbound only — drives single/double/colored ticks
  dayLabel: string; // "Yesterday" | "Today" — drives DayDivider grouping
}
```

`ChannelMeta` maps each channel to: display label, lucide icon key
(`MessageCircle` for WhatsApp, `Mail` for Email), and semantic theme token
(`success` for WhatsApp, `info` for Email). No hardcoded hex.

## Badge Atom Reuse

The existing `src/components/atoms/Badge.tsx` (cva variants) is the only chip
primitive used:

- Unread count on `ContactRow` → `default` (or `destructive` for emphasis).
- Channel filter pill counts → `secondary` when inactive, `ghost` when the
  pill is active (active pill sits on a dark surface).
- Per-message channel chip → `successSoft` (WhatsApp) / `infoSoft` (Email).

No new chip component is introduced.

## Theme

- Header background: `expo-linear-gradient` over the `--brand` token resolved
  via `useThemeColor('--brand')` (navy `16 24 39` in light theme — matches the
  mockup). Status bar content set light while header is visible.
- All colors are semantic Tailwind tokens (`bg-background`, `text-foreground`,
  `border-border`, `bg-card`, …). No hex literals.
- Outbound bubbles: dark `--card`/`--primary` surface (mockup shows dark
  bubbles). Inbound bubbles: `--muted` surface. Driven by tokens so dark mode
  is automatic.

## Interactivity (Mock)

`useConversation(contactId)` owns all local state — no server calls:

- `messages`: seeded from `mock-data.ts`, ordered chronologically.
- `activeFilter`: `'all' | 'whatsapp' | 'email'`. Derives `visibleMessages` and
  the per-channel counts shown in the filter pills.
- `sendChannel`: `'whatsapp' | 'email'`. Toggled by the composer's "Send via"
  control; swaps the composer body.
- `send(payload)`: appends an optimistic outbound `Message` (`direction: 'out'`,
  `status: 'sent'`) on the current `sendChannel`; clears the input.

Inbox: `ContactRow` press → `router.push('/(app)/chat/<id>')`.

## Animations (react-native-reanimated — existing dep)

- Message bubble entering: `FadeInDown` (subtle translate + fade).
- Channel filter change: list `LinearTransition` layout animation.
- Composer mode swap (WhatsApp ↔ Email): animated height + opacity; the email
  subject row + format toolbar slide in.
- Press feedback: `Pressable` scale to `~0.97` on contact rows, filter pills,
  send button.
- Header: static gradient + safe-area aware. No scroll-collapse (kept out of
  scope to stay focused).

## Out of Scope

- No API, socket.io, or React Query wiring.
- No real attachment picking, file upload, or rich-text editing (toolbar
  buttons render but are non-functional placeholders).
- No message persistence across navigation/app restarts.
- No inbox search/filter (inbox is a static contact list for this iteration).

## Acceptance (visual)

1. `/chat` shows a contact inbox: avatar, name, last-message preview, time,
   unread Badge, channel indicator; tapping a row navigates to the thread.
2. Conversation screen reproduces the three mockups: gradient navy header with
   back + call, channel filter pills with live counts, day-divided timeline,
   per-message channel chip + timestamp + read ticks, dual-mode composer.
3. Channel pills filter the timeline; composer toggle swaps WhatsApp input vs
   Email (subject + format toolbar); sending appends a bubble.
4. Smooth enter/transition animations; theme-correct in light and dark; no hex
   literals; Badge atom used for all chips/counts.
