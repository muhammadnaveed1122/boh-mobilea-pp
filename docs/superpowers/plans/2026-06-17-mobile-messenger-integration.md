# Mobile Messenger Integration + Voice Recording Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Meta Messenger a live chat channel in the mobile app (inbound display, outbound text/media, reactions, reply) matching WhatsApp UX, and add voice-note recording to Messenger + WhatsApp.

**Architecture:** Extend the existing unified chat pipeline (Approach A). Add `'messenger'` to the channel model and thread it through types, transforms, the conversation hook, and the composer. Messenger sends go to the backend's dedicated `/chat/messenger/*` endpoints (conversationId-keyed) instead of `/chat/send`. Voice notes record to `.m4a` via `expo-audio` and reuse the media-send paths. Backend requires zero changes.

**Tech Stack:** Expo SDK 54, React Native 0.81, React 19, TanStack Query, NativeWind v4, `expo-audio` (recording/playback), `expo-image-picker`, `expo-document-picker`, `react-native-gesture-handler`, `react-native-reanimated` v4.

**Verification note:** `boh-mobile` has NO test runner (per `CLAUDE.md`). There is no TDD loop here. Each task is verified with `pnpm exec tsc --noEmit` + `pnpm lint`, plus the manual-QA checklist in Task 15. Do not add a test runner.

**Conventions to honor:** Strict TS; `Readonly<{...}>` prop types; semantic Tailwind tokens (no hex); `cn(...)` for class merge; single quotes; Prettier auto-sorts classes. Commit after each task.

---

## File Structure

**Modify:**

- `src/features/chat/models/channel.ts` — add `messenger` channel + meta
- `src/features/chat/models/message.ts` — `MediaKind` += `audio`; `SendPayload` += messenger variant; `PickedAsset.durationMs`
- `src/features/chat/api/types.ts` — Messenger send input types
- `src/features/chat/api/services.ts` — `sendMessengerMessage`, `sendMessengerMedia`
- `src/features/chat/api/transforms.ts` — recognize `messenger`; map `audio`→`audio`
- `src/features/chat/hooks/use-conversation.ts` — messenger counts, send branch, retry, `isMessenger`
- `src/features/chat/hooks/use-chat-inbox.ts` — optional channel filter
- `src/features/chat/components/ChannelFilterBar.tsx` — messenger filter label
- `src/features/chat/components/ConversationScreen.tsx` — messenger-mode adaptation
- `src/features/chat/components/Composer.tsx` — messenger channel, attachment sheet, mic↔send, voice
- `src/features/chat/components/MediaMessage.tsx` — audio playback
- `src/features/chat/components/ChatInboxScreen.tsx` — accept channel filter
- `app/(app)/chat/inbox.tsx` — read `channel` search param
- `src/features/chat/components/ChatChannelSelector.tsx` — enable Messenger tile

**Create:**

- `src/features/chat/hooks/use-send-messenger.ts` — messenger text/media mutations
- `src/features/chat/media/record-voice.ts` — voice recording helper (expo-audio)
- `src/features/chat/components/AttachmentSheet.tsx` — Photo/Video/Document/Camera sheet
- `src/features/chat/components/VoiceRecorder.tsx` — hold+lock recording bar
- `src/features/chat/components/AudioMessage.tsx` — voice-note playback bubble

---

## Task 1: Add Messenger to the channel model

**Files:**

- Modify: `src/features/chat/models/channel.ts`
- Modify: `src/features/chat/components/ChannelFilterBar.tsx:18-22`

- [ ] **Step 1: Add the messenger channel + meta**

Replace the full contents of `src/features/chat/models/channel.ts` with:

```typescript
import type { IconName } from '@/components/atoms/Icon';

/** Messaging channels a single contact thread can interleave. */
export type Channel = 'whatsapp' | 'email' | 'messenger';

/** Filter selector on the conversation screen — `all` shows every channel. */
export type ChannelFilter = 'all' | Channel;

interface ChannelMeta {
  /** Human label used on pills, chips and the composer toggle. */
  label: string;
  /** Lucide icon key (see `@/components/atoms/Icon`). */
  icon: IconName;
  /** Soft Badge variant for the per-message channel chip. */
  chipVariant: 'successSoft' | 'infoSoft';
  /** Semantic accent token name, used for the channel dot. */
  accentToken: '--success' | '--info';
}

export const CHANNEL_META: Record<Channel, ChannelMeta> = {
  whatsapp: {
    label: 'WhatsApp',
    icon: 'MessageCircle',
    chipVariant: 'successSoft',
    accentToken: '--success',
  },
  email: {
    label: 'Email',
    icon: 'Mail',
    chipVariant: 'infoSoft',
    accentToken: '--info',
  },
  messenger: {
    label: 'Messenger',
    icon: 'MessagesSquare',
    chipVariant: 'infoSoft',
    accentToken: '--info',
  },
};

/** Ordered list backing the filter bar (`all` first, then each channel). */
export const CHANNEL_FILTERS: ChannelFilter[] = ['all', 'whatsapp', 'email', 'messenger'];
```

> Note: Messenger reuses the `--info` accent and `infoSoft` chip to avoid introducing a new theme token. This keeps `ChannelMeta`'s union types unchanged.

- [ ] **Step 2: Add the messenger filter label**

In `src/features/chat/components/ChannelFilterBar.tsx`, replace the `FILTER_LABEL` map (lines 18-22):

```typescript
const FILTER_LABEL: Record<ChannelFilter, string> = {
  all: 'All',
  whatsapp: 'WhatsApp',
  email: 'Email',
  messenger: 'Messenger',
};
```

- [ ] **Step 3: Verify**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (no errors). New `messenger` key forces exhaustive maps to compile.

- [ ] **Step 4: Commit**

```bash
git add src/features/chat/models/channel.ts src/features/chat/components/ChannelFilterBar.tsx
git commit -m "feat(chat): add messenger to channel model"
```

---

## Task 2: Extend message + payload types for messenger and audio

**Files:**

- Modify: `src/features/chat/models/message.ts`

- [ ] **Step 1: Add `audio` to MediaKind, `durationMs` to PickedAsset, messenger SendPayload variant**

In `src/features/chat/models/message.ts`:

Replace line 13:

```typescript
export type MediaKind = 'image' | 'video' | 'document' | 'audio';
```

Replace the `PickedAsset` interface (lines 26-32):

