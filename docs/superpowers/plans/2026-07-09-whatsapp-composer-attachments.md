# WhatsApp-exact Composer Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the chat attachment sheet to match WhatsApp (Photos / Camera / Location / Document circular grid + existing mic), and add a full WhatsApp-style Location picker (map + draggable pin + nearby places + search) that sends a WhatsApp location message.

**Architecture:** Frontend-only (backend already accepts `latitude`/`longitude`/`locationName`/`locationAddress` on `POST /chat/send`). Location is picked in a new full-screen Expo Router screen, its result handed back through a small Zustand draft store that `ConversationScreen` consumes and forwards to the existing `send()`. `expo-location` is loaded via defensive lazy-require so a missing native module hides the Location tile instead of crashing (same pattern as `expo-document-picker`).

**Tech Stack:** Expo SDK 54, React Native 0.81, expo-router (typed routes), NativeWind v4, TanStack Query, Zustand, react-native-maps (`PROVIDER_GOOGLE`), expo-image-picker, expo-document-picker, expo-location (new), Google Places HTTP APIs.

## Global Constraints

- Package manager is **pnpm**. Install native modules with `npx expo install <pkg>` (never `npm install`). Do not regenerate `package-lock.json`.
- **No test runner** in this repo. Verify every task with `npx tsc --noEmit` and `pnpm lint`, plus the manual-QA note in the task. Do not add a test runner or `*.test.*` files.
- Strict TypeScript. Prop types use `Readonly<{...}>`.
- Styling: NativeWind semantic tokens only (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, etc.). No hard-coded hex except the WhatsApp tile glyph colors (which are intentional brand colors, mirroring the existing `AttachmentSheet` tile `color` fields). `prettier-plugin-tailwindcss` sorts classes — don't fight it.
- Import theme via `@theme`, source via `@/*`.
- Google Maps key already injected as `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (see `app.config.js`). Places HTTP endpoints reuse this key.
- Generated `ios/`/`android/` are gitignored — do not commit native folders. `expo-location` requires a fresh dev build (`npx expo run:ios` / `run:android` or an EAS dev build) before the Location tile appears; until then the defensive guard hides it.

---

## File Structure

- `src/features/chat/media/location.ts` — **new.** Defensive `expo-location` wrapper: availability check, current coords, reverse-geocode.
- `src/features/chat/api/places.ts` — **new.** Google Places HTTP client: autocomplete, details, nearby search.
- `src/features/chat/store/location-draft.ts` — **new.** Zustand store carrying a picked location back to the conversation.
- `src/features/chat/components/LocationPicker.tsx` — **new.** The WhatsApp-style picker UI (map + pin + recenter + search + nearby list).
- `app/(app)/chat/location-picker.tsx` — **new.** Route wrapper for the picker.
- `src/features/chat/components/AttachmentSheet.tsx` — **modify.** WhatsApp circular-grid redesign; Photos merges photo+video; new Location tile.
- `src/features/chat/models/message.ts` — **modify.** Add `location` to the whatsapp `SendPayload` variant.
- `src/features/chat/api/types.ts` — **modify.** Add location fields to `SendMessageInput`.
- `src/features/chat/hooks/use-conversation.ts` — **modify.** `buildOptimisticMessage` carries a location; `send()` gets a location branch.
- `src/features/chat/components/Composer.tsx` — **modify.** New `onPickLocation` prop → AttachmentSheet Location tile.
- `src/features/chat/components/ConversationScreen.tsx` — **modify.** Provide `onPickLocation` (navigates to picker) and consume the draft store to send.
- `app.config.js` — **modify.** Add `expo-location` plugin + iOS/Android permission strings.

---

### Task 1: Install expo-location + native config

**Files:**

- Modify: `package.json` (via `expo install`)
- Modify: `app.config.js`

- [ ] **Step 1: Install the package**

Run: `npx expo install expo-location`
Expected: `expo-location` added to `dependencies` in `package.json` (a `~x.y.z` range), `pnpm-lock.yaml` updated.

- [ ] **Step 2: Add the config plugin + permission strings**

Open `app.config.js`. Find the `plugins` array and add the `expo-location` plugin entry with a usage string. Add it alongside the existing plugins (do not remove any):

```js
[
  'expo-location',
  {
    locationWhenInUsePermission:
      'BOH uses your location to let you share where you are in a chat.',
  },
],
```

If the config also sets `ios.infoPlist` or `android.permissions` explicitly elsewhere, leave those as-is — the plugin injects `NSLocationWhenInUseUsageDescription` and `ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION` automatically.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: PASS (no new errors). The package isn't imported yet.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml app.config.js
git commit -m "chore: add expo-location dependency and config plugin"
```

