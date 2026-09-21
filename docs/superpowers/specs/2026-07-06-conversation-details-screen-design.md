# Conversation Details Screen — Design Spec

**Date:** 2026-07-06
**Repo:** boh-mobile
**Goal:** Port the web inbox contact sidebar (`boh-lead-magnet` `InboxContactSidebar`) to a
full-screen mobile **Conversation Details** screen, reachable from the conversation header, for
both WhatsApp and Messenger conversations.

## 1. Entry point & navigation

- `ConversationHeader` gains an **Info button** (Lucide `Info`, 44pt hit area) on the right, placed
  left of the existing Phone button. Tapping it opens the details screen.
- The existing name/avatar/subtitle `Pressable` is **unchanged** — it still routes to
  `/leads/[leadId]` (lead detail). Only the new Info button opens details.
- `ConversationHeader` gains two props: `conversationId: string` and `channel: string`
  (`'whatsapp' | 'messenger' | ...`). `ConversationScreen` already has both (`conversationId` prop;
  channel derivable from `isMessenger`/conversation) and passes them down.
- **Route:** new flat route `app/(app)/chat/details.tsx` (avoids folderizing the existing
  `chat/[id].tsx`). Reads params `conversationId`, `channel`, `leadId` via `useLocalSearchParams`.
  Renders `ConversationDetailsScreen`. Typed-routes: navigate with
  `router.push({ pathname: '/chat/details', params: { conversationId, channel, leadId } })`.

## 2. Screen shell

- `ConversationDetailsScreen` (`src/features/chat/components/details/ConversationDetailsScreen.tsx`):
  - Navy gradient top bar (reuse `NAVY_GRADIENT` from header) with a back button + title "Details".
    Back uses `router.canGoBack() ? router.back() : router.replace('/chat')`.
  - Body: `ScrollView`, `bg-background`, safe-area aware (top handled by header; bottom inset on
    content), sections rendered as `Card`s with 16dp vertical gaps, 16dp horizontal gutters.
  - All sections shown for both WhatsApp and Messenger (mobile inbox is WA + Messenger only, so the
    web `canAssign` gate is always true here). Sections that need a `leadId` render an
    "unlinked" state when the conversation has no lead.

## 3. Sections

New components under `src/features/chat/components/details/`:

| Component            | Content                                                                                                                                                                                                                                                   | Data source                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `ProfileCard`        | Avatar (initials) + channel badge (WA green `#25D366` / Messenger blue `#0084FF`) + name + channel label                                                                                                                                                  | conversation (params + `useConversation`)  |
| `ContactDetailsCard` | Phone row, Email row; "No contact details available" fallback                                                                                                                                                                                             | conversation                               |
| `LeadCard`           | Assigned/Unassigned pill; if linked: status chip, priority chip (hot=red / warm=amber / cold=sky / other=neutral), persona (INTEREST label), assignee row (initials avatar + name). Actions: Reassign (linked) OR Assign-to-lead + Create-lead (unlinked) | `useLeadDetail(leadId)`                    |
| `LabelsCard`         | Assigned label chips (color dot + name); Add label (opens `LabelAssignSheet`); Manage labels (opens `ManageLabelsSheet`)                                                                                                                                  | label hooks (new)                          |
| `NotesCard`          | Notes list (all, scroll within card capped or full); add composer; per-note edit (inline) + delete (confirm)                                                                                                                                              | `useLeadNotes` + new update/delete hooks   |
| `SharedMediaCard`    | 3-col image/video thumbnail grid + document rows; tap image/video → fullscreen viewer; "Show all (N)" beyond initial 12                                                                                                                                   | `useConversation` messages + `useMediaUrl` |

### Chips / colors

- Priority: hot → `bg-red-500/10 text-red-600`, warm → amber, cold → sky, else neutral token.
- Status: neutral chip, `capitalize`, underscores → spaces.
- Use semantic NativeWind tokens where possible; the WA/Messenger brand colors and priority hues are
  fixed brand/semantic values (kept as literals, consistent light/dark).