```typescript
/** A locally-picked asset queued for sending. */
export interface PickedAsset {
  uri: string;
  name: string;
  mimeType: string;
  kind: MediaKind;
  /** Duration in ms — set for recorded voice notes. */
  durationMs?: number;
}
```

Replace the `SendPayload` union (lines 84-87):

```typescript
/** Payload accepted by the composer's send action. */
export type SendPayload =
  | { channel: 'whatsapp'; text: string; attachment?: PickedAsset; replyTo?: MessageReplyRef }
  | { channel: 'email'; subject: string; text: string; replyTo?: MessageReplyRef }
  | { channel: 'messenger'; text: string; attachment?: PickedAsset; replyTo?: MessageReplyRef };
```

- [ ] **Step 2: Verify**

Run: `pnpm exec tsc --noEmit`
Expected: FAIL — `use-conversation.ts` and `Composer.tsx` switch on `SendPayload.channel` / `MediaKind` and are not yet exhaustive. This is expected; later tasks fix them. Confirm the ONLY errors are in `use-conversation.ts`, `Composer.tsx`, `MediaMessage.tsx`, `transforms.ts`. If errors appear elsewhere, stop and investigate.

- [ ] **Step 3: Commit**

```bash
git add src/features/chat/models/message.ts
git commit -m "feat(chat): add audio media kind and messenger send payload"
```

---

## Task 3: Teach transforms about messenger + audio

**Files:**

- Modify: `src/features/chat/api/transforms.ts:15-31` (resolveChannel)
- Modify: `src/features/chat/api/transforms.ts:67-81` (mediaKind)

- [ ] **Step 1: Recognize the messenger channel**

Replace `resolveChannel` (lines 15-31):

```typescript
export function resolveChannel(m: ChannelLike): Channel {
  const ch = (m.channel ?? '').toLowerCase();
  if (ch === 'messenger') return 'messenger';
  if (ch === 'email') return 'email';

  const t = (m.type ?? '').toLowerCase();
  if (t === 'email' || t === 'mail') return 'email';

  const meta = m.metadata ?? {};
  const metaType = meta.type;
  if (typeof metaType === 'string' && metaType.toLowerCase() === 'email') return 'email';

  const subject = meta.subject;
  if ((ch === 'unified' || ch === '') && typeof subject === 'string' && subject.trim() !== '') {
    return 'email';
  }
  return 'whatsapp';
}
```

- [ ] **Step 2: Render audio/voice as a playable `audio` kind**

Replace `mediaKind` (lines 67-81):

```typescript
/** Backend media `type` → renderable kind, or null (text-placeholder kinds). */
export function mediaKind(type: string | null | undefined): MediaKind | null {
  switch ((type ?? '').toLowerCase()) {
    case 'image':
    case 'sticker':
      return 'image';
    case 'video':
      return 'video';
    case 'audio':
    case 'voice':
      return 'audio';
    case 'document':
      return 'document';
    default:
      return null;
  }
}
```

- [ ] **Step 3: Verify**

Run: `pnpm exec tsc --noEmit`
Expected: still failing only in `use-conversation.ts`, `Composer.tsx`, `MediaMessage.tsx` (those handle the new audio kind / messenger payload later). `transforms.ts` itself must be error-free.

- [ ] **Step 4: Commit**

```bash
git add src/features/chat/api/transforms.ts
git commit -m "feat(chat): resolve messenger channel and audio media in transforms"
```

---

## Task 4: Add Messenger send API types + services

**Files:**

- Modify: `src/features/chat/api/types.ts` (append after `SendLeadEmailInput`)
- Modify: `src/features/chat/api/services.ts` (append new functions)

- [ ] **Step 1: Add the messenger input types**

Append to `src/features/chat/api/types.ts` (after line 116):

```typescript
/**
 * Body for `POST /chat/messenger/messages` (text reply within an existing
 * Messenger conversation). The backend resolves the recipient PSID from the
 * conversation, so only `conversationId` + `content` are sent.
 */
export interface SendMessengerInput {
  conversationId: string;
  content: string;
}

/**
 * Multipart body for `POST /chat/messenger/messages/media`. `conversationId`
 * is sent as a form field alongside the React-Native file descriptor.
 */
export interface SendMessengerMediaInput {
  conversationId: string;
  file: { uri: string; name: string; type: string };
}
```

- [ ] **Step 2: Add the messenger service functions**

In `src/features/chat/api/services.ts`, add `SendMessengerInput` and `SendMessengerMediaInput` to the type import block (lines 5-13):

```typescript
import {
  type ApiConversation,
  type ApiMessage,
  type ApiWhatsappTemplate,
  extractRows,
  type SendLeadEmailInput,
  type SendMessageInput,
  type SendMessengerInput,
  type SendMessengerMediaInput,
  type SendTemplateInput,
} from './types';
```

Append at the end of `src/features/chat/api/services.ts`:

```typescript
/**
 * Send a Messenger text reply. Uses the dedicated messenger endpoint (NOT
 * `/chat/send`, which rejects `channel=messenger`). PSID is resolved
 * server-side from the conversation.
 */
export async function sendMessengerMessage(input: SendMessengerInput): Promise<void> {
  await apiClient.post(`${BASE}/messenger/messages`, input);
}

/**
 * Send a Messenger media file or voice note (multipart). The backend uploads
 * the buffer to storage and forwards it to Meta. Audio is sent natively when
 * the mime is Meta-accepted (audio/mp4 from `.m4a` recordings qualifies).
 */
export async function sendMessengerMedia(input: SendMessengerMediaInput): Promise<void> {
  const form = new FormData();
  form.append('conversationId', input.conversationId);
  form.append('file', {
    uri: input.file.uri,
    name: input.file.name,
    type: input.file.type,
  } as unknown as Blob);
  await apiClient.post(`${BASE}/messenger/messages/media`, form, {
    headers: { 'Content-Type': undefined },
  });
}
```

- [ ] **Step 3: Verify**

Run: `pnpm exec tsc --noEmit`
Expected: no NEW errors in `types.ts`/`services.ts` (pre-existing errors from Tasks 2-3 in other files may remain).

- [ ] **Step 4: Commit**

```bash
git add src/features/chat/api/types.ts src/features/chat/api/services.ts
git commit -m "feat(chat): add messenger send API types and services"
```

---

## Task 5: Add the messenger send mutations hook

**Files:**

- Create: `src/features/chat/hooks/use-send-messenger.ts`

- [ ] **Step 1: Create the hook**

