# WhatsApp 24h Window Timer — mobile

**Date:** 2026-07-06
**Scope:** Port the web conversation-screen "timer window" feature to boh-mobile: a live HH:MM:SS countdown badge in the conversation header + proactive template-only composer gating when the 24h WhatsApp customer-service window is closed.

## Background

WhatsApp gives a business 24h to send free-text after a customer's last inbound message. Outside that window only approved templates can be sent. The web app (`boh-lead-magnet`) shows a live countdown badge in the chat header and locks the composer to template-only when the window is closed.

Mobile has the pieces but they are dormant:

- `useWhatsappWindow` hook exists but returns only `{ withinWindow }` and is **never called**.
- `Composer` already has full gating UI (`whatsappWindowOpen`, `whatsappNeedsTemplate`, locked hint, "Start with a template" CTA) but the props are **never passed**, so it defaults to open.
- No countdown badge exists anywhere.
- Reactive gating already works: a free-text send outside the window fails with `SELECT_TEMPLATE_FIRST`, which opens the template sheet.

Backend (`GET /chat/whatsapp/conversations/:id/window-status`) already returns `{ withinWindow: boolean, windowExpiresAt: string | null }`. `windowExpiresAt` = last inbound message `createdAt + 24h`, absolute ISO, or `null` when no inbound exists. It is **derived per request, not stored** (no DB column, no Redis key).

## Goal

Activate the dormant gating with real window state and add a live countdown badge, matching the web conversation screen. Scope **A**: header badge + composer lock. Sidebar per-row timers (web scope C) are out of scope.

## Non-goals

- No backend changes. (Backend has two known inefficiencies — 50-row fetch instead of an indexed `ORDER BY created_at DESC LIMIT 1`, and a latent bug where an inbound >50 messages back is missed. Tracked separately; not part of this work.)
- No sidebar/inbox-list countdown badges.
- No change to the reactive `SELECT_TEMPLATE_FIRST` flow — it stays as the backstop.

## Design

### 1. API — read `windowExpiresAt`

[`api/services.ts`](../../../src/features/chat/api/services.ts) `getWhatsappWindowStatus`: extend the return type and the axios generic from `{ withinWindow: boolean }` to `{ withinWindow: boolean; windowExpiresAt: string | null }`. No other call-site change (only the hook consumes it).

### 2. Countdown hook — `hooks/use-window-countdown.ts` (new)

Port of the web `useWindowCountdown`. Display-only — it never decides gating (that is `withinWindow` from the server).

- A single module-level 1-second `setInterval` shared by all subscribers (ref-counted; starts on first subscriber, clears on last). One ticker regardless of how many countdowns mount.
- Input: absolute `windowExpiresAt: string | null`.
- Output: `{ label: string; isExpired: boolean; hasWindow: boolean }`.
  - `hasWindow` = `windowExpiresAt !== null`.
  - `remaining = new Date(windowExpiresAt).getTime() - now`; `isExpired = remaining <= 0`.
  - `label` = `HH:MM:SS`, clamped at `00:00:00`.
- Uses `useState` for the ticking `now` and `useEffect` to subscribe/unsubscribe. No `Date.now()` at module top level.

### 3. Header badge — `components/WhatsappWindowTimer.tsx` (new)

Small pill rendered in `ConversationHeader`, WhatsApp conversations only.

- Props: `windowExpiresAt: string | null`, `withinWindow: boolean | undefined`.
- Consumes `useWindowCountdown(windowExpiresAt)`.
- Hidden when `!hasWindow` (no inbound yet — nothing to count down) or channel is messenger.
- Active (`withinWindow` true): green pill, `Clock` icon + `HH:MM:SS` label.
- Expired (`withinWindow` false but `hasWindow` true): red/destructive pill, text `Expired`.
- Themed via semantic tokens (`--success` / `--destructive`), consistent with the navy-gradient header (light text on colored pill).
- Placed in the header's right-hand control cluster next to the Info/Phone buttons, or under the subtitle — final placement decided during implementation to fit the gradient header layout.

### 4. Wire gating — `useConversation`

[`hooks/use-conversation.ts`](../../../src/features/chat/hooks/use-conversation.ts):

- Call `useWhatsappWindow(conversationId)` (enabled only for WhatsApp-capable, non-messenger conversations).
- Derive and return:
  - `windowExpiresAt = windowQuery.data?.windowExpiresAt ?? null`
  - `whatsappWindowOpen = windowQuery.data?.withinWindow ?? true` (default open until known, avoids a flash of locked UI on load)
  - `whatsappNeedsTemplate = windowQuery.data?.withinWindow === false` — outside the window (expired OR never-replied), the thread needs a template. This matches web (template-only outside window) and drives the existing Composer "Start with a template" CTA.

`ConversationScreen` passes the three new values through to `<Composer whatsappWindowOpen whatsappNeedsTemplate ... />` and to `<ConversationHeader ... />` (which renders `WhatsappWindowTimer`). The template CTA's `onStartTemplate` reuses the existing `openTemplateSheet`.

### Gating semantics (scope A)

| Server state                                                   | Badge            | Composer         |
| -------------------------------------------------------------- | ---------------- | ---------------- |
| `withinWindow: true`, `windowExpiresAt` set                    | green `HH:MM:SS` | normal free-text |
| `withinWindow: false`, `windowExpiresAt` set (expired)         | red `Expired`    | template CTA     |
| `withinWindow: false`, `windowExpiresAt: null` (never replied) | hidden           | template CTA     |

Reactive `SELECT_TEMPLATE_FIRST` stays as backstop for the race where the window closes between load and send.

## Data flow

```
window-status API ──> useWhatsappWindow (30s staleTime)
        │
        └─> useConversation derives { windowExpiresAt, whatsappWindowOpen, whatsappNeedsTemplate }
                 ├─> ConversationHeader ─> WhatsappWindowTimer ─> useWindowCountdown (1s ticker) ─> HH:MM:SS
                 └─> Composer (activates existing locked-hint / template-CTA UI)
```

## Testing / verification

No unit test runner in boh-mobile (per repo convention). Verify via:

- `pnpm lint` + `tsc --noEmit` clean.
- Manual QA on a conversation with a recent inbound (badge counts down green), one past 24h (red `Expired`, composer shows template CTA), and one with no inbound (badge hidden, template CTA).
- Confirm the shared ticker: multiple mounts do not spawn multiple intervals.

## Files

- `src/features/chat/api/services.ts` — extend return type (edit)
- `src/features/chat/hooks/use-window-countdown.ts` — new
- `src/features/chat/components/WhatsappWindowTimer.tsx` — new
- `src/features/chat/hooks/use-conversation.ts` — call hook, derive + return window state (edit)
- `src/features/chat/components/ConversationScreen.tsx` — pass props to Composer + Header (edit)
- `src/features/chat/components/ConversationHeader.tsx` — render WhatsappWindowTimer (edit)