## 4. Data layer (new)

### Lead notes (extend `src/features/leads/services.ts` + hooks)

- `updateLeadNote(leadId, noteId, content)` → `PATCH /api/v1/leads/:leadId/notes/:noteId`
- `deleteLeadNote(leadId, noteId)` → `DELETE /api/v1/leads/:leadId/notes/:noteId`
- Hooks `useUpdateLeadNote`, `useDeleteLeadNote` invalidate `['lead-notes', leadId]` + `['leads']`.
- (`getLeadNotes`/`createLeadNote` + `useLeadNotes`/`useCreateLeadNote` already exist.)
- `LeadNote` model: `{ id, content, author?: {id,name}, createdAt, updatedAt, canModify }` — verify
  mobile `LeadNote` type has `canModify`/`author`; extend if missing.

### Chat labels — new `src/features/chat/api/labels.ts` + `src/features/chat/hooks/use-chat-labels.ts`

- `getChatLabels()` → `GET /api/v1/chat-labels` → `ChatLabel[] { id, name, color, sortOrder }`
- `saveChatLabels(labels)` → `PUT /api/v1/chat-labels` body `{ labels: [{ id?, name, color }] }`
- `getConversationLabels(conversationId)` → `GET /api/v1/chat-labels/conversations/:id`
- `setConversationLabels(conversationId, labelIds)` → `PUT /api/v1/chat-labels/conversations/:id`
  body `{ labelIds }`
- Query keys: `['chat-labels']`, `['conversation-labels', conversationId]`. Save/set invalidate
  both (a rename/recolor changes chips everywhere).

### Assign conversation to lead — extend chat services

- `assignConversationToLead(channel, conversationId, leadId)`:
  - messenger → `PATCH /api/v1/chat/messenger/conversations/:id/assign-lead` `{ leadId }`
  - whatsapp → `PATCH /api/v1/chat/whatsapp/conversations/:id/assign-lead` `{ leadId }`
- Hook `useAssignConversationToLead` invalidates the conversation (`['conversation', id]`) and its
  labels/lead-linked queries so `LeadCard` refreshes.

## 5. Sub-flows

### LeadPickerSheet (Reassign / Assign-to-lead)

- `@gorhom/bottom-sheet` sheet. Search input (debounced) + paginated list via existing
  `getLeads({ search, page, perPage: 20, sortBy: 'updatedAt', sortOrder: 'desc' })`.
- Row: name (or email) + phone/email subtitle. Tap → `assignConversationToLead(...)`, close on
  success. Load-more button at end. Reuses `use-search-debounce`.

### Create lead

- Route to `/leads/create` with prefill params `{ name, phone, email }`. Add optional
  `useLocalSearchParams` prefill to `CreateLeadScreen` → seed `create-lead.form` defaults. Small,
  additive change; no behavior change when params absent.

### LabelAssignSheet (toggle labels on this conversation)

- Sheet listing all `chatLabels` with a check when assigned. Tap toggles → `setConversationLabels`
  with the next id set. "Manage labels" entry opens `ManageLabelsSheet`.

### ManageLabelsSheet — full parity

- Editable rows: drag handle, color swatch, name `TextInput`, delete. Add-row button.
- **Reorder:** drag-to-reorder. No draggable-list lib installed; implement with
  `react-native-gesture-handler` + `reanimated` (both present) — a minimal vertical drag reorder, OR
  add `react-native-draggable-flatlist` (decide in plan; prefer no new dep if the hand-rolled
  version is small).
- **Recolor:** `LabelColorPicker` — preset swatch grid (10 web presets:
  `#3b82f6 #ef4444 #22c55e #f59e0b #06b6d4 #8b5cf6 #14b8a6 #f97316 #a855f7 #1e293b`) + hex
  `TextInput` for free entry (validated `#RRGGBB`). No HSV wheel (no lib; not worth a dep). Colors
  must be unique per label (disable taken swatches; validate on save).
