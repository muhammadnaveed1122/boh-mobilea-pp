# Lead → In-App Conversation + WhatsApp Template Bootstrap

Date: 2026-05-18
Status: Approved (design)
Repo: `boh-mobile` (frontend only — backend already implemented)

## Problem

The lead chat icon (the `MessageCircle` button on the lead list card and the
lead detail hero header) currently deep-links out to the native WhatsApp app.
We want it to open the lead's conversation **inside the app**:

- If the lead already has a conversation with messages → open it.
- If the lead has no conversation / no messages → let the user pick an approved
  WhatsApp message template to send to the lead's number, then drop into the
  conversation.
- On the conversation screen, the user must also be able to send email to the
  lead (already supported by the Composer when the conversation carries a
  `leadId`).

The backend is fully in place. This is a frontend wiring task only.

## Backend (existing — for reference)

- `GET /api/v1/chat/conversations/by-lead/:leadId?channel=whatsapp`
  → `ApiConversation | null`. Guard: `chat:read` OR `leads:read`.
- `GET /api/v1/chat/whatsapp/templates` → approved + pending templates with role
  assignments. Guard: `chat:create`. Relevant fields: `id`, `name`, `language`,
  `status` (`PENDING|APPROVED|REJECTED`), `category`, `body`, `headerType`,
  `headerText`, `footer`, `placeholdersCount`.
- `POST /api/v1/chat/whatsapp/messages/template`
  body `{ to, templateName, languageCode, parameters?: string[], agentId? }`.
  Guard: `chat:create`. Creates/updates the `ChatConversation` server-side and
  returns the `ChatMessage`.
- Email send already works via `POST /api/v1/chat/send` (`channel: 'unified'`,
  `leadId`, `subject`, `content`); `useConversation` enables it whenever the
  loaded conversation has `leadId`.

## Decisions (from brainstorming)

1. **Chat button**: replace the WhatsApp deep-link with in-app conversation
   navigation. Phone button keeps its existing coming-soon dialog.
2. **Template params (v1)**: auto-fill the lead name, no parameter form. Support
   templates with `placeholdersCount` 0 or 1 only; `> 1` is listed but disabled.
3. **Email**: no new email UI. Ensure `leadId` flows so the existing Composer
   email toggle becomes usable; verification only.

## Approach

Dedicated resolver route `/chat/lead/[leadId]` that **reuses the existing
`ConversationScreen`**. The chat button just `router.push`es to it. The route
resolves the conversation, branches (existing conversation vs template
bootstrap), then renders `ConversationScreen` with the resolved
`conversationId`. No second navigation hop; back-stack stays clean; email comes
for free because `useConversation` derives `emailEnabled` from `conv.leadId`.

Rejected alternatives: resolve-then-navigate inline (async work behind a tiny
icon, double hop); a leadId-aware `ConversationScreen` (bloats a working
component with two code paths).

## Components

### 1. Entry points

`src/features/leads/components/LeadCard.tsx` and
`src/features/leads/components/lead-detail/HeroHeaderCard.tsx`:

- `MessageCircle` chat button `onPress` → `router.push('/chat/lead/<lead.id>')`.
- Remove `whatsApp()` / `openWhatsApp()` and the now-unused `Linking` import.
- Keep the button disabled when the lead has no phone (template send needs a
  number).
- Phone coming-soon dialog (`CallComingSoonDialog`) unchanged.

### 2. Resolver route + gate

- `app/(app)/chat/lead/[leadId].tsx` — RBAC gate `PERMISSIONS.CHAT_READ`
  (mirrors `app/(app)/chat/[id].tsx`), denied → `<Redirect href="/chat" />`,
  renders `<LeadConversationGate leadId={...} />`.