Create `src/features/chat/hooks/use-send-messenger.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { sendMessengerMedia, sendMessengerMessage } from '../api/services';
import type { SendMessengerInput, SendMessengerMediaInput } from '../api/types';
import { chatKeys } from './keys';

/**
 * Messenger send mutations. Messenger uses its own backend endpoints
 * (conversationId-keyed) rather than the unified `/chat/send`. Both mutations
 * invalidate the conversation's message list and the inbox on success.
 */
export function useSendMessenger(conversationId: string) {
  const qc = useQueryClient();

  const invalidate = (): void => {
    qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) }).catch(() => {});
    qc.invalidateQueries({ queryKey: chatKeys.conversations() }).catch(() => {});
  };

  const text = useMutation<void, Error, SendMessengerInput>({
    mutationFn: sendMessengerMessage,
    onSuccess: invalidate,
  });

  const media = useMutation<void, Error, SendMessengerMediaInput>({
    mutationFn: sendMessengerMedia,
    onSuccess: invalidate,
  });

  return { text, media };
}
```

- [ ] **Step 2: Verify**

Run: `pnpm exec tsc --noEmit`
Expected: no new errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/features/chat/hooks/use-send-messenger.ts
git commit -m "feat(chat): add useSendMessenger mutations hook"
```

---

## Task 6: Wire messenger into the conversation hook

**Files:**

- Modify: `src/features/chat/hooks/use-conversation.ts`

- [ ] **Step 1: Import the messenger hook**

Add to the imports near line 20:

```typescript
import { useSendMessenger } from './use-send-messenger';
```

- [ ] **Step 2: Add messenger to ChannelCounts**

Replace `ChannelCounts` (lines 69-73):

```typescript
export interface ChannelCounts {
  all: number;
  whatsapp: number;
  email: number;
  messenger: number;
}
```

- [ ] **Step 3: Count messenger messages**

Replace the `counts` memo (lines 116-123):

```typescript
const counts = useMemo<ChannelCounts>(
  () => ({
    all: allMessages.length,
    whatsapp: allMessages.filter((m) => m.channel === 'whatsapp').length,
    email: allMessages.filter((m) => m.channel === 'email').length,
    messenger: allMessages.filter((m) => m.channel === 'messenger').length,
  }),
  [allMessages],
);
```

- [ ] **Step 4: Derive `isMessenger` and instantiate the messenger mutations**

After the line `const sendMutation = useSendMessage(conversationId);` (line 147), add:

```typescript
const messengerSend = useSendMessenger(conversationId);
const isMessenger = (conv?.channel ?? '').toLowerCase() === 'messenger';
```

- [ ] **Step 5: Handle the messenger branch in `send`**

In the `send` callback, add the messenger branch at the very top of the function body, immediately after `(payload: SendPayload) => {` (before the existing `if (payload.channel === 'email' && !leadId) return;` on line 150):

```typescript
if (payload.channel === 'messenger') {
  const id = tmpId();
  const quote = payload.replyTo;
  const optimistic = buildOptimisticMessage({
    id,
    channel: 'messenger',
    text: payload.text,
    attachment: payload.attachment,
    replyTo: quote,
  });
  const key = chatKeys.messages(conversationId);
  qc.setQueryData<Message[]>(key, (prev) => [...(prev ?? []), optimistic]);
  const markFailed = (): void => {
    qc.setQueryData<Message[]>(key, markMessageFailed(id));
  };
  const att = payload.attachment;
  if (att) {
    messengerSend.media.mutate(
      {
        conversationId,
        file: { uri: att.uri, name: att.name, type: att.mimeType },
      },
      { onError: markFailed },
    );
  } else {
    messengerSend.text.mutate({ conversationId, content: payload.text }, { onError: markFailed });
  }
  return;
}
```

Then add `messengerSend` to the `send` callback's dependency array (line 221):

```typescript
    [conversationId, phone, leadId, qc, sendMutation, messengerSend],
```

- [ ] **Step 6: Handle messenger in `retry`**

In the `retry` callback, add a messenger branch before the WhatsApp fallback. Replace the block from `if (failed.channel === 'email') {` through the final `send({ channel: 'whatsapp', ... })` (lines 243-256) with:

```typescript
if (failed.channel === 'email') {
  send({ channel: 'email', subject: failed.subject ?? '', text: failed.text });
  return;
}
const media = failed.media;
const attachment = media
  ? {
      uri: media.url ?? '',
      name: media.name ?? 'attachment',
      mimeType: media.mimeType ?? 'application/octet-stream',
      kind: media.kind,
    }
  : undefined;
if (failed.channel === 'messenger') {
  send({ channel: 'messenger', text: failed.text, attachment });
  return;
}
send({ channel: 'whatsapp', text: failed.text, attachment });
```

- [ ] **Step 7: Expose `isMessenger` from the hook**

In the returned object (lines 261-282), add `isMessenger` (after `isSending`):

```typescript
    isSending: sendMutation.isPending || messengerSend.text.isPending || messengerSend.media.isPending,
    isMessenger,
```

(Replace the existing `isSending:` line accordingly.)

- [ ] **Step 8: Verify**

Run: `pnpm exec tsc --noEmit`
Expected: `use-conversation.ts` now error-free. Remaining errors only in `Composer.tsx` and `MediaMessage.tsx`.

- [ ] **Step 9: Commit**

```bash
git add src/features/chat/hooks/use-conversation.ts
git commit -m "feat(chat): route messenger sends through the conversation hook"
```

---

## Task 7: Voice recording helper

**Files:**

- Create: `src/features/chat/media/record-voice.ts`

- [ ] **Step 1: Create the recording helper**

Create `src/features/chat/media/record-voice.ts`:

```typescript
import { AudioModule, setAudioModeAsync } from 'expo-audio';

import type { PickedAsset } from '../models/message';

/**
 * Request microphone permission and configure the audio session for
 * recording. Returns true when recording can proceed.
 */
export async function ensureRecordingPermission(): Promise<boolean> {
  const status = await AudioModule.requestRecordingPermissionsAsync();
  if (!status.granted) return false;
  await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
  return true;
}

/** Release the recording lock on the audio session after a recording ends. */
export async function releaseRecordingMode(): Promise<void> {
  await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
}

/**
 * Build the PickedAsset for a finished voice note. `expo-audio`'s
 * HIGH_QUALITY preset writes a `.m4a` (AAC in an MP4 container) on both iOS
 * and Android — `audio/mp4` is natively accepted by both the WhatsApp and
 * Messenger Meta APIs, so no transcoding is needed.
 */
export function voiceAssetFromUri(uri: string, durationMs: number): PickedAsset {
  return {
    uri,
    name: `voice-note-${durationMs}.m4a`,
    mimeType: 'audio/mp4',
    kind: 'audio',
    durationMs,
  };
}
```

- [ ] **Step 2: Verify**

Run: `pnpm exec tsc --noEmit`
Expected: no new errors in this file (pre-existing Composer/MediaMessage errors remain).

- [ ] **Step 3: Commit**

```bash
git add src/features/chat/media/record-voice.ts
git commit -m "feat(chat): add voice recording helper"
```

---

## Task 8: Attachment bottom sheet

**Files:**

- Create: `src/features/chat/components/AttachmentSheet.tsx`
- Modify: `src/features/chat/media/pick-media.ts` (add camera capture)

- [ ] **Step 1: Add a camera capture function**

Append to `src/features/chat/media/pick-media.ts`:

```typescript
/** Capture a photo or video with the camera. Returns null on cancel/denial. */
export async function capturePhotoOrVideo(): Promise<PickedAsset | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;

  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images', 'videos'],
    quality: 0.8,
  });
  if (res.canceled || res.assets.length === 0) return null;

  const a = res.assets[0];
  const kind: MediaKind = a.type === 'video' ? 'video' : 'image';
  const mimeType = a.mimeType ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg');
  const name = a.fileName ?? nameFromUri(a.uri, kind === 'video' ? 'video.mp4' : 'photo.jpg');
  return { uri: a.uri, name, mimeType, kind };
}
```

- [ ] **Step 2: Create the AttachmentSheet component**

Create `src/features/chat/components/AttachmentSheet.tsx`. It is a controlled modal sheet (uses React Native `Modal`, consistent with a lightweight footprint; no new dependency):

```typescript
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import {
  capturePhotoOrVideo,
  isDocumentPickingAvailable,
  pickDocument,
  pickPhotoOrVideo,
} from '../media/pick-media';
import type { PickedAsset } from '../models/message';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPicked: (asset: PickedAsset) => void;
  /** Hide the Document tile when the native module is unavailable. */
}