**Manual QA:** none yet (no runtime surface). A native rebuild is required later before the Location tile renders.

---

### Task 2: Location + Places client modules

**Files:**

- Create: `src/features/chat/media/location.ts`
- Create: `src/features/chat/api/places.ts`

**Interfaces:**

- Consumes: `MessageLocation` from `../models/message`.
- Produces:
  - `location.ts`: `isLocationPickingAvailable(): boolean`, `requestAndGetCurrentCoords(): Promise<{ latitude: number; longitude: number } | null>`, `reverseGeocode(coords: { latitude: number; longitude: number }): Promise<{ name?: string; address?: string }>`.
  - `places.ts`: `placeAutocomplete(input: string, near?: { latitude: number; longitude: number }): Promise<PlacePrediction[]>`, `placeDetails(placeId: string): Promise<MessageLocation | null>`, `nearbyPlaces(coords: { latitude: number; longitude: number }): Promise<NearbyPlace[]>`, and the types `PlacePrediction { placeId: string; primary: string; secondary?: string }`, `NearbyPlace { placeId: string; name: string; address?: string; latitude: number; longitude: number }`.

- [ ] **Step 1: Write `src/features/chat/media/location.ts`**

```ts
import type { MessageLocation } from '../models/message';

/**
 * expo-location is a native module that requires a dev build. Load it lazily
 * and defensively so a missing native module never crashes the chat screen at
 * import time — location sharing is simply unavailable until the app is rebuilt
 * (expo run:ios / run:android / EAS dev build). Mirrors media/pick-media.ts.
 */
type LocationModule = typeof import('expo-location');
let cached: LocationModule | null | undefined;

function getLocation(): LocationModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-location') as LocationModule;
  } catch {
    cached = null;
  }
  return cached;
}

/** Whether native location is available in this build. */
export function isLocationPickingAvailable(): boolean {
  return getLocation() !== null;
}

export interface Coords {
  latitude: number;
  longitude: number;
}

/** Request permission and read current GPS. Returns null on denial/unavailable. */
export async function requestAndGetCurrentCoords(): Promise<Coords | null> {
  const mod = getLocation();
  if (!mod) return null;
  const perm = await mod.requestForegroundPermissionsAsync();
  if (!perm.granted) return null;
  const pos = await mod.getCurrentPositionAsync({ accuracy: mod.Accuracy.Balanced });
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
}

/** Reverse-geocode coords to a place name + street address. Best-effort. */
export async function reverseGeocode(coords: Coords): Promise<{ name?: string; address?: string }> {
  const mod = getLocation();
  if (!mod) return {};
  try {
    const [first] = await mod.reverseGeocodeAsync(coords);
    if (!first) return {};
    const street = [first.name, first.street].filter(Boolean).join(' ');
    const address = [street || undefined, first.city, first.region, first.country]
      .filter(Boolean)
      .join(', ');
    return { name: first.name ?? undefined, address: address || undefined };
  } catch {
    return {};
  }
}

/** Narrow a partial location result to a full MessageLocation. */
export function toMessageLocation(
  coords: Coords,
  meta: { name?: string; address?: string },
): MessageLocation {
  return { latitude: coords.latitude, longitude: coords.longitude, ...meta };
}
```

- [ ] **Step 2: Write `src/features/chat/api/places.ts`**

