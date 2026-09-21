# Mobile Chat Media Implementation Plan

> Execute via superpowers:subagent-driven-development. No automated tests
> (user directive) — verify each task with `pnpm exec tsc --noEmit && pnpm lint`.

**Goal:** Send photos/videos/documents and render media inline (inbound +
outbound). **Spec:** `docs/superpowers/specs/2026-05-15-mobile-chat-media-design.md`.

**Branch:** `feat/mobile-chat-backend-integration`. Protected unrelated WIP
(never stage): `pnpm-workspace.yaml`.

## Tasks

### T1 — dep + model + types + key
- `npx expo install expo-document-picker` (SDK-54 version; pnpm).
- `models/message.ts`: add `MediaKind`, `MessageMedia`, `Message.media?`,
  extend whatsapp `SendPayload` with `attachment?: PickedAsset`
  (`PickedAsset` imported from `../media/pick-media`).
- `api/types.ts`: `SendMessageInput` — `content?` optional; add `file?`,
  `type?`, `caption?`, `filename?`.
- `hooks/keys.ts`: add `mediaUrl: (id) => [...all,'media-url',id]`.
- Commit `chore+feat(chat): media deps, model, types`.

### T2 — transforms + services
- `api/transforms.ts`: add `mediaKind`; `toMessage` maps `media` + adjusts
  `text` when media present (spec §"Data model + transform").
- `api/services.ts`: `sendMessage` FormData branch when `input.file`; add
  `getMediaUrl(messageId)` normalizing URL.
- Commit `feat(chat): media transform + multipart send + media-url service`.

### T3 — pick-media util + use-media-url hook + send wiring
- `media/pick-media.ts`: `PickedAsset`, `pickPhotoOrVideo`, `pickDocument`.
- `hooks/use-media-url.ts`: `useMediaUrl(messageId)`.
- `hooks/use-conversation.ts`: `send` whatsapp branch maps `attachment`.
- Commit `feat(chat): media pickers, media-url hook, send wiring`.

### T4 — Composer
- Paperclip action menu (Photo/Video, Document) + preview chip + caption +
  `canSend` includes attachment; payload carries `attachment`.
- Commit `feat(chat): composer media attach`.

### T5 — MediaMessage + MessageBubble
- `components/MediaMessage.tsx` (image/video/document, url-resolve).
- `MessageBubble.tsx`: render `MediaMessage` when `message.media`.
- Commit `feat(chat): inline media render (inbound + outbound)`.

Then: final review → finish branch.

Full code for each task is supplied to the implementer at dispatch time
(controller holds the exact current source).
