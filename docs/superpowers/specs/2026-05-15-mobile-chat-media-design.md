# Mobile Chat — Media (photos / videos / files) Design Spec

**Date:** 2026-05-15
**Status:** Approved (user said "start implementation")
**Scope:** Send photos, videos, and documents in chat; render media inline for
BOTH inbound and outbound messages. Extends the completed backend-integration
work (`2026-05-15-mobile-chat-backend-integration-design.md`).
**No automated tests** (standing user directive) — verify via
`pnpm exec tsc --noEmit && pnpm lint` + manual QA.

## Goal

The composer's paperclip is inert and inbound media renders as a text
placeholder (`[Image]`). Make the paperclip pick a photo/video
(`expo-image-picker`, already a dep) or a document
(`expo-document-picker`, new dep), upload it via the unified
`POST /chat/send` multipart endpoint, and render image / video / document
messages inline in the thread regardless of direction.

## Backend contract (consumed)

`POST /api/v1/chat/send` accepts multipart/form-data with fields:
`channel='unified'`, `conversationId`, `to?`, `leadId?`, `content?`,
`caption?`, `type` (image|video|document|…), `filename?`, and `file`
(the binary). `GET /api/v1/chat/messages/:id/media-url` returns a fresh
signed URL — response (after the axios envelope-unwrap interceptor) is one of
`{ mediaUrl, mediaSignatureParams }` / `{ url }` / `{ data: { url } }`;
normalize to a single URL string. Inbound media messages already carry
`mediaUrl` on the `ApiMessage`; the media-url endpoint is the fallback when
it is absent/expired.

## Architecture (Approach A — extend layers + small media units)

New dependency: `expo-document-picker` (installed via `npx expo install` so
the SDK-54-compatible version is resolved). `expo-image-picker` (~17.0.11)
and `expo-video` (^55) are already present.

New files:
- `src/features/chat/media/pick-media.ts` — `pickPhotoOrVideo()` /
  `pickDocument()` → `PickedAsset | null`.
- `src/features/chat/components/MediaMessage.tsx` — renders image / video /
  document for a `Message.media`.
- `src/features/chat/hooks/use-media-url.ts` — lazy signed-URL query.

Changed files: `models/message.ts`, `api/types.ts`, `api/transforms.ts`,
`api/services.ts`, `hooks/use-conversation.ts`, `components/Composer.tsx`,
`components/MessageBubble.tsx`.

## Data model + transform

`models/message.ts` — add:
```ts
export type MediaKind = 'image' | 'video' | 'document';
export interface MessageMedia {
  messageId: string;
  kind: MediaKind;
  url?: string;        // signed URL if known up-front
  mimeType?: string;
  name?: string;       // document display name
}
```
`Message` gains `media?: MessageMedia`.

`SendPayload` whatsapp variant becomes
`{ channel: 'whatsapp'; text: string; attachment?: PickedAsset }`
(email stays text-only). `PickedAsset` (defined in `pick-media.ts`,
re-exported):
```ts
export interface PickedAsset {
  uri: string;
  name: string;
  mimeType: string;
  kind: MediaKind;
}
```

`transforms.ts`:
- Add `mediaKind(type)`: image|sticker→`image`; video→`video`;
  document|audio|voice→`document`; else `null`.
- `toMessage`: compute `kind = mediaKind(m.type)`. If `kind`, set
  `media = { messageId: m.id, kind, url: m.mediaUrl ?? undefined,
  mimeType: stringOf(m.metadata?.mimeType ?? m.metadata?.mime_type),
  name: stringOf(m.metadata?.filename) ?? (m.caption ?? undefined) }`
  and `text = (m.caption ?? m.content ?? '').trim()` (no `[Image]`
  placeholder when media renders). When no `kind`, behavior is unchanged
  (`bodyText`). `mediaPlaceholder`/`bodyText` stay for non-rendered kinds
  (location/contacts) and the inbox preview.

## Send path

`api/types.ts` `SendMessageInput` adds optional:
`file?: { uri: string; name: string; type: string }`, `type?: string`
(media kind), `caption?: string`, `filename?: string`. `content` becomes
optional (`content?: string`).