```ts
import type { MessageLocation } from '../models/message';
import type { Coords } from '../media/location';

/**
 * Google Places (web service) client. Reuses the Maps API key. NOTE: these
 * HTTP endpoints require the key to have the "Places API" enabled and to NOT
 * be locked to Android/iOS app restrictions only (they are server-side calls).
 * All functions fail soft (return [] / null) so the picker degrades to
 * map + pin + reverse-geocode when Places is unavailable.
 */
const KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const BASE = 'https://maps.googleapis.com/maps/api/place';

export interface PlacePrediction {
  placeId: string;
  primary: string;
  secondary?: string;
}

export interface NearbyPlace {
  placeId: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function placeAutocomplete(input: string, near?: Coords): Promise<PlacePrediction[]> {
  if (!KEY || input.trim().length < 2) return [];
  const loc = near ? `&location=${near.latitude},${near.longitude}&radius=20000` : '';
  const url = `${BASE}/autocomplete/json?input=${encodeURIComponent(input)}${loc}&key=${KEY}`;
  const data = await getJson<{
    predictions?: Array<{
      place_id: string;
      structured_formatting?: { main_text?: string; secondary_text?: string };
      description?: string;
    }>;
  }>(url);
  return (data?.predictions ?? []).map((p) => ({
    placeId: p.place_id,
    primary: p.structured_formatting?.main_text ?? p.description ?? '',
    secondary: p.structured_formatting?.secondary_text,
  }));
}

export async function placeDetails(placeId: string): Promise<MessageLocation | null> {
  if (!KEY) return null;
  const url = `${BASE}/details/json?place_id=${placeId}&fields=geometry,name,formatted_address&key=${KEY}`;
  const data = await getJson<{
    result?: {
      name?: string;
      formatted_address?: string;
      geometry?: { location?: { lat: number; lng: number } };
    };
  }>(url);
  const r = data?.result;
  const loc = r?.geometry?.location;
  if (!r || !loc) return null;
  return { latitude: loc.lat, longitude: loc.lng, name: r.name, address: r.formatted_address };
}

export async function nearbyPlaces(coords: Coords): Promise<NearbyPlace[]> {
  if (!KEY) return [];
  const url = `${BASE}/nearbysearch/json?location=${coords.latitude},${coords.longitude}&radius=1500&key=${KEY}`;
  const data = await getJson<{
    results?: Array<{
      place_id: string;
      name?: string;
      vicinity?: string;
      geometry?: { location?: { lat: number; lng: number } };
    }>;
  }>(url);
  return (data?.results ?? [])
    .filter((r) => r.geometry?.location)
    .map((r) => ({
      placeId: r.place_id,
      name: r.name ?? 'Unknown place',
      address: r.vicinity,
      latitude: r.geometry!.location!.lat,
      longitude: r.geometry!.location!.lng,
    }));
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: PASS. (SonarJS cognitive-complexity cap is 20 — these functions are flat and pass.)

- [ ] **Step 4: Commit**

```bash
git add src/features/chat/media/location.ts src/features/chat/api/places.ts
git commit -m "feat(chat): add location + google places client modules"
```

**Manual QA:** none (pure modules, exercised in Task 6).

---

### Task 3: Send-path wiring for location

**Files:**

- Modify: `src/features/chat/models/message.ts:104` (the whatsapp `SendPayload` variant)
- Modify: `src/features/chat/api/types.ts:57-71` (`SendMessageInput`)
- Modify: `src/features/chat/hooks/use-conversation.ts` (`buildOptimisticMessage` ~line 40, `send()` ~line 246-307)

**Interfaces:**

- Consumes: `MessageLocation` (already exported from `models/message.ts:27`).
- Produces: `SendPayload` whatsapp variant now optionally carries `location?: MessageLocation`; `SendMessageInput` carries `latitude?`, `longitude?`, `locationName?`, `locationAddress?`.

- [ ] **Step 1: Extend the whatsapp `SendPayload` variant**

In `src/features/chat/models/message.ts`, change the whatsapp union member (currently line 104) to add an optional `location`:

```ts
export type SendPayload =
  | {
      channel: 'whatsapp';
      text: string;
      attachment?: PickedAsset;
      location?: MessageLocation;
      replyTo?: MessageReplyRef;
    }
  | { channel: 'email'; subject: string; text: string; replyTo?: MessageReplyRef }
  | { channel: 'messenger'; text: string; attachment?: PickedAsset; replyTo?: MessageReplyRef };
```

- [ ] **Step 2: Add location fields to `SendMessageInput`**

In `src/features/chat/api/types.ts`, add to the `SendMessageInput` interface (after `filename?`):

```ts
  /** Outbound WhatsApp location. Backend dispatches a location message when
   *  latitude & longitude are both present and non-zero. */
  latitude?: number;
  longitude?: number;
  locationName?: string;
  locationAddress?: string;