- Save → `saveChatLabels`; dirty-tracking mirrors web (serialize named rows). Unique-color guard
  before save with a toast on violation.

### Shared media viewer

- Fullscreen modal over the screen: pinch/zoom not required v1; image fills, video uses native
  controls. Close button top-right; tap scrim to dismiss (scrim ≥ 60% black).
- Messenger media URLs resolve lazily per message via `useMediaUrl(messageId)` (skip when the
  message already has a URL) — mirrors web `useResolvedMediaUrl`.

## 6. Permissions

- Notes: composer/edit/delete gated by lead update permission — reuse mobile RBAC
  (`use-lead-permissions` / `PERMISSIONS`). Verify exact permission key during implementation.
- Labels edit (add/manage): gated by `chat:read_write_conversations` (mobile RBAC equivalent);
  read-only viewers see chips only.

## 7. UX constraints (from ui-ux-pro-max App-UI checklist)

- Match existing app design system: NativeWind semantic tokens (`bg-background`, `text-foreground`,
  `border-border`, `text-muted-foreground`, `bg-card`), `cn()` merge, `Text`/`Icon`/`Card`/`Avatar`/
  `Badge` atoms. No new palette.
- Touch targets ≥ 44pt (Info button, chip actions, note edit/delete, swatches use `hitSlop`).
- Lucide icons only (no emoji). One icon family/stroke.
- Safe areas respected; scroll content not hidden behind fixed bars; 8dp spacing rhythm; section
  hierarchy via size/weight/spacing not color alone.
- Light + dark parity for all chips, borders, scrims; press feedback (opacity/scale) within ~100ms.
- Loading: skeleton/spinner for lead + labels + media fetches; empty states for no-notes / no-media /
  no-contact-details / unlinked-lead.
- Destructive (delete note, delete label) → confirm dialog; consider undo toast for note delete.

## 8. File map

```
app/(app)/chat/details.tsx                                   (new route)
src/features/chat/components/ConversationHeader.tsx          (edit: Info button + props)
src/features/chat/components/ConversationScreen.tsx          (edit: pass conversationId/channel)
src/features/chat/components/details/
  ConversationDetailsScreen.tsx                              (new)
  ProfileCard.tsx  ContactDetailsCard.tsx  LeadCard.tsx
  LabelsCard.tsx  NotesCard.tsx  SharedMediaCard.tsx
  LeadPickerSheet.tsx  LabelAssignSheet.tsx  ManageLabelsSheet.tsx
  LabelColorPicker.tsx  SharedMediaViewer.tsx
src/features/chat/api/labels.ts                              (new)
src/features/chat/hooks/use-chat-labels.ts                   (new)
src/features/chat/hooks/use-assign-conversation.ts           (new)
src/features/chat/api/services.ts                            (edit: assignConversationToLead)
src/features/leads/services.ts                               (edit: update/deleteLeadNote)
src/features/leads/hooks/use-lead-notes.ts                   (edit: update/delete hooks)
src/features/leads/components/CreateLeadScreen.tsx           (edit: optional prefill params)
```

## 9. Out of scope (v1)

- Pinch-zoom in media viewer.
- Editing label definitions offline / optimistic reorder animations beyond basic drag.
- Any SMS/unified-channel-specific sidebar variance (mobile inbox is WA + Messenger).

## 10. Verification

- No unit tests (repo convention). Verify via `pnpm lint` + `tsc` + manual QA on a WhatsApp and a
  Messenger conversation (linked + unlinked lead): open details, edit contact/lead, add/toggle
  labels, manage labels (create/rename/recolor/reorder/delete), notes CRUD, media grid + viewer,
  reassign + create-lead flows. Test light + dark.