`api/services.ts` `sendMessage`: if `input.file` present, build a
`FormData` (append `channel`, `conversationId`, `to?`, `leadId?`,
`content?`, `caption?`, `type?`, `filename?`, and `file` as the
React-Native `{ uri, name, type }` object) and POST with a per-request
`headers: { 'Content-Type': 'multipart/form-data' }` (overrides the client's
default JSON header; the auth interceptor still applies). Otherwise JSON
exactly as today.

`hooks/use-conversation.ts` `send`: for the whatsapp branch with
`payload.attachment`, map to `SendMessageInput` with
`file: { uri, name, type: mimeType }`, `type: attachment.kind`,
`filename: attachment.name`, `caption: payload.text` (the composer text is
the caption), `content` omitted. Without an attachment, unchanged. Email
branch unchanged. Outbound media appears via the existing send →
invalidate → refetch path (server returns the message with `mediaUrl`,
which `toMessage` maps to `media`); no separate optimistic media preview.

## Picker (Composer)

`pick-media.ts`:
- `pickPhotoOrVideo()` → `ImagePicker.launchImageLibraryAsync({
  mediaTypes: ['images','videos'], quality: 0.8 })`; map first asset →
  `PickedAsset` (kind from `asset.type`, name from `fileName` or derived,
  mimeType from `mimeType` or inferred).
- `pickDocument()` → `DocumentPicker.getDocumentAsync({ copyToCacheDirectory:
  true })`; map → `PickedAsset` kind `document`.
- Both request permission as needed and return `null` on cancel/denial.

`Composer.tsx` (whatsapp mode only): the paperclip opens a small action
menu (Photo/Video, Document). A chosen asset shows as a preview chip above
the input row (thumbnail for image/video, file icon + name for document,
with a ✕ to clear). With an attachment set, the text input is the optional
caption; `canSend` becomes `!sendDisabled && (attachment != null ||
text.trim().length > 0)` for whatsapp (email rule unchanged). `handleSend`
includes `attachment` in the whatsapp payload and clears it after send.
Email composer unchanged (no attachments this pass).

## Inbound + outbound render

`MediaMessage.tsx` (used by `MessageBubble` whenever `message.media`):
- resolve URL: `message.media.url` if present, else
  `useMediaUrl(message.media.messageId)` (enabled only when url missing).
  While resolving show a small spinner box.
- `image` → `<Image>` capped (max width ~220, 4:3-ish max height, rounded).
- `video` → `expo-video` `useVideoPlayer(url)` + `<VideoView>` (~220×160,
  native controls).
- `document` → Pressable row (file icon + `name`) → `Linking.openURL(url)`.
- Caption (`message.text`) renders under the media when non-empty, reusing
  the existing bubble text styling. Works identically for `direction` in/out
  (bubble alignment/colour still handled by `MessageBubble`).

`MessageBubble.tsx`: when `message.media`, render `<MediaMessage>` in place
of the plain text line; keep the channel chip, subject, timestamp, and
ticks. Non-media messages unchanged.

`use-media-url.ts`: `useMediaUrl(messageId)` →
`useQuery({ queryKey: chatKeys.mediaUrl?(messageId) /* add to keys */,
queryFn: () => getMediaUrl(messageId), enabled: !!messageId, staleTime:
5*60_000 })`. `getMediaUrl` service GETs
`/api/v1/chat/messages/:id/media-url` and normalizes the URL field. Add
`chatKeys.mediaUrl = (id) => [...all,'media-url',id]`.

## Out of scope (YAGNI)

Camera capture (library pick only); client-side compression beyond picker
`quality`; audio recording; multi-file per send; upload progress bar
(send spinner only); email attachments; full-screen media viewer / gallery;
download-to-device.

## Acceptance

1. Paperclip (whatsapp) → pick photo, video, or document → preview chip →
   send → message posts multipart to `/chat/send`.
2. The sent media renders inline as an outbound bubble (image/video/doc)
   after the refetch, with its caption.
3. Inbound image/video/document messages render inline (not `[Image]`),
   with working video playback and document open.
4. Media with a missing/expired URL resolves via the media-url endpoint.
5. `pnpm exec tsc --noEmit` + `pnpm lint` clean; existing text/email chat
   unaffected; non-renderable kinds (location/contacts) still show their
   text placeholder.