```

- [ ] **Step 3: Let `buildOptimisticMessage` carry a location**

In `src/features/chat/hooks/use-conversation.ts`, extend the `buildOptimisticMessage` args and return. Change its signature arg object to add `location?: MessageLocation` and spread it onto the returned message:

```ts
function buildOptimisticMessage(args: {
  id: string;
  channel: Channel;
  text: string;
  subject?: string;
  attachment?: PickedAsset;
  location?: MessageLocation;
  replyTo?: MessageReplyRef;
  now?: Date;
}): Message {
```

and in the returned object literal, add alongside the `media`/`replyTo` spreads:

```ts
    ...(args.location ? { location: args.location } : {}),
```

Ensure `MessageLocation` is imported in this file (add it to the existing `import type { … } from '../models/message'` line if not present).

- [ ] **Step 4: Add the location branch to `send()`**

In `send()` (the WhatsApp/unified section, after the `email` early-return at ~line 280 and before the `const att = payload.attachment;` attachment branch), insert a location branch. It builds an optimistic bubble with the location and posts the coordinate fields as JSON:

```ts
if (payload.channel === 'whatsapp' && payload.location) {
  const loc = payload.location;
  sendMutation.mutate(
    {
      channel: 'unified',
      to: phone,
      leadId,
      latitude: loc.latitude,
      longitude: loc.longitude,
      ...(loc.name ? { locationName: loc.name } : {}),
      ...(loc.address ? { locationAddress: loc.address } : {}),
      ...(replyToId ? { replyToMessageId: replyToId } : {}),
    },
    mutationOptions,
  );
  return;
}
```

Then update the optimistic-message construction for the whatsapp branch (the `buildOptimisticMessage({ id, channel: 'whatsapp', … })` call at ~line 246) to also pass the location so the bubble renders immediately:

```ts
          : buildOptimisticMessage({
              id,
              channel: 'whatsapp',
              text: payload.text,
              attachment: payload.channel === 'whatsapp' ? payload.attachment : undefined,
              location: payload.channel === 'whatsapp' ? payload.location : undefined,
              replyTo: quote,
            });
```

(The `payload.channel === 'whatsapp'` guards satisfy the discriminated union — `attachment`/`location` only exist on the whatsapp member.)

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: PASS. If tsc complains that `attachment`/`location` don't exist on the email payload, confirm the `payload.channel === 'whatsapp'` guards from Step 4 are in place.

- [ ] **Step 6: Commit**

```bash
git add src/features/chat/models/message.ts src/features/chat/api/types.ts src/features/chat/hooks/use-conversation.ts
git commit -m "feat(chat): wire outbound location through send payload"
```

**Manual QA:** deferred to Task 6 (no UI entry point yet).

---

### Task 4: Location draft store + composer/screen plumbing

**Files:**

- Create: `src/features/chat/store/location-draft.ts`
- Modify: `src/features/chat/components/Composer.tsx` (Props type ~line 200s, function params ~line 368-381, AttachmentSheet mount ~line 531)
- Modify: `src/features/chat/components/ConversationScreen.tsx` (imports, provide `onPickLocation`, consume draft)

**Interfaces:**

- Consumes: `MessageLocation` from `../models/message`.
- Produces: `useLocationDraft` Zustand hook with `{ draft: LocationDraft | null; setDraft(d: LocationDraft): void; clear(): void }` where `LocationDraft = { conversationId: string; location: MessageLocation }`. `Composer` gains an optional `onPickLocation?: () => void` prop passed to `AttachmentSheet` (added in Task 5).

- [ ] **Step 1: Write the draft store**

Look at `src/store/auth.store.ts` for the project's Zustand idiom (`create` from `zustand`). Create `src/features/chat/store/location-draft.ts`:

```ts
import { create } from 'zustand';

import type { MessageLocation } from '../models/message';

export interface LocationDraft {
  conversationId: string;
  location: MessageLocation;
}

interface LocationDraftState {
  draft: LocationDraft | null;
  setDraft: (draft: LocationDraft) => void;
  clear: () => void;
}

/**
 * One-shot hand-off channel from the location-picker screen back to the
 * conversation that opened it. The picker sets a draft then navigates back;
 * ConversationScreen consumes it (matching its own conversationId) and clears.
 */
export const useLocationDraft = create<LocationDraftState>((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
  clear: () => set({ draft: null }),
}));
```

- [ ] **Step 2: Add `onPickLocation` to Composer props and pass it down**

In `src/features/chat/components/Composer.tsx`:

1. Add to the `Props` interface: `onPickLocation?: () => void;`
2. Destructure it in the component params (add `onPickLocation,` to the destructured props at ~line 368-381).
3. Pass it to the `AttachmentSheet` at ~line 531:

```tsx
<AttachmentSheet
  visible={attachOpen}
  onClose={() => setAttachOpen(false)}
  onPicked={setAttachment}
  onPickLocation={onPickLocation}