- `src/features/chat/components/LeadConversationGate.tsx`:
  - `useLeadConversation(leadId)` → by-lead endpoint, `channel=whatsapp`.
  - Loading → spinner (reuse existing chat loading style).
  - `conv && conv.latestMessage` → `<ConversationScreen conversationId={conv.id} />`.
  - Otherwise → `<TemplatePicker lead leadId conversationId={conv?.id} />`.

The static `lead` segment does not collide with the dynamic `chat/[id]` route
(different segment depth: `/chat/lead/{leadId}` is two segments after `chat`).

### 3. Template bootstrap (no messages)

`src/features/chat/components/TemplatePicker.tsx`:

- `useWhatsappTemplates()` → templates list, keep `status === 'APPROVED'`.
- Templates with `placeholdersCount` 0 or 1 are selectable; `> 1` listed but
  disabled with a "needs more info — not supported yet" note.
- Select → `parameters = placeholdersCount === 1 ? [lead.name] : []`.
- Send → `POST /api/v1/chat/whatsapp/messages/template`
  `{ to: lead.phone, templateName: name, languageCode: language, parameters }`.
- Gated on `chat:create`; if the user lacks it, show a read-only info state
  instead of the send action.
- On success → invalidate the by-lead query → gate re-renders → conversation now
  has a message → `ConversationScreen` mounts.
- On failure → inline alert, stay on the picker.
- No approved templates → empty state.

### 4. API / hooks / keys additions

- `src/features/chat/api/services.ts`: `getConversationByLead(leadId, channel)`,
  `getWhatsappTemplates()`, `sendWhatsappTemplate(input)`.
- `src/features/chat/api/types.ts`: `ApiWhatsappTemplate`, `SendTemplateInput`.
- `src/features/chat/hooks/keys.ts`: `conversationByLead(leadId)`,
  `whatsappTemplates`.
- Hooks: `use-lead-conversation.ts`, `use-whatsapp-templates.ts`,
  `use-send-template.ts`.

## Data flow

1. Tap chat icon on a lead → `router.push('/chat/lead/<leadId>')`.
2. Route gate checks `CHAT_READ` → renders `LeadConversationGate`.
3. `useLeadConversation` queries by-lead (whatsapp).
4. Conversation with `latestMessage` → `ConversationScreen` (existing thread;
   `useConversation` enables email from `conv.leadId`).
5. No conversation / no messages → `TemplatePicker`.
6. Pick template → send template (`to` = lead phone) → backend creates
   conversation + message → invalidate by-lead query.
7. Gate re-renders → conversation now has a message → `ConversationScreen`.

## Edge cases

- Lead has no phone → chat button disabled (no send target).
- by-lead returns null → template picker.
- Template send failure → inline alert, remain on picker.
- User lacks `chat:create` → picker shows read-only info, no send.
- No approved templates → empty state.

## Error handling

- All queries surface loading + error (retry) states consistent with existing
  chat screens.
- Template send errors are caught and shown inline; the picker does not
  navigate away on failure.

## Testing / verification

No test runner is configured in `boh-mobile` (project convention — verify via
typecheck + lint + manual QA). Completion gate:

- `pnpm exec tsc --noEmit` clean.
- `pnpm lint` clean.
- Manual QA:
  - Lead with an existing conversation → tapping chat opens that thread.
  - Lead with no messages → picker shown → select template → send → lands in the
    conversation screen.
  - Resolved conversation → Composer email toggle is enabled and an email can be
    sent.
  - Lead with no phone → chat button disabled.

## Scope / phasing

~3 components + 1 route + 3 hooks + service/type/key additions. No backend work.
Single implementation plan, phaseable:

- **P1**: entry-point rewiring + resolver route + `LeadConversationGate` +
  existing-conversation path + email verification.
- **P2**: `TemplatePicker` + template hooks/services + bootstrap path.

## Out of scope

- Template parameter forms beyond auto-filled lead name (`placeholdersCount > 1`).
- Creating/editing/syncing WhatsApp templates from mobile.
- Non-WhatsApp bootstrap channels (SMS/MMS).
- Any backend changes.
