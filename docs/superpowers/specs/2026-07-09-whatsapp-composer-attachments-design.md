# WhatsApp-exact Composer Attachments — Design

**Date:** 2026-07-09
**Feature:** Redesign the chat composer's attachment sheet to visually match WhatsApp, and add a full WhatsApp-style Location picker (map + nearby places + search) with outbound location sending.

## Goal

The chat composer already supports attachments (photo, video, camera, document, voice). This work:

1. Restyles the attachment sheet to **exactly match WhatsApp's** 4-column circular-glyph grid.
2. Narrows the tile set to: **Photos, Camera, Location, Document** (+ the existing mic in the composer trailing). Explicitly **excludes** Poll, Event, AI images, Contact.
3. Adds **Location** end-to-end: a full-screen WhatsApp-style map picker (map, draggable center pin, current-location, nearby places list, place search) → outbound location send over WhatsApp.

Non-goals: touching the mic/voice recorder, the email/messenger composer variants, or backend changes.

## Current state (verified)

- Composer: `src/features/chat/components/Composer.tsx`. Attach button opens `AttachmentSheet` (`onPicked={setAttachment}`); mic (`VoiceRecorder`) is the trailing control when there's no text/attachment.
- `src/features/chat/components/AttachmentSheet.tsx` — plain RN `Modal` bottom sheet, tinted **rounded-square** tiles: Photo, Video, Camera, Document (Document hidden when native module absent).
- `src/features/chat/media/pick-media.ts` — `pickPhotoOrVideo`, `capturePhotoOrVideo`, `pickDocument`. `expo-document-picker` is lazily/defensively required so a missing native module hides the tile instead of crashing.
- Send: `SendPayload` (`models/message.ts:103`) → `send()` (`hooks/use-conversation.ts:197`) → `SendMessageInput` (`api/types.ts:57`) → `sendMessage()` (`api/services.ts:58`). Non-file sends POST the input object as JSON to `/chat/send`.
- `MessageLocation` (`models/message.ts:27`) + `LocationMessage.tsx` already render **incoming** locations. Location is receive-only today; there is no location entry in `SendPayload`, no Location tile, and `expo-location` is not installed.
- Maps already integrated: `react-native-maps` with `PROVIDER_GOOGLE`, key from `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (injected in `app.config.js`). Reference usages: `PropertyLocation.tsx`, `CommunityMap.tsx`, `LocationSection.tsx`.

### Backend (verified — no changes needed)

`POST /api/v1/chat/send` already accepts `latitude`, `longitude`, `locationName`, `locationAddress` (`send-message.dto.ts:80-100`). The WhatsApp provider dispatches a location message when both `latitude` and `longitude` are present and non-zero (`whatsapp.service.ts:78-94` → `sendLocationMessage` → Meta Cloud API `type: 'location'`). `type: 'location'` on the DTO is ignored; routing keys off coordinates.

**Backend caveat:** dispatch is gated on `latitude !== 0 && longitude !== 0`. Irrelevant for Dubai (~25.2, ~55.2) but means an exact-zero coordinate is silently skipped. Out of scope to fix here.

## Prerequisites

- **Google Places API** must be enabled on the `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` project (Places API — Nearby Search + Place Autocomplete/Details), and the key must permit calls from the mobile app (unrestricted, or iOS/Android app restrictions covering this bundle). Client calls Google Places HTTP endpoints directly. If Places is not enabled, the nearby-list and search will error — the map + draggable pin + current-location must still function (graceful degradation).
- `expo-location` requires a native rebuild (managed Expo). Until rebuilt, the Location tile is hidden (defensive lazy-require), mirroring the `expo-document-picker` pattern.

## Design

### A. AttachmentSheet — WhatsApp visual

Rewrite `AttachmentSheet.tsx`. Keep the RN `Modal` (`animationType="slide"`, translucent scrim, rounded-top card, safe-area bottom padding). Change the tile presentation to match WhatsApp:

- **4-column grid** (`flex-row flex-wrap`), tile width sized to 4 across.
- Each tile: a **circular** icon container (~56–64px) with a **dark translucent circle** background and a **colored glyph**; white/foreground label below. (WhatsApp uses dark circles with colored icons — not the current tinted rounded-square.)
- Tiles (in order): **Photos**, **Camera**, **Location**, **Document**.
  - Photos — glyph `Images` (blue). Opens `pickPhotoOrVideo(['images','videos'])` (video merged into Photos).
  - Camera — glyph `Camera` (neutral/white). `capturePhotoOrVideo()`.
  - Location — glyph `MapPin` (green). Navigates to the location picker (see B). Hidden when `expo-location` native module is unavailable.
  - Document — glyph `FileText` (blue). `pickDocument()`. Hidden when `expo-document-picker` unavailable (existing behavior).
- Remove the standalone **Video** tile.
- Circle background + label use theme tokens so light/dark both read correctly (dark-translucent overlay that works on the `bg-card` sheet).

Photo/Camera/Document keep the existing `onPicked(asset)` → `setAttachment` flow unchanged. Location uses a separate navigation flow (B) because its result is coordinates, not a `PickedAsset`.

### B. Location picker screen (WhatsApp-style)

New route: `app/(app)/chat/location-picker.tsx`, presented as a modal/full-screen Stack screen. Screen owns a self-contained `LocationPicker` component under `src/features/chat/`.

Layout (top → bottom), matching WhatsApp:

1. **Search bar** — "Search places". Debounced Google Places **Autocomplete**; tapping a prediction fetches Place Details (coords + name + address) and recenters the map / selects it.
2. **Map** — `MapView` `PROVIDER_GOOGLE`, ~upper 40–50%. Shows the user's blue location dot (`showsUserLocation`) and a **center-anchored pin** overlay. Dragging the map moves the map region; on `onRegionChangeComplete` the selected coordinate updates to the region center and is **reverse-geocoded** (`expo-location.reverseGeocodeAsync`, no extra key) for an address label.
3. **Recenter FAB** (bottom-right of map) — recenters to current GPS.
4. **"Send this location"** row — the current pin/current-location, with the reverse-geocoded address; tap sends.
5. **Nearby places list** — scrollable list from Google Places **Nearby Search** around the current point (name, address/vicinity, distance). Tapping a place selects its coords + name + address and sends.

Behavior:

- On mount: request location permission (`expo-location`). Granted → `getCurrentPositionAsync`, center map, load nearby. Denied → show a permission-needed state with a settings prompt; the map may still be panned manually.
- Selecting/sending returns the chosen `{ latitude, longitude, name?, address? }` to the composer. **Result delivery:** a tiny module-level store/callback in the chat feature (e.g. a `pendingLocation` ref or a Zustand slice) set by the picker and read by `ConversationScreen` on focus — router params are avoided for structured data. (Chosen over route params: coordinates + names round-trip cleanly as objects and avoid string-encoding.)
- Places API errors (not enabled / quota) degrade gracefully: search + nearby list show an inline empty/error state; map, pin, reverse-geocode, and "Send this location" continue to work.

`pick-media.ts` (or a new `media/location.ts`) gains:

- Defensive lazy-require of `expo-location` + `isLocationPickingAvailable()` (same shape as `getDocumentPicker`/`isDocumentPickingAvailable`).
- Helpers: `getCurrentCoords()`, `reverseGeocode(coords)`.
- A small Places client module for Autocomplete / Details / Nearby Search (fetch to Google endpoints with the maps key). Kept separate from `apiClient` (that's for the BOH backend).

### C. Send wiring

- `models/message.ts` — extend `SendPayload` with a WhatsApp location send. Preferred shape: add an optional `location?: { latitude: number; longitude: number; name?: string; address?: string }` to the `whatsapp` variant (mutually exclusive with `attachment`), or a dedicated `{ channel: 'whatsapp'; location: {...} }` variant. Implementation plan picks one; the composer only ever sets one of text/attachment/location.
- `api/types.ts` — `SendMessageInput` gains `latitude?`, `longitude?`, `locationName?`, `locationAddress?`.
- `api/services.ts` — non-file branch already posts `input` as JSON; the new fields flow through automatically. No multipart involved for location.
- `hooks/use-conversation.ts` `send()` — add a WhatsApp **location branch**: build an optimistic bubble carrying `location` (rendered by existing `LocationMessage`), then `sendMutation.mutate({ channel:'unified', to: phone, leadId, latitude, longitude, locationName, locationAddress, ...replyTo })`.
- `buildOptimisticMessage` — accept an optional `location` and set it on the optimistic `Message` so the bubble shows the shared location immediately.

### D. Composer

- Location tile in `AttachmentSheet` closes the sheet and `router.push`es the picker. On return, `ConversationScreen`/`Composer` reads the pending location result and calls `send({ channel:'whatsapp', location, replyTo })` (respecting the current reply target).
- Mic / `VoiceRecorder` / trailing control: unchanged.

## Testing (no test runner in this repo)

Verify per repo convention: `pnpm lint` + `tsc --noEmit`, then manual QA on a dev build (native rebuild required for `expo-location`):

- Sheet renders 4 circular tiles matching WhatsApp in light + dark.
- Photos opens combined image+video picker; Camera captures; Document picks — all send as today.
- Location tile → picker: permission flow, current location, drag-pin reverse-geocode, recenter, nearby list, search, "Send this location".
- Sending a location produces an immediate optimistic bubble and arrives on the recipient's WhatsApp as a location.
- Graceful degradation when Places API is unavailable and when `expo-location` native module is absent (tile hidden).

## Out of scope

- Backend changes (location send already supported).
- Poll, Event, AI images, Contact tiles.
- Fixing the backend `lat/long === 0` gate.
- Messenger/email location sending (WhatsApp only).
