# Chat Channel Selector — Design

**Date:** 2026-06-16
**Repo:** `boh-mobile`
**Status:** Approved (design), pending implementation plan

## Problem

Tapping the chat icon in the bottom tab bar currently lands directly on the
combined WhatsApp + email inbox (`/chat` → `ChatInboxScreen`). We want an
intermediate **channel selector** so the user first chooses which messaging
channel to open. WhatsApp & Email is live (routes to the existing inbox);
Messenger is a placeholder shown as "Coming soon".

## Goal

```
chat icon (bottom bar)  ->  /chat  [SELECTOR]            (gated: CHAT_READ)
      [ WhatsApp & Email ]  -> push /chat/inbox          (existing inbox, gated)
      [ Messenger ]         -> disabled + "Coming soon" badge (no nav)
```

Non-goals: no Messenger integration, no backend/data changes, no changes to
conversation detail (`/chat/[id]`) or lead-chat (`/chat/lead/[leadId]`) flows.

## Approach

Keep the existing `ChatInboxScreen` untouched and move its mounting point to a
new static route, freeing `/chat` to host the selector. Reuse the existing
visual language (the `ChannelOption` row look from `StartConversation.tsx`,
semantic Tailwind tokens, the `Badge` atom).

## Changes

### 1. New route — `app/(app)/chat/inbox.tsx`

Holds the body that `index.tsx` has today:

```tsx
import { Redirect } from 'expo-router';
import { ChatInboxScreen } from '@/features/chat';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';

export default function ChatInboxRoute() {
  const state = useRequirePermission(PERMISSIONS.CHAT_READ);
  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/" />;
  return <ChatInboxScreen />;
}
```

- Static segment `inbox` takes precedence over the dynamic `[id].tsx` in
  Expo Router, so `/chat/inbox` resolves to this screen, **not** a conversation
  with `id === "inbox"`.
- Inbox keeps its own `CHAT_READ` gate because the route is independently
  reachable (deep link / direct push).

### 2. Rewrite — `app/(app)/chat/index.tsx`

Same gate, renders the new selector instead of the inbox:

```tsx
import { Redirect } from 'expo-router';
import { ChatChannelSelector } from '@/features/chat';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';

export default function ChatSelectorRoute() {
  const state = useRequirePermission(PERMISSIONS.CHAT_READ);
  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/" />;
  return <ChatChannelSelector />;
}
```

### 3. New component — `src/features/chat/components/ChatChannelSelector.tsx`

Presentational screen. Exported from the `@/features/chat` barrel.

- Container matches inbox: `flex-1 bg-background`, top padding
  `insets.top + MAIN_HEADER_HEIGHT` (via `useSafeAreaInsets` + `MAIN_HEADER_HEIGHT`).
- Header: `<Text variant="heading">Messages</Text>` + muted subtitle
  "Choose a channel".
- A local `ChannelRow` (mirrors `StartConversation`'s `ChannelOption`:
  `flex-row items-center gap-3 rounded-2xl bg-card p-4`, 44px icon tile
  `rounded-xl bg-muted`, title + muted subtitle). Adds an optional `badge` slot
  and honours `disabled` (opacity 0.5, `disabled` prop, no `ChevronRight` when
  disabled).
- Rows:
  | Title | Icon | Subtitle | State | Action |
  |-------|------|----------|-------|--------|
  | WhatsApp & Email | `MessagesSquare` | "Your unified inbox" | enabled | `router.push('/chat/inbox')` |
  | Messenger | `Facebook` | "Chat via Messenger" | disabled | none; renders `<Badge variant="secondary">Coming soon</Badge>` |

  (Icon keys are Lucide names already available via the `Icon` atom; Lucide has
  no Messenger glyph, so `Facebook` is the closest brand stand-in.)

### 4. Register route — `app/(app)/_layout.tsx`

Add alongside the existing `chat/index` screen, matching its transition:

```tsx
<Stack.Screen name="chat/inbox" options={{ animation: 'none' }} />
```

## Affected / unaffected

- **Unaffected:** `ChatInboxScreen`, `ChannelFilterBar`, `ContactRow`,
  `StartConversation`, `/chat/[id]`, `/chat/lead/[leadId]`, bottom tab bar
  (chat `href` stays `/chat`, now the selector).
- **No data layer:** no hooks, queries, or API touched. Messenger is a static
  stub.

## Verification

Repo has no test runner (per `CLAUDE.md`). Verify via:

1. `pnpm lint` — clean.
2. `tsc --noEmit` (or editor typecheck) — clean.
3. Manual QA:
   - Tap chat tab → selector renders with both rows.
   - "WhatsApp & Email" → pushes inbox; inbox loads conversations; back returns
     to selector.
   - "Messenger" row is greyed, shows "Coming soon", not tappable.
   - Open a conversation from the inbox (`/chat/<id>`) — still resolves
     correctly (no collision with the new `inbox` segment).
   - Denied-permission user is redirected from both `/chat` and `/chat/inbox`.