/>
```

(The `onPickLocation` prop is added to `AttachmentSheet` in Task 5. Ordering note: this line will typecheck only after Task 5's prop addition — if implementing strictly in order, Step 5's typecheck runs after Task 5. To keep this task self-checking, implement Task 5 Step 1's prop-type change first, or temporarily accept the type error until Task 5. Recommended: implement Task 5 immediately after this task before typechecking both.)

- [ ] **Step 3: Provide `onPickLocation` from ConversationScreen**

In `src/features/chat/components/ConversationScreen.tsx`:

1. Add imports at the top:

```ts
import { useEffect } from 'react'; // already imported — extend existing import
import { useFocusEffect, useRouter } from 'expo-router';
import { useLocationDraft } from '../store/location-draft';
```

(`useCallback`, `useEffect`, `useRef`, `useState` are already imported from `react` — add `useFocusEffect`/`useRouter` from expo-router; do not duplicate the react import.)

2. Inside the component, after `const insets = ...`:

```ts
const router = useRouter();
```

3. Add the navigate handler (near the other `useCallback`s, after `handleSend`):

```ts
const onPickLocation = useCallback(() => {
  router.push({ pathname: '/(app)/chat/location-picker', params: { conversationId } });
}, [router, conversationId]);
```

4. Consume the draft when the screen regains focus (after returning from the picker). Add after `handleSend`:

```ts
const locationDraft = useLocationDraft((s) => s.draft);
const clearLocationDraft = useLocationDraft((s) => s.clear);
useFocusEffect(
  useCallback(() => {
    if (locationDraft && locationDraft.conversationId === conversationId) {
      handleSend({
        channel: 'whatsapp',
        text: '',
        location: locationDraft.location,
        ...(replyTarget ? { replyTo: replyTarget } : {}),
      });
      clearLocationDraft();
    }
  }, [locationDraft, conversationId, handleSend, replyTarget, clearLocationDraft]),
);
```

5. Pass `onPickLocation` to the `<Composer .../>` (add the prop):

```tsx
          <Composer
            channel={sendChannel}
            onChannelChange={setSendChannel}
            onSend={handleSend}
            onPickLocation={onPickLocation}
            emailEnabled={emailEnabled}
            ...
```

- [ ] **Step 4: Typecheck + lint** (run after Task 5 Step 1 if implementing in order)

Run: `npx tsc --noEmit && pnpm lint`
Expected: PASS once `AttachmentSheet` accepts `onPickLocation` (Task 5).

- [ ] **Step 5: Commit**

```bash
git add src/features/chat/store/location-draft.ts src/features/chat/components/Composer.tsx src/features/chat/components/ConversationScreen.tsx
git commit -m "feat(chat): plumb location draft from picker back into send"
```

**Manual QA:** deferred to Task 6.

---

### Task 5: AttachmentSheet — WhatsApp circular grid + Location tile

**Files:**

- Modify (rewrite body): `src/features/chat/components/AttachmentSheet.tsx`

**Interfaces:**

- Consumes: `pickPhotoOrVideo`, `capturePhotoOrVideo`, `pickDocument`, `isDocumentPickingAvailable` from `../media/pick-media`; `isLocationPickingAvailable` from `../media/location`; `PickedAsset` from `../models/message`.
- Produces: `AttachmentSheet` now accepts `onPickLocation?: () => void` in addition to `visible`, `onClose`, `onPicked`.

- [ ] **Step 1: Rewrite `AttachmentSheet.tsx`**

Replace the file contents. Keeps the RN `Modal` + slide + scrim, switches tiles to WhatsApp's 4-across circular-glyph grid, merges photo+video into "Photos", adds the "Location" tile (hidden when `expo-location` unavailable), keeps "Document" (hidden when its module unavailable). Removes the standalone "Video" tile.

```tsx
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';

import {
  capturePhotoOrVideo,
  isDocumentPickingAvailable,
  pickDocument,
  pickPhotoOrVideo,
} from '../media/pick-media';
import { isLocationPickingAvailable } from '../media/location';
import type { PickedAsset } from '../models/message';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPicked: (asset: PickedAsset) => void;
  onPickLocation?: () => void;
}

interface Tile {
  key: string;
  icon: IconName;
  label: string;
  color: string;
  onPress: () => void;
}

function noop(): void {}