interface TileDef {
  key: string;
  icon: IconName;
  label: string;
  color: string;
  run: () => Promise<PickedAsset | null>;
}

function noop(): void {}

export function AttachmentSheet({ visible, onClose, onPicked }: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  const docAvailable = isDocumentPickingAvailable();

  const handle = (run: () => Promise<PickedAsset | null>) => (): void => {
    onClose();
    run()
      .then((asset) => {
        if (asset) onPicked(asset);
      })
      .catch(noop);
  };

  const tiles: TileDef[] = [
    { key: 'photo', icon: 'Image', label: 'Photo', color: '#8b5cf6', run: pickPhotoOrVideo },
    { key: 'video', icon: 'Video', label: 'Video', color: '#ec4899', run: pickPhotoOrVideo },
    { key: 'camera', icon: 'Camera', label: 'Camera', color: '#10b981', run: capturePhotoOrVideo },
  ];
  if (docAvailable) {
    tiles.push({ key: 'doc', icon: 'File', label: 'Document', color: '#f59e0b', run: pickDocument });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose} accessibilityRole="button" />
      <View
        className="absolute bottom-0 w-full rounded-t-3xl bg-card px-4 pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <Text variant="subheading" className="mb-4">
          Attach
        </Text>
        <View className="flex-row flex-wrap gap-4 pb-2">
          {tiles.map((t) => (
            <Pressable
              key={t.key}
              onPress={handle(t.run)}
              accessibilityRole="button"
              accessibilityLabel={t.label}
              className="items-center active:opacity-80"
              style={{ width: 64 }}
            >
              <View
                className="h-14 w-14 items-center justify-center rounded-2xl"
                style={{ backgroundColor: t.color }}
              >
                <Icon name={t.icon} size={24} color="#FFFFFF" />
              </View>
              <Text className="mt-1.5 text-xs text-muted-foreground">{t.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}
```

> If `Icon` does not export `IconName`, import the type from `@/components/atoms/Icon` as it is used elsewhere (e.g. `channel.ts` imports `IconName` from there). Confirm the export exists; it does per `channel.ts`.

- [ ] **Step 3: Verify**

Run: `pnpm exec tsc --noEmit` and `pnpm lint`
Expected: no new errors in `AttachmentSheet.tsx` / `pick-media.ts`. Confirm `Camera`, `Image`, `Video`, `File` are valid Lucide icon keys (they are in `lucide-react-native`); if `pnpm lint`/tsc flags an icon name, swap to a valid one (`Camera`, `ImageIcon`→ use `Image`).

- [ ] **Step 4: Commit**

```bash
git add src/features/chat/components/AttachmentSheet.tsx src/features/chat/media/pick-media.ts
git commit -m "feat(chat): add attachment bottom sheet with camera capture"
```

---

## Task 9: Voice recorder (hold + lock)

**Files:**

- Create: `src/features/chat/components/VoiceRecorder.tsx`

- [ ] **Step 1: Create the VoiceRecorder component**

Create `src/features/chat/components/VoiceRecorder.tsx`. This renders the trailing mic control; while recording it overlays a recording bar with timer + cancel + (when locked) send. Hold-to-record with slide-up lock and slide-left cancel:

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  RecordingPresets,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import {
  ensureRecordingPermission,
  releaseRecordingMode,
  voiceAssetFromUri,
} from '../media/record-voice';
import type { PickedAsset } from '../models/message';

const CANCEL_DX = -90; // slide left past this → cancel
const LOCK_DY = -80; // slide up past this → lock hands-free
const MIN_MS = 800; // discard recordings shorter than this

function fmt(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  onSend: (asset: PickedAsset) => void;
  /** Disabled while the composer itself is disabled. */
  disabled?: boolean;
}

export function VoiceRecorder({ onSend, disabled = false }: Readonly<Props>) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const destructive = useThemeColor('--destructive');
  const mutedColor = useThemeColor('--muted-foreground');
  const primaryFg = useThemeColor('--primary-foreground');

  const [recording, setRecording] = useState(false);
  const [locked, setLocked] = useState(false);
  const cancelledRef = useRef(false);
  const slideX = useSharedValue(0);

  const start = useCallback(async () => {
    const ok = await ensureRecordingPermission();
    if (!ok) return;
    cancelledRef.current = false;
    setLocked(false);
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  }, [recorder]);

  const finish = useCallback(
    async (cancel: boolean) => {
      if (!recording) return;
      const durationMs = state.durationMillis ?? 0;
      await recorder.stop().catch(() => {});
      await releaseRecordingMode();
      const uri = recorder.uri;
      setRecording(false);
      setLocked(false);
      slideX.value = 0;
      if (cancel || uri == null || durationMs < MIN_MS) return;
      onSend(voiceAssetFromUri(uri, durationMs));
    },
    [recording, recorder, state.durationMillis, onSend, slideX],
  );

  // Long-press starts recording; pan tracks slide-to-cancel / slide-to-lock.
  const gesture = Gesture.LongPress()
    .minDuration(180)
    .maxDistance(10_000)
    .onStart(() => {
      runOnJS(start)();
    })
    .onTouchesMove((e) => {
      const t = e.allTouches[0];
      if (!t) return;
      // translationY/X are not on LongPress; approximate via absolute deltas
    })
    .onEnd(() => {
      // If not locked, releasing sends; lock is handled by the explicit buttons.
      runOnJS(finish)(false);
    });

  // Pan handles the slide gestures during an active hold.
  const pan = Gesture.Pan()
    .enabled(recording && !locked)
    .onUpdate((e) => {
      slideX.value = Math.min(0, e.translationX);
      if (e.translationY < LOCK_DY) {
        runOnJS(setLocked)(true);
      }
    })
    .onEnd((e) => {
      if (e.translationX < CANCEL_DX) {
        cancelledRef.current = true;
        runOnJS(finish)(true);
      } else if (!locked) {
        runOnJS(finish)(false);
      }
    });

  const composed = Gesture.Simultaneous(gesture, pan);

  const barStyle = useAnimatedStyle(() => ({ transform: [{ translateX: slideX.value }] }));

  useEffect(() => {
    return () => {
      if (recording) {
        recorder.stop().catch(() => {});
        releaseRecordingMode().catch(() => {});
      }
    };
  }, [recording, recorder]);

  if (recording) {
    return (
      <View className="ml-2 h-11 flex-1 flex-row items-center rounded-full bg-background px-3">
        <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: destructive }} />
        <Text className="ml-2 text-sm tabular-nums text-foreground">
          {fmt(state.durationMillis ?? 0)}
        </Text>
        {locked ? (
          <>
            <Pressable
              onPress={() => finish(true)}
              accessibilityRole="button"
              accessibilityLabel="Cancel recording"
              hitSlop={8}
              className="ml-auto h-8 w-8 items-center justify-center rounded-full active:bg-muted"
            >
              <Icon name="Trash2" size={18} color={destructive} />
            </Pressable>
            <Pressable
              onPress={() => finish(false)}
              accessibilityRole="button"
              accessibilityLabel="Send voice note"
              hitSlop={8}
              className="ml-1 h-9 w-9 items-center justify-center rounded-full bg-primary active:opacity-80"
            >
              <Icon name="Send" size={16} color={primaryFg} />
            </Pressable>
          </>
        ) : (
          <Animated.View className="ml-auto flex-row items-center" style={barStyle}>
            <Icon name="ChevronLeft" size={16} color={mutedColor} />
            <Text className="ml-1 text-xs text-muted-foreground">slide to cancel · up to lock</Text>
          </Animated.View>
        )}
      </View>
    );
  }

  return (
    <GestureDetector gesture={composed}>
      <View
        accessibilityRole="button"
        accessibilityLabel="Hold to record a voice note"
        className="h-11 w-11 items-center justify-center rounded-full"
        style={{ opacity: disabled ? 0.4 : 1 }}
      >
        <Icon name="Mic" size={20} color={mutedColor} />
      </View>
    </GestureDetector>
  );
}
```

> Gesture note: `LongPress` starts recording on hold; the simultaneous `Pan` handles slide-left-cancel and slide-up-lock during the hold. The `onTouchesMove` stub in `LongPress` is intentionally empty — slide tracking lives in `Pan`. If during manual QA the lock/cancel thresholds feel off, tune `CANCEL_DX` / `LOCK_DY`. This keeps the gesture logic on the Pan recognizer which exposes `translationX/Y`.

- [ ] **Step 2: Verify**

Run: `pnpm exec tsc --noEmit` and `pnpm lint`
Expected: no errors in `VoiceRecorder.tsx`. Confirm `Mic`, `Trash2`, `ChevronLeft`, `Send` are valid Lucide keys.

- [ ] **Step 3: Commit**

```bash
git add src/features/chat/components/VoiceRecorder.tsx
git commit -m "feat(chat): add hold-and-lock voice recorder"
```

---

## Task 10: Rebuild the Composer (messenger channel, attachment sheet, mic↔send, voice)

**Files:**

- Modify: `src/features/chat/components/Composer.tsx`

This task is the largest. The composer must: (a) accept a messenger conversation (single channel — hide the WhatsApp/Email toggle, no template/window logic); (b) open the new `AttachmentSheet` from a leading `＋`; (c) show the `VoiceRecorder` mic when there is no text/attachment, swapping to a Send button otherwise.

- [ ] **Step 1: Add an `isMessenger` prop + new imports**

In `src/features/chat/components/Composer.tsx`, update imports (top of file) to add:

```typescript
import { useState } from 'react';
```

(already present) — and add:

```typescript
import { AttachmentSheet } from './AttachmentSheet';
import { VoiceRecorder } from './VoiceRecorder';
```

Add to the `Props` interface (after `onStartTemplate`, line 42):

```typescript
  /**
   * When true the active conversation is a Messenger thread: the WhatsApp/Email
   * "Send via" toggle, the 24h window lock, and template gating are all hidden.
   * Sends emit `{ channel: 'messenger' }` payloads.
   */
  isMessenger?: boolean;
```

- [ ] **Step 2: Extend `makeSendPayload` for messenger + audio**

Replace `makeSendPayload` (lines 331-353):

```typescript
function makeSendPayload(args: {
  channel: 'whatsapp' | 'email' | 'messenger';
  text: string;
  subject: string;
  attachment: PickedAsset | null;
  quote: MessageReplyRef | undefined;
}): SendPayload {
  const { channel, text, subject, attachment, quote } = args;
  if (channel === 'email') {
    return {
      channel: 'email',
      subject: subject.trim(),
      text: text.trim(),
      ...(quote ? { replyTo: quote } : {}),
    };
  }
  if (channel === 'messenger') {
    return {
      channel: 'messenger',
      text: text.trim(),
      ...(attachment ? { attachment } : {}),
      ...(quote ? { replyTo: quote } : {}),
    };
  }
  return {
    channel: 'whatsapp',
    text: text.trim(),
    ...(attachment ? { attachment } : {}),
    ...(quote ? { replyTo: quote } : {}),
  };
}
```

- [ ] **Step 3: Replace the `promptAttachment` Alert with sheet state**

Delete the `promptAttachment` function (lines 178-200). Keep `noop` (it is still used). In the `Composer` body, add sheet visibility state and a voice-send handler. Replace the body of `Composer` (the function starting line 355) — specifically:

Replace the state declarations + derived values block (lines 367-385) with:

```typescript
const [text, setText] = useState('');
const [subject, setSubject] = useState('');
const [attachment, setAttachment] = useState<PickedAsset | null>(null);
const [attachOpen, setAttachOpen] = useState(false);
const mutedColor = useThemeColor('--muted-foreground');
const primaryFg = useThemeColor('--primary-foreground');
const warningColor = useThemeColor('--warning');

const isEmail = channel === 'email';
// Messenger and WhatsApp share the rich (attachment + voice) input row; only
// WhatsApp carries the 24h-window + template gating.
const whatsappLocked = channel === 'whatsapp' && !whatsappWindowOpen;
const showTemplateCta = channel === 'whatsapp' && whatsappNeedsTemplate;
const hasText = text.trim().length > 0;
const hasAttachment = attachment !== null;
const canSend =
  !sendDisabled &&
  !whatsappLocked &&
  (isEmail ? hasText && subject.trim().length > 0 : hasText || hasAttachment);

const placeholder = buildWhatsappPlaceholder(whatsappLocked, hasAttachment);
const openAttachMenu = (): void => setAttachOpen(true);

const sendVoice = (asset: PickedAsset): void => {
  if (sendDisabled || whatsappLocked) return;
  onSend(
    makeSendPayload({
      channel: isEmail ? 'whatsapp' : channel,
      text: '',
      subject,
      attachment: asset,
      quote: replyTo ?? undefined,
    }),
  );
  onCancelReply?.();
};
```

Replace the `handleSend` function (lines 387-402) with:

```typescript
const handleSend = (): void => {
  if (!canSend) return;
  onSend(
    makeSendPayload({
      channel: isEmail ? 'email' : channel,
      text,
      subject,
      attachment,
      quote: replyTo ?? undefined,
    }),
  );
  setText('');
  setSubject('');
  setAttachment(null);
  onCancelReply?.();
};
```

- [ ] **Step 4: Hide the Send-via toggle for messenger; render mic↔send + sheet**

Replace the `SendViaToggle` invocation block + the trailing input/send row. Specifically, replace the JSX from `<SendViaToggle` (line 411) through the closing `</Animated.View>` of the component (line 481) with:

```typescript
      {isMessenger ? null : (
        <SendViaToggle
          channel={channel === 'messenger' ? 'whatsapp' : channel}
          onChannelChange={onChannelChange}
          emailEnabled={emailEnabled}
        />
      )}

      {lockedHint ? (
        <ChannelHint
          icon="Clock"
          color={warningColor}
          message="Customer window closed. Wait for the lead to reply before sending a free message."
        />
      ) : null}

      {showTemplateCta ? (
        <ChannelHint
          icon="MessageCircle"
          color={warningColor}
          message="No WhatsApp messages yet — start the thread with an approved template."
        />
      ) : null}

      {replyTo ? <ReplyPreview reply={replyTo} onCancel={onCancelReply} /> : null}

      {isEmail ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(120)}
          className="px-4 pb-1"
        >
          <Input
            value={subject}
            onChangeText={setSubject}
            placeholder="Subject"
            className="mb-2 bg-background"
          />
        </Animated.View>
      ) : null}

      {hasAttachment && !isEmail ? (
        <AttachmentPreview asset={attachment} onClear={() => setAttachment(null)} />
      ) : null}

      <View className="flex-row items-end px-3 pb-3 pt-1">
        {renderInputArea({
          isEmail,
          text,
          setText,
          subject: undefined,
          attachment,
          whatsappLocked,
          placeholder,
          openAttachMenu,
          mutedColor,
          showTemplateCta,
          onStartTemplate,
          primaryFg,
        })}

        {showTemplateCta ? null : isEmail || hasText || hasAttachment ? (
          <SendButton
            canSend={canSend}
            primaryFg={primaryFg}
            mutedColor={mutedColor}
            onPress={handleSend}
          />
        ) : (
          <VoiceRecorder onSend={sendVoice} disabled={sendDisabled || whatsappLocked} />
        )}
      </View>

      {isEmail ? <EmailToolbar /> : null}

      <AttachmentSheet
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        onPicked={setAttachment}
      />
    </Animated.View>
```

- [ ] **Step 5: Make the WhatsApp input row open the sheet (already wired)**

`WhatsAppRow`'s paperclip already calls `openAttachMenu`, which now opens the sheet. No change needed beyond Step 3. The `＋` affordance is the existing paperclip icon in `WhatsAppRow`; leave it as `Paperclip`.

- [ ] **Step 6: Update the Composer destructuring to accept `isMessenger`**

In the `Composer` function signature destructuring (lines 355-366), add `isMessenger = false,`:

```typescript
export function Composer({
  channel,
  onChannelChange,
  onSend,
  emailEnabled = true,
  sendDisabled = false,
  whatsappWindowOpen = true,
  replyTo = null,
  onCancelReply,
  whatsappNeedsTemplate = false,
  onStartTemplate,
  isMessenger = false,
}: Readonly<Props>) {
```

- [ ] **Step 7: Verify**

Run: `pnpm exec tsc --noEmit` and `pnpm lint`
Expected: `Composer.tsx` error-free. Only `MediaMessage.tsx` (audio kind) may still error.

- [ ] **Step 8: Commit**

```bash
git add src/features/chat/components/Composer.tsx
git commit -m "feat(chat): composer supports messenger, attachment sheet and voice"
```

---

## Task 11: Audio playback bubble

**Files:**

- Create: `src/features/chat/components/AudioMessage.tsx`
- Modify: `src/features/chat/components/MediaMessage.tsx`

- [ ] **Step 1: Create the AudioMessage component**

Create `src/features/chat/components/AudioMessage.tsx`:

```typescript
import { Pressable, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

function fmt(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AudioMessage({ url, tint }: Readonly<{ url: string; tint: string }>) {
  const player = useAudioPlayer({ uri: url });
  const status = useAudioPlayerStatus(player);

  const toggle = (): void => {
    if (status.playing) {
      player.pause();
    } else {
      if (status.didJustFinish || status.currentTime >= status.duration) {
        player.seekTo(0);
      }
      player.play();
    }
  };

  const remaining = status.playing
    ? status.duration - status.currentTime
    : status.duration || 0;

  return (
    <View className="flex-row items-center rounded-xl bg-background/40 p-2.5" style={{ minWidth: 180 }}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause voice note' : 'Play voice note'}
        hitSlop={8}
        className="h-9 w-9 items-center justify-center rounded-full bg-primary active:opacity-80"
      >
        <Icon name={status.playing ? 'Pause' : 'Play'} size={16} color="#FFFFFF" />
      </Pressable>
      <View className="ml-3 flex-1">
        <View className="h-1 w-full rounded-full bg-muted">
          <View
            className="h-1 rounded-full"
            style={{
              backgroundColor: tint,
              width: status.duration > 0 ? `${(status.currentTime / status.duration) * 100}%` : '0%',
            }}
          />
        </View>
        <Text className="mt-1 text-xs text-muted-foreground">{fmt(remaining)}</Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Render audio in MediaMessage**

In `src/features/chat/components/MediaMessage.tsx`, add the import:

```typescript
import { AudioMessage } from './AudioMessage';
```

Replace the loading-fallback height check and the final render branch. Replace lines 50-73 with:

```typescript
  if (!url) {
    return (
      <View
        className="items-center justify-center rounded-xl bg-muted"
        style={{
          width: MEDIA_W,
          height: media.kind === 'document' || media.kind === 'audio' ? 56 : MEDIA_H,
        }}
      >
        <ActivityIndicator color={tint} />
      </View>
    );
  }

  if (media.kind === 'image') {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: MEDIA_W, height: MEDIA_H, borderRadius: 12 }}
        resizeMode="cover"
      />
    );
  }
  if (media.kind === 'video') {
    return <VideoMedia url={url} />;
  }
  if (media.kind === 'audio') {
    return <AudioMessage url={url} tint={tint} />;
  }
  return <DocumentMedia url={url} name={media.name} tint={tint} />;
```

- [ ] **Step 3: Verify**

Run: `pnpm exec tsc --noEmit` and `pnpm lint`
Expected: PASS — the whole project now type-checks. Confirm `Play`, `Pause` are valid Lucide keys.

- [ ] **Step 4: Commit**

```bash
git add src/features/chat/components/AudioMessage.tsx src/features/chat/components/MediaMessage.tsx
git commit -m "feat(chat): play voice notes in the message bubble"
```

---

## Task 12: Pass `isMessenger` from the conversation screen + adapt filter bar

**Files:**

- Modify: `src/features/chat/components/ConversationScreen.tsx`

- [ ] **Step 1: Read `isMessenger` from the hook and pass to the composer**

In `ConversationScreen.tsx`, add `isMessenger` to the `useConversation` destructure (lines 33-50):

```typescript
const {
  contact,
  subtitle,
  messages,
  activeFilter,
  setActiveFilter,
  sendChannel,
  setSendChannel,
  counts,
  send,
  retry,
  isLoading,
  isError,
  refetch,
  emailEnabled,
  leadId,
  phone,
  isMessenger,
} = useConversation(conversationId);
```

- [ ] **Step 2: Force the send channel to messenger for messenger threads**

After the existing `useEffect` that keeps the channel valid (lines 119-121), add:

```typescript
// Messenger threads are single-channel — pin the composer to messenger.
useEffect(() => {
  if (isMessenger && sendChannel !== 'messenger') setSendChannel('messenger');
}, [isMessenger, sendChannel, setSendChannel]);
```

- [ ] **Step 3: Hide the channel filter bar for messenger; pass `isMessenger` to Composer**

Replace the `<ChannelFilterBar .../>` line (line 126) with:

```typescript
      {isMessenger ? null : (
        <ChannelFilterBar active={activeFilter} counts={counts} onChange={setActiveFilter} />
      )}
```

Add `isMessenger={isMessenger}` to the `<Composer .../>` props (after `onStartTemplate`, line 169):

```typescript
whatsappNeedsTemplate = { whatsappNeedsTemplate };
onStartTemplate = { openTemplateSheet };
isMessenger = { isMessenger };
```

- [ ] **Step 4: Suppress template/window gating for messenger**

Replace the `whatsappNeedsTemplate` derivation (line 62):

```typescript
const whatsappNeedsTemplate = !isMessenger && counts.whatsapp === 0 && !!leadId && !!phone;
```

- [ ] **Step 5: Verify**

Run: `pnpm exec tsc --noEmit` and `pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/chat/components/ConversationScreen.tsx
git commit -m "feat(chat): adapt conversation screen for messenger threads"
```

---

## Task 13: Inbox channel filtering

**Files:**

- Modify: `src/features/chat/hooks/use-chat-inbox.ts`
- Modify: `src/features/chat/components/ChatInboxScreen.tsx`
- Modify: `app/(app)/chat/inbox.tsx`

- [ ] **Step 1: Filter the inbox query by channel**

Replace the full contents of `src/features/chat/hooks/use-chat-inbox.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';

import { getConversations } from '../api/services';
import { toChatContact } from '../api/transforms';
import type { ApiConversation } from '../api/types';
import type { ChatContact } from '../models/conversation';
import { chatKeys } from './keys';

/** Whether a conversation row is a Messenger thread. */
function isMessengerRow(c: ApiConversation): boolean {
  return (c.channel ?? '').toLowerCase() === 'messenger';
}

/**
 * Inbox conversations as contact rows, newest first. Pass `channel: 'messenger'`
 * to show only Messenger threads; the default (unified) inbox excludes
 * Messenger so the two entry points stay cleanly separated.
 */
export function useChatInbox(channel?: 'messenger') {
  return useQuery<ApiConversation[], Error, ChatContact[]>({
    queryKey: chatKeys.conversations(),
    queryFn: getConversations,
    select: (rows) =>
      [...rows]
        .filter((c) => (channel === 'messenger' ? isMessengerRow(c) : !isMessengerRow(c)))
        .sort(
          (a, b) =>
            new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime(),
        )
        .map((c) => toChatContact(c)),
  });
}
```

> The `select` filter runs client-side off the single cached `conversations()` query, so both inbox views share one fetch.

- [ ] **Step 2: Accept a channel prop in ChatInboxScreen**

In `src/features/chat/components/ChatInboxScreen.tsx`, change the component signature and the hook call. Replace lines 15-18:

```typescript
export function ChatInboxScreen({ channel }: Readonly<{ channel?: 'messenger' }>) {
  const insets = useSafeAreaInsets();
  const primary = useThemeColor('--primary');
  const { data, isLoading, isError, refetch, isRefetching } = useChatInbox(channel);
```

Replace the subtitle text (lines 35-37) so the messenger inbox reads correctly:

```typescript
        <Text variant="muted" className="mt-0.5">
          {channel === 'messenger' ? 'Messenger conversations' : 'WhatsApp & email in one place'}
        </Text>
```

- [ ] **Step 3: Read the `channel` search param in the route**

Replace the full contents of `app/(app)/chat/inbox.tsx`:

```typescript
import { Redirect, useLocalSearchParams } from 'expo-router';

import { ChatInboxScreen } from '@/features/chat';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';

export default function ChatInboxRoute() {
  const state = useRequirePermission(PERMISSIONS.CHAT_READ);
  const { channel } = useLocalSearchParams<{ channel?: string }>();

  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/" />;

  return <ChatInboxScreen channel={channel === 'messenger' ? 'messenger' : undefined} />;
}
```

- [ ] **Step 4: Export the screen prop type is unaffected** — `src/features/chat/index.ts` already re-exports `ChatInboxScreen`; no change needed.

- [ ] **Step 5: Verify**

Run: `pnpm exec tsc --noEmit` and `pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/chat/hooks/use-chat-inbox.ts src/features/chat/components/ChatInboxScreen.tsx "app/(app)/chat/inbox.tsx"
git commit -m "feat(chat): filter inbox by channel for messenger view"
```

---

## Task 14: Enable the Messenger tile in the selector

**Files:**

- Modify: `src/features/chat/components/ChatChannelSelector.tsx:76-82`

- [ ] **Step 1: Make the Messenger tile live**

Replace the second `ChannelRow` (the Messenger tile, lines 76-82):

```typescript
        <ChannelRow
          icon="MessageCircle"
          title="Messenger"
          subtitle="Chat via Messenger"
          onPress={() => router.push('/chat/inbox?channel=messenger')}
        />
```

- [ ] **Step 2: Verify**

Run: `pnpm exec tsc --noEmit` and `pnpm lint`
Expected: PASS. (Typed routes: if the typed-route check rejects the query string, use the object form `router.push({ pathname: '/chat/inbox', params: { channel: 'messenger' } })`.)

- [ ] **Step 3: Commit**

```bash
git add src/features/chat/components/ChatChannelSelector.tsx
git commit -m "feat(chat): enable messenger entry in channel selector"
```

---

## Task 15: Full verification + manual QA

**Files:** none (verification only)

- [ ] **Step 1: Full type-check + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: both PASS with zero errors.

- [ ] **Step 2: Confirm env + native modules**

- `boh-mobile/.env`: `ENABLE_MESSENGER=true` (already set). Confirm `EXPO_PUBLIC_API_BASE_URL` points at the backend that has `ENABLE_MESSENGER=true`.
- Voice recording, camera, and document picking are native modules. A JS-only reload is insufficient — run a native build: `pnpm ios` (or `pnpm android`) / an EAS dev build. The microphone permission string must be present; for Expo managed config add to `app.json`/`app.config`: iOS `NSMicrophoneUsageDescription` and `expo-audio` plugin if not already configured. Verify before QA.

- [ ] **Step 3: Manual QA checklist (on device/simulator)**

Messenger inbound (requires a real customer-initiated Messenger thread to the configured Page):

- [ ] Selector → "Messenger" opens an inbox listing only Messenger threads.
- [ ] Open a Messenger thread: inbound text renders; inbound image/video/audio/document render and play/open.
- [ ] Filter bar is hidden; "Send via" toggle is hidden.

Messenger outbound:

- [ ] Send a text reply → optimistic bubble → confirmed via socket.
- [ ] `＋` opens the attachment sheet; send a Photo, a Video, a Document, a Camera capture.
- [ ] Hold mic → records; release sends a voice note; recipient receives audio. Slide-left cancels; slide-up locks then ✕/➤ work.
- [ ] React to a Messenger message (long-press) — reaction shows locally (no Meta round-trip expected).
- [ ] Reply/quote a Messenger message — quote strip shows; reply sends as text.
- [ ] Kill network mid-send → bubble shows failed + retry works.

WhatsApp regression + voice:

- [ ] WhatsApp text/photo/video/document still send.
- [ ] WhatsApp voice note records + sends + plays back.
- [ ] WhatsApp 24h-window lock + template CTA still behave as before.
- [ ] Unified inbox ("WhatsApp & Email") no longer lists Messenger threads.

Email regression:

- [ ] Email subject/body send still works; email has no mic/attachment-sheet regressions.

- [ ] **Step 4: Final commit (if any QA fixes were made)**

```bash
git add -A
git commit -m "fix(chat): messenger QA adjustments"
```

---

## Self-Review Notes

- **Spec coverage:** inbound display (Tasks 3, 11, 12), outbound text (Task 6), media photo/video/document (Tasks 8, 10), reactions (existing `useSetReaction` works for any channel — no task needed, verified in QA), reply (existing quote UI — sends as text per spec; QA item), voice across Messenger + WhatsApp (Tasks 7, 9, 10, 11), selector + inbox routing (Tasks 13, 14). Backend: zero changes (per spec).
- **Reactions/reply have no dedicated code task** because the backend + existing mobile `useSetReaction`/reply-swipe already operate channel-agnostically; they are covered by QA verification. This is intentional, not a gap.
- **Type consistency:** `isMessenger` (hook → screen → composer), `SendMessengerInput`/`SendMessengerMediaInput` (types → services → hook), `MediaKind 'audio'` (model → transforms → MediaMessage/AudioMessage), `voiceAssetFromUri` (helper → VoiceRecorder → Composer) all match.
- **No test runner:** verification is tsc + lint + manual QA per `boh-mobile` convention.