export function AttachmentSheet({ visible, onClose, onPicked, onPickLocation }: Readonly<Props>) {
  const insets = useSafeAreaInsets();

  // Asset-producing tiles: close sheet, run the picker, stage the result.
  const runPick = (run: () => Promise<PickedAsset | null>) => (): void => {
    onClose();
    run()
      .then((asset) => {
        if (asset) onPicked(asset);
      })
      .catch(noop);
  };

  const tiles: Tile[] = [
    {
      key: 'photos',
      icon: 'Images',
      label: 'Photos',
      color: '#3b82f6',
      onPress: runPick(() => pickPhotoOrVideo(['images', 'videos'])),
    },
    {
      key: 'camera',
      icon: 'Camera',
      label: 'Camera',
      color: '#ef4444',
      onPress: runPick(capturePhotoOrVideo),
    },
  ];

  if (onPickLocation && isLocationPickingAvailable()) {
    tiles.push({
      key: 'location',
      icon: 'MapPin',
      label: 'Location',
      color: '#22c55e',
      onPress: () => {
        onClose();
        onPickLocation();
      },
    });
  }

  if (isDocumentPickingAvailable()) {
    tiles.push({
      key: 'document',
      icon: 'FileText',
      label: 'Document',
      color: '#6366f1',
      onPress: runPick(pickDocument),
    });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        className="flex-1 bg-black/40"
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close attachment picker"
      />
      <View
        className="absolute bottom-0 w-full rounded-t-3xl bg-card px-4 pt-5"
        style={{ paddingBottom: insets.bottom + 20 }}
      >
        <View className="flex-row flex-wrap">
          {tiles.map((t) => (
            <View key={t.key} className="w-1/4 items-center py-3">
              <Pressable
                onPress={t.onPress}
                accessibilityRole="button"
                accessibilityLabel={t.label}
                className="items-center active:opacity-70"
              >
                <View
                  className="h-16 w-16 items-center justify-center rounded-full"
                  style={{ backgroundColor: t.color }}
                >
                  <Icon name={t.icon} size={26} color="#FFFFFF" />
                </View>
                <Text className="mt-2 text-xs text-foreground">{t.label}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
}
```

Notes:

- Grid is `flex-wrap` with each cell `w-1/4` → exactly 4 per row, wrapping to a second row if future tiles are added.
- Glyph colors mirror WhatsApp (Photos blue, Camera red, Location green, Document indigo). The circle uses the solid brand color with a white glyph — matching WhatsApp's colored-tile treatment. (If a closer match to the screenshot's dark-circle look is wanted, swap the circle `style` to a translucent neutral and set `Icon color={t.color}` — confirm during QA.)
- Verify the lucide icon key `Images` exists in `lucide-react-native/icons`; if the `Icon` atom's `IconName` type rejects it, use `Image` (already used previously) — but prefer `Images` (the stacked-photos glyph WhatsApp uses).

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: PASS. If `IconName` rejects `'Images'` or `'FileText'`, substitute a valid lucide key (`'Image'`, `'File'`) and note it.

- [ ] **Step 3: Commit**

```bash
git add src/features/chat/components/AttachmentSheet.tsx
git commit -m "feat(chat): whatsapp-style attachment grid with location tile"
```

**Manual QA (after a dev build):** open a WhatsApp conversation → tap the paperclip → sheet shows 4 circular tiles: Photos, Camera, Location, Document. Photos opens a combined image+video picker; Camera captures; Document picks a file (all send as before). Location tile is present only on a build that includes `expo-location`.

---

### Task 6: Location picker screen

**Files:**

- Create: `src/features/chat/components/LocationPicker.tsx`
- Create: `app/(app)/chat/location-picker.tsx`

**Interfaces:**

- Consumes: `requestAndGetCurrentCoords`, `reverseGeocode`, `toMessageLocation`, `Coords` from `../media/location`; `placeAutocomplete`, `placeDetails`, `nearbyPlaces`, `PlacePrediction`, `NearbyPlace` from `../api/places`; `useLocationDraft` from `../store/location-draft`; `MessageLocation` from `../models/message`.
- Produces: the `location-picker` route; sets a `LocationDraft` and navigates back.

- [ ] **Step 1: Write `src/features/chat/components/LocationPicker.tsx`**

Model the `MapView` usage on `src/features/properties/components/detail/PropertyLocation.tsx` (same `PROVIDER_GOOGLE` import). A center-anchored pin overlay stays fixed while the map pans; the selected coordinate is the map region center, reverse-geocoded on settle. A debounced search drives Places autocomplete; a nearby list is loaded around the current point. Selecting anywhere sends immediately.

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import {
  type Coords,
  requestAndGetCurrentCoords,
  reverseGeocode,
  toMessageLocation,
} from '../media/location';
import {
  type NearbyPlace,
  type PlacePrediction,
  nearbyPlaces,
  placeAutocomplete,
  placeDetails,
} from '../api/places';
import type { MessageLocation } from '../models/message';
import { useLocationDraft } from '../store/location-draft';

const DUBAI: Coords = { latitude: 25.2048, longitude: 55.2708 };
const DELTA = { latitudeDelta: 0.01, longitudeDelta: 0.01 };

interface Props {
  conversationId: string;
  onDone: () => void;
}

export function LocationPicker({ conversationId, onDone }: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  const primary = useThemeColor('--primary');
  const mutedColor = useThemeColor('--muted-foreground');
  const mapRef = useRef<MapView>(null);
  const setDraft = useLocationDraft((s) => s.setDraft);

  const [center, setCenter] = useState<Coords>(DUBAI);
  const [address, setAddress] = useState<string | undefined>(undefined);
  const [nearby, setNearby] = useState<NearbyPlace[]>([]);
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [ready, setReady] = useState(false);

  // Initial: current location → recenter map → load nearby.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const coords = (await requestAndGetCurrentCoords()) ?? DUBAI;
      if (!alive) return;
      setCenter(coords);
      setReady(true);
      mapRef.current?.animateToRegion({ ...coords, ...DELTA }, 350);
      const meta = await reverseGeocode(coords);
      if (alive) setAddress(meta.address ?? meta.name);
      const places = await nearbyPlaces(coords);
      if (alive) setNearby(places);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Reverse-geocode the map center after the user pans (map center is the pin).
  const onRegionChangeComplete = useCallback((region: Region) => {
    const coords = { latitude: region.latitude, longitude: region.longitude };
    setCenter(coords);
    void reverseGeocode(coords).then((meta) => setAddress(meta.address ?? meta.name));
  }, []);

  // Debounced autocomplete.
  useEffect(() => {
    if (query.trim().length < 2) {
      setPredictions([]);
      return;
    }
    const t = setTimeout(() => {
      void placeAutocomplete(query, center).then(setPredictions);
    }, 300);
    return () => clearTimeout(t);
  }, [query, center]);

  const send = useCallback(
    (location: MessageLocation) => {
      setDraft({ conversationId, location });
      onDone();
    },
    [conversationId, onDone, setDraft],
  );

  const sendCurrentPin = useCallback(() => {
    send(toMessageLocation(center, { address }));
  }, [center, address, send]);

  const pickPrediction = useCallback(
    (placeId: string) => {
      void placeDetails(placeId).then((loc) => {
        if (!loc) return;
        setQuery('');
        setPredictions([]);
        setCenter({ latitude: loc.latitude, longitude: loc.longitude });
        mapRef.current?.animateToRegion(
          { latitude: loc.latitude, longitude: loc.longitude, ...DELTA },
          350,
        );
        send(loc);
      });
    },
    [send],
  );

  const recenter = useCallback(() => {
    void requestAndGetCurrentCoords().then((coords) => {
      if (!coords) return;
      setCenter(coords);
      mapRef.current?.animateToRegion({ ...coords, ...DELTA }, 350);
    });
  }, []);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Search bar */}
      <View className="flex-row items-center border-b border-border px-3 py-2">
        <Pressable onPress={onDone} accessibilityLabel="Close" hitSlop={8} className="pr-2">
          <Icon name="ArrowLeft" size={22} color={mutedColor} />
        </Pressable>
        <View className="flex-1 flex-row items-center rounded-full bg-muted px-3">
          <Icon name="Search" size={16} color={mutedColor} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search places"
            placeholderTextColor={mutedColor}
            className="ml-2 h-10 flex-1 text-foreground"
          />
        </View>
      </View>

      {predictions.length > 0 ? (
        <FlatList
          data={predictions}
          keyExtractor={(p) => p.placeId}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => pickPrediction(item.placeId)}
              className="border-b border-border px-4 py-3 active:bg-muted"
            >
              <Text className="text-foreground">{item.primary}</Text>
              {item.secondary ? (
                <Text className="text-xs text-muted-foreground">{item.secondary}</Text>
              ) : null}
            </Pressable>
          )}
        />
      ) : (
        <>
          <View className="h-64">
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={{ flex: 1 }}
              initialRegion={{ ...DUBAI, ...DELTA }}
              showsUserLocation
              onRegionChangeComplete={onRegionChangeComplete}
            />
            {/* Fixed center pin */}
            <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
              <Icon name="MapPin" size={36} color={primary} />
            </View>
            {/* Recenter FAB */}
            <Pressable
              onPress={recenter}
              accessibilityLabel="Recenter"
              className="absolute bottom-3 right-3 h-11 w-11 items-center justify-center rounded-full bg-card active:opacity-80"
              style={{ elevation: 3 }}
            >
              <Icon name="LocateFixed" size={20} color={primary} />
            </Pressable>
            {!ready ? (
              <View className="absolute inset-0 items-center justify-center">
                <ActivityIndicator color={primary} />
              </View>
            ) : null}
          </View>

          {/* Send this location */}
          <Pressable
            onPress={sendCurrentPin}
            className="flex-row items-center border-b border-border px-4 py-3 active:bg-muted"
          >
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-primary">
              <Icon name="MapPin" size={20} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text className="font-medium text-foreground">Send this location</Text>
              {address ? (
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                  {address}
                </Text>
              ) : null}
            </View>
          </Pressable>

          {/* Nearby places */}
          <FlatList
            data={nearby}
            keyExtractor={(p) => p.placeId}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  send({
                    latitude: item.latitude,
                    longitude: item.longitude,
                    name: item.name,
                    address: item.address,
                  })
                }
                className="flex-row items-center border-b border-border px-4 py-3 active:bg-muted"
              >
                <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-muted">
                  <Icon name="MapPin" size={16} color={mutedColor} />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground" numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.address ? (
                    <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                      {item.address}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            )}
          />
        </>
      )}
    </View>
  );
}
```

Notes:

- Verify lucide keys `ArrowLeft`, `Search`, `LocateFixed`, `MapPin` are valid `IconName`s; substitute (`Locate`, `Crosshair`) if the type rejects one.
- The pin is a fixed overlay at map center (`pointerEvents="none"`); dragging the map moves the region, `onRegionChangeComplete` reads the new center — the WhatsApp idiom.
- If Places is disabled on the key, `nearby` stays `[]` and `predictions` stays `[]`; map + pin + "Send this location" still work.

- [ ] **Step 2: Write the route `app/(app)/chat/location-picker.tsx`**

Model on `app/(app)/chat/[id].tsx` (permission gate + `useLocalSearchParams`). Present as a modal.

```tsx
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { LocationPicker } from '@/features/chat/components/LocationPicker';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';

export default function LocationPickerRoute() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const state = useRequirePermission(PERMISSIONS.CHAT_WRITE);

  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/chat" />;

  return (
    <>
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      <LocationPicker conversationId={conversationId} onDone={() => router.back()} />
    </>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: PASS. Typed routes: if `router.push({ pathname: '/(app)/chat/location-picker', ... })` in ConversationScreen errors on the path literal, run the Expo type generation (`npx expo customize tsconfig.json` is not needed — types regenerate on `pnpm start`), or use the route string Expo generates (check `.expo/types`). Adjust the `pathname` to the generated typed-route value if needed.

- [ ] **Step 4: Commit**

```bash
git add src/features/chat/components/LocationPicker.tsx "app/(app)/chat/location-picker.tsx"
git commit -m "feat(chat): whatsapp-style location picker screen"
```

**Manual QA (requires a dev build with expo-location + Places enabled):**

1. `npx expo run:ios` (or `run:android`) to get a build including `expo-location`.
2. Open a WhatsApp conversation → paperclip → Location.
3. Grant location permission → map centers on you, pin at center, address under "Send this location", nearby list populates.
4. Pan the map → address updates to the new center. Tap the recenter FAB → returns to your GPS.
5. Type in Search → predictions appear; tap one → sends that place.
6. Tap "Send this location" or a nearby place → returns to the chat, an optimistic location bubble appears (rendered by `LocationMessage`), then ticks to sent; the recipient receives a WhatsApp location.
7. Deny permission → map falls back to Dubai center, manual pan still works, "Send this location" still sends.

---

## Self-Review

**Spec coverage:**

- Sheet WhatsApp visual + Photos/Camera/Location/Document, video merged, no Poll/Event/AI/Contact → Task 5. ✅
- Mic unchanged → not touched (Composer trailing untouched). ✅
- Location map picker (map, drag pin, current-location, reverse-geocode, recenter, nearby, search) → Task 6. ✅
- Backend send fields → Task 3. ✅
- expo-location defensive guard + native-rebuild note → Task 1 (install), Task 2 (guard), Task 5 (tile hidden). ✅
- Places API prerequisite + graceful degradation → Task 2 (fail-soft), Task 6 (empty states). ✅
- Result delivery via store, not route params → Task 4. ✅

**Placeholder scan:** No TBD/TODO; every code step shows full code. Icon-key and typed-route caveats are explicit verification instructions, not placeholders.

**Type consistency:** `MessageLocation` used consistently (models). `Coords` defined in `media/location.ts`, imported by `places.ts` and `LocationPicker`. `LocationDraft`/`useLocationDraft` names match across Task 4 and Task 6. `onPickLocation` prop name matches across Composer (Task 4) and AttachmentSheet (Task 5). `send()` location branch (Task 3) matches the `SendPayload` whatsapp `location` field (Task 3) set by the draft consumer (Task 4).

**Known ordering coupling:** Task 4 Step 2 and Task 5 Step 1 are mutually dependent (Composer passes `onPickLocation` that AttachmentSheet must accept) — implement Task 5 immediately after Task 4 before typechecking, as noted in Task 4 Step 2.
