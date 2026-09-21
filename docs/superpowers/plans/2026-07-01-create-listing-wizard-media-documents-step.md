# Create-Listing Wizard — Media & Documents Step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the wizard's Media & Documents step (step 3) — hero media gallery, About images, video/360 links, and (secondary) supporting documents — persisted at web parity, with post-save resync.

**Architecture:** Lift a shared `WizardContent` object into `CreateListingWizard` so the hero upsert carries the Description step's title/description (no clobber). New gallery/single-image/document field components feed a `use-save-media` mutation that upserts hero + about (multipart) and uploads documents, then re-seeds the gallery from a content GET (idempotent re-save).

**Tech Stack:** React Native 0.81 / Expo SDK 54, NativeWind v4, TanStack Query, axios (`apiClient`), expo-image-picker, expo-document-picker.

## Global Constraints

- **No test runner.** Verify every task with `pnpm exec tsc --noEmit` + `pnpm lint`. No unit tests. Manual QA at the end.
- Strict TypeScript; prop types use `Readonly<{...}>`.
- Prettier: single quotes, semicolons, trailing commas, 100-col, 2-space; `prettier-plugin-tailwindcss` sorts classes.
- Semantic Tailwind tokens only (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-brand`, `bg-muted`) — no hardcoded hex.
- API paths prefixed `/api/v1`. `apiClient` unwraps `{ success, data }` (returns inner `data`).
- **Multipart uploads:** append RN file objects `{ uri, name, type } as unknown as Blob` to `FormData`; override the request header with `{ 'Content-Type': undefined }` (NOT `'multipart/form-data'`) so RN sets the boundary — this is the proven pattern in `src/features/chat/api/services.ts`. Primary CMS calls ALSO send `'X-Use-FormData': 'true'`.
- Commit with the exact `git add` paths per task. Never `git add -A`/`.` — unrelated uncommitted files exist (`.gitignore`, `src/components/atoms/DatePicker.tsx`) and must stay out.
- Icons are Lucide keys via the `Icon` atom; if tsc rejects a key as not assignable to `IconName`, swap to a valid Lucide key and report it.
- Spec: [`docs/superpowers/specs/2026-07-01-create-listing-wizard-media-documents-step-design.md`](../specs/2026-07-01-create-listing-wizard-media-documents-step-design.md).

---

### Task 1: Media types + pickers

**Files:**

- Create: `src/features/listing-wizard/media/types.ts`
- Create: `src/features/listing-wizard/media/pickers.ts`

**Interfaces:**

- Produces:
  - `interface WizardMediaItem { id?: string; uri?: string; url?: string; name: string; mimeType: string; type: 'image' | 'video'; altText: string; isHero: boolean; order: number }`
  - `interface WizardDocItem { uri: string; name: string; mimeType: string }`
  - `pickMediaMulti(): Promise<WizardMediaItem[]>` — library images+videos, multi-select; returns items with `altText: ''`, `isHero: false`, `order: 0` (caller re-indexes).
  - `pickSingleImage(): Promise<WizardMediaItem | null>` — one image.
  - `pickDocumentsMulti(): Promise<WizardDocItem[]>` — multi documents (defensive: `[]` when the native module is unavailable).

- [ ] **Step 1: Types**

Create `src/features/listing-wizard/media/types.ts`:

```ts
/** A media item in the wizard gallery. Newly-picked: has `uri`, no `id`. Re-seeded after a
 *  save (resync): has `id` + `url`, no `uri`. Exactly one item is the hero (order 0). */
export interface WizardMediaItem {
  id?: string;
  uri?: string;
  url?: string;
  name: string;
  mimeType: string;
  type: 'image' | 'video';
  altText: string;
  isHero: boolean;
  order: number;
}

/** A supporting document picked for upload (secondary branch). */
export interface WizardDocItem {
  uri: string;
  name: string;
  mimeType: string;
}
```

- [ ] **Step 2: Pickers**

Create `src/features/listing-wizard/media/pickers.ts`:

```ts
import * as ImagePicker from 'expo-image-picker';

import type { WizardDocItem, WizardMediaItem } from './types';

/** expo-document-picker is loaded lazily/defensively — a missing native module (pre-rebuild)
 *  never crashes the screen; document picking is simply unavailable until the app is rebuilt. */
type DocumentPickerModule = typeof import('expo-document-picker');
let cachedDocPicker: DocumentPickerModule | null | undefined;

function getDocumentPicker(): DocumentPickerModule | null {
  if (cachedDocPicker !== undefined) return cachedDocPicker;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedDocPicker = require('expo-document-picker') as DocumentPickerModule;
  } catch {
    cachedDocPicker = null;
  }
  return cachedDocPicker;
}

export function isDocumentPickingAvailable(): boolean {
  return getDocumentPicker() !== null;
}

function nameFromUri(uri: string, fallback: string): string {
  const last = uri.split('/').pop();
  return last && last.trim() !== '' ? last : fallback;
}

/** Pick multiple images/videos from the library. Returns [] on cancel/denial. */
export async function pickMediaMulti(): Promise<WizardMediaItem[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return [];
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    quality: 0.8,
  });
  if (res.canceled || res.assets.length === 0) return [];
  return res.assets.map((a) => {
    const type: WizardMediaItem['type'] = a.type === 'video' ? 'video' : 'image';
    const mimeType = a.mimeType ?? (type === 'video' ? 'video/mp4' : 'image/jpeg');
    return {
      uri: a.uri,
      name: a.fileName ?? nameFromUri(a.uri, type === 'video' ? 'video.mp4' : 'photo.jpg'),
      mimeType,
      type,
      altText: '',
      isHero: false,
      order: 0,
    };
  });
}

/** Pick a single image from the library. Returns null on cancel/denial. */
export async function pickSingleImage(): Promise<WizardMediaItem | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  if (res.canceled || res.assets.length === 0) return null;
  const a = res.assets[0]!;
  const mimeType = a.mimeType ?? 'image/jpeg';
  return {
    uri: a.uri,
    name: a.fileName ?? nameFromUri(a.uri, 'photo.jpg'),
    mimeType,
    type: 'image',
    altText: '',
    isHero: false,
    order: 0,
  };
}

/** Pick multiple documents. Returns [] on cancel or when the native module is unavailable. */
export async function pickDocumentsMulti(): Promise<WizardDocItem[]> {
  const mod = getDocumentPicker();
  if (!mod) return [];
  const res = await mod.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
    type: [
      'image/*',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  });
  if (res.canceled || res.assets.length === 0) return [];
  return res.assets.map((a) => ({
    uri: a.uri,
    name: a.name ?? nameFromUri(a.uri, 'document'),
    mimeType: a.mimeType ?? 'application/octet-stream',
  }));
}
```

- [ ] **Step 3: Verify** — `pnpm exec tsc --noEmit` (no errors), `pnpm lint` (no new errors).
- [ ] **Step 4: Commit**

```bash
git add src/features/listing-wizard/media/types.ts src/features/listing-wizard/media/pickers.ts
git commit -m "feat(listing-wizard): add media types + pickers for Media step"
```

---

### Task 2: Media services + align step-2 hero headers

**Files:**

- Modify: `src/features/listing-wizard/services.ts` (append media services; fix two existing hero headers)

**Interfaces:**

- Consumes: `WizardMediaItem`, `WizardDocItem` from `./media/types`.
- Produces:
  - `interface HeroMediaFields { title: string; description: string; videoLink: string; view360Link: string; media: WizardMediaItem[] }`
  - `interface AboutImageFields { image1: WizardMediaItem | null; image2: WizardMediaItem | null }`
  - `upsertOpportunityListingHeroMedia(listingId: string, fields: HeroMediaFields): Promise<void>`
  - `upsertOpportunityListingAbout(listingId: string, fields: AboutImageFields): Promise<void>`
  - `upsertPrimaryListingHeroMedia(listingId: string, fields: HeroMediaFields): Promise<void>`
  - `upsertPrimaryListingAbout(listingId: string, fields: AboutImageFields): Promise<void>`
  - `uploadOpportunityDocument(opportunityId: string, args: { file: WizardDocItem; documentType: string; notes?: string }): Promise<void>`
  - `interface ListingMedia { hero: WizardMediaItem[]; about1: WizardMediaItem | null; about2: WizardMediaItem | null }`
  - `getOpportunityListingMedia(listingId: string): Promise<ListingMedia>`
  - `getPrimaryListingMedia(listingId: string): Promise<ListingMedia>`

- [ ] **Step 1: Fix the step-2 hero header idiom**

In `src/features/listing-wizard/services.ts`, the two functions from the Description step
(`upsertOpportunityListingHero`, `upsertPrimaryListingHero`) currently set
`'Content-Type': 'multipart/form-data'`. Change BOTH header objects so `Content-Type` is
`undefined` (RN then sets the boundary), keeping `X-Use-FormData` on the primary one:

```ts
// upsertOpportunityListingHero:
await apiClient.post(`/api/v1/opportunity-listing/${listingId}/hero`, fd, {
  headers: { 'Content-Type': undefined },
});

// upsertPrimaryListingHero:
await apiClient.post(`/api/v1/listing-cms/${listingId}?section=hero`, fd, {
  headers: { 'Content-Type': undefined, 'X-Use-FormData': 'true' },
});
```

- [ ] **Step 2: Append the media services**

Append to `src/features/listing-wizard/services.ts`:

```ts
import type { WizardDocItem, WizardMediaItem } from './media/types';

// ---------------------------------------------------------------------------
// Media & Documents (Step 3) — hero media, about images, owner documents.
// Files are RN objects appended to FormData; Content-Type undefined lets RN set the boundary.
// ---------------------------------------------------------------------------

export interface HeroMediaFields {
  title: string;
  description: string;
  videoLink: string;
  view360Link: string;
  media: WizardMediaItem[];
}

export interface AboutImageFields {
  image1: WizardMediaItem | null;
  image2: WizardMediaItem | null;
}

export interface ListingMedia {
  hero: WizardMediaItem[];
  about1: WizardMediaItem | null;
  about2: WizardMediaItem | null;
}

/** File part for RN multipart. Cast matches the repo's chat upload pattern. */
function filePart(item: { uri: string; name: string; mimeType: string }): Blob {
  return { uri: item.uri, name: item.name, type: item.mimeType } as unknown as Blob;
}

/** Hero item first, then remaining by `order`. Used to place the hero at sortOrder 0. */
function sortHeroFirst(media: WizardMediaItem[]): WizardMediaItem[] {
  return [...media].sort((a, b) => {
    if (a.isHero !== b.isHero) return a.isHero ? -1 : 1;
    return a.order - b.order;
  });
}

interface ServerMediaItem {
  id: string;
  mediaType?: string | null;
  mediaUrl: string;
  altText?: string | null;
  sortOrder?: number | null;
  isHero?: boolean | null;
}

function mapServerMedia(m: ServerMediaItem, index: number): WizardMediaItem {
  const order = typeof m.sortOrder === 'number' ? m.sortOrder : index;
  return {
    id: m.id,
    url: m.mediaUrl,
    name: '',
    mimeType: '',
    type: m.mediaType === 'video' ? 'video' : 'image',
    altText: m.altText ?? '',
    isHero: m.isHero ?? order === 0,
    order,
  };
}

// --- Secondary (opportunity-listing) --------------------------------------

export async function upsertOpportunityListingHeroMedia(
  listingId: string,
  fields: HeroMediaFields,
): Promise<void> {
  const fd = new FormData();
  fd.append('title', fields.title);
  fd.append('subtitle', '');
  fd.append('description', fields.description);
  fd.append('videoLink', fields.videoLink);
  fd.append('view360Link', fields.view360Link);
  const sorted = sortHeroFirst(fields.media);
  const existing = sorted
    .filter((m) => m.id !== undefined)
    .map((m, i) => ({ id: m.id, altText: m.altText, sortOrder: i }));
  fd.append('existingMedia', JSON.stringify(existing));
  const newAlts: string[] = [];
  for (const m of sorted) {
    if (m.id === undefined && m.uri !== undefined) {
      fd.append('files', filePart({ uri: m.uri, name: m.name, mimeType: m.mimeType }));
      newAlts.push(m.altText);
    }
  }
  fd.append('newMediaAltTexts', JSON.stringify(newAlts));
  await apiClient.post(`/api/v1/opportunity-listing/${listingId}/hero`, fd, {
    headers: { 'Content-Type': undefined },
  });
}

export async function upsertOpportunityListingAbout(
  listingId: string,
  fields: AboutImageFields,
): Promise<void> {
  const fd = new FormData();
  fd.append('title', '');
  fd.append('subtitle', '');
  fd.append('textSection1', '');
  fd.append('textSection2', '');
  fd.append('additionalDescription', '');
  applyAboutSlot(fd, 'image1', 'image1AltText', 'removeImage1', fields.image1);
  applyAboutSlot(fd, 'image2', 'image2AltText', 'removeImage2', fields.image2);
  await apiClient.post(`/api/v1/opportunity-listing/${listingId}/about`, fd, {
    headers: { 'Content-Type': undefined },
  });
}

function applyAboutSlot(
  fd: FormData,
  fileField: string,
  altField: string,
  removeField: string,
  item: WizardMediaItem | null,
): void {
  if (item === null) {
    fd.append(removeField, 'true');
    return;
  }
  if (item.uri !== undefined) {
    fd.append(fileField, filePart({ uri: item.uri, name: item.name, mimeType: item.mimeType }));
  }
  fd.append(altField, item.altText);
}

export async function uploadOpportunityDocument(
  opportunityId: string,
  args: { file: WizardDocItem; documentType: string; notes?: string },
): Promise<void> {
  const fd = new FormData();
  fd.append('file', filePart(args.file));
  fd.append('documentType', args.documentType);
  if (args.notes !== undefined && args.notes !== '') fd.append('notes', args.notes);
  await apiClient.post(`/api/v1/opportunities/${opportunityId}/documents`, fd, {
    headers: { 'Content-Type': undefined },
  });
}

interface OpportunityListingMediaResponse {
  media?: {
    hero?: ServerMediaItem[];
    'about-image-1'?: ServerMediaItem[];
    'about-image-2'?: ServerMediaItem[];
  };
}

export async function getOpportunityListingMedia(listingId: string): Promise<ListingMedia> {
  const { data } = await apiClient.get<OpportunityListingMediaResponse>(
    `/api/v1/opportunity-listing/${listingId}`,
  );
  const hero = (data.media?.hero ?? []).map(mapServerMedia);
  const about1 = (data.media?.['about-image-1'] ?? []).map(mapServerMedia)[0] ?? null;
  const about2 = (data.media?.['about-image-2'] ?? []).map(mapServerMedia)[0] ?? null;
  return { hero, about1, about2 };
}

// --- Primary (listing-cms) ------------------------------------------------

export async function upsertPrimaryListingHeroMedia(
  listingId: string,
  fields: HeroMediaFields,
): Promise<void> {
  const fd = new FormData();
  fd.append('mainTitle', fields.title);
  fd.append('subTitle', '');
  fd.append('description', fields.description);
  fd.append('videoLink', fields.videoLink);
  fd.append('view360Link', fields.view360Link);
  const sorted = sortHeroFirst(fields.media);
  const existing = sorted
    .filter((m) => m.id !== undefined)
    .map((m, i) => ({ id: m.id, altText: m.altText, sortOrder: i }));
  fd.append('existingMedia', JSON.stringify(existing));
  sorted.forEach((m, index) => {
    fd.append(`heroMediaAltText_${String(index)}`, m.altText);
    if (m.id === undefined && m.uri !== undefined) {
      fd.append(
        `media_${String(index)}`,
        filePart({ uri: m.uri, name: m.name, mimeType: m.mimeType }),
      );
    }
  });
  const heroIndex = sorted.findIndex((m) => m.isHero);
  if (heroIndex >= 0) fd.append('heroIndex', String(heroIndex));
  await apiClient.post(`/api/v1/listing-cms/${listingId}?section=hero`, fd, {
    headers: { 'Content-Type': undefined, 'X-Use-FormData': 'true' },
  });
}

export async function upsertPrimaryListingAbout(
  listingId: string,
  fields: AboutImageFields,
): Promise<void> {
  const fd = new FormData();
  fd.append('mainTitle', '');
  fd.append('textSection1', '');
  fd.append('textSection2', '');
  fd.append('additionalDescription', '');
  [fields.image1, fields.image2].forEach((item, index) => {
    if (item === null) {
      fd.append(`removeAboutSlot_${String(index)}`, 'true');
      return;
    }
    fd.append(`aboutMediaAltText_${String(index)}`, item.altText);
    if (item.uri !== undefined) {
      fd.append(
        `media_${String(index)}`,
        filePart({ uri: item.uri, name: item.name, mimeType: item.mimeType }),
      );
    }
  });
  await apiClient.post(`/api/v1/listing-cms/${listingId}?section=about`, fd, {
    headers: { 'Content-Type': undefined, 'X-Use-FormData': 'true' },
  });
}

interface PrimaryCmsMediaResponse {
  sections?: {
    hero?: { media?: ServerMediaItem[] };
    about?: { media?: ServerMediaItem[] };
  };
}

export async function getPrimaryListingMedia(listingId: string): Promise<ListingMedia> {
  const { data } = await apiClient.get<PrimaryCmsMediaResponse>(`/api/v1/listing-cms/${listingId}`);
  const hero = (data.sections?.hero?.media ?? []).map(mapServerMedia);
  const aboutMedia = (data.sections?.about?.media ?? []).map(mapServerMedia);
  return { hero, about1: aboutMedia[0] ?? null, about2: aboutMedia[1] ?? null };
}
```

> Note on hero after resync: on the FIRST save all items are new, so the hero is sent first and
> the server assigns it sortOrder 0 (correct). After a resync, kept items carry `existingMedia`
> sortOrder; if the user then adds a brand-new item and marks it hero, secondary can't force it to
> sortOrder 0 (web parity limitation — new files append after existing). Primary uses `heroIndex`
> so it is exact. This edge is acceptable for this increment (documented; QA note below).

- [ ] **Step 3: Verify** — `pnpm exec tsc --noEmit`, `pnpm lint`. (tsc confirms the step-2 header change still compiles.)
- [ ] **Step 4: Commit**

```bash
git add src/features/listing-wizard/services.ts
git commit -m "feat(listing-wizard): add media/about/document services + align hero header idiom"
```

---

### Task 3: `MediaGallery` component

**Files:**

- Create: `src/features/listing-wizard/components/MediaGallery.tsx`

**Interfaces:**

- Consumes: `WizardMediaItem` (`../media/types`); `pickMediaMulti` (`../media/pickers`); `Icon`, `Text`, `Input` atoms.
- Produces: `MediaGallery({ items, onChange }: Readonly<{ items: WizardMediaItem[]; onChange: (items: WizardMediaItem[]) => void }>)`.

- [ ] **Step 1: Component**

Create `src/features/listing-wizard/components/MediaGallery.tsx`:

```tsx
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';

import { pickMediaMulti } from '../media/pickers';
import type { WizardMediaItem } from '../media/types';

/** Re-index order sequentially and ensure exactly one hero (the first, unless one is flagged). */
function normalize(items: WizardMediaItem[]): WizardMediaItem[] {
  const heroIdx = items.findIndex((m) => m.isHero);
  const heroPos = heroIdx >= 0 ? heroIdx : 0;
  return items.map((m, i) => ({ ...m, order: i, isHero: i === heroPos }));
}

export function MediaGallery({
  items,
  onChange,
}: Readonly<{ items: WizardMediaItem[]; onChange: (items: WizardMediaItem[]) => void }>) {
  const brand = useThemeColor('--brand');
  const mutedFg = useThemeColor('--muted-foreground');
  const [busy, setBusy] = useState(false);

  const previewUri = (m: WizardMediaItem): string | undefined => m.uri ?? m.url;

  const add = async () => {
    setBusy(true);
    try {
      const picked = await pickMediaMulti();
      if (picked.length > 0) onChange(normalize([...items, ...picked]));
    } finally {
      setBusy(false);
    }
  };

  const update = (index: number, patch: Partial<WizardMediaItem>) => {
    onChange(normalize(items.map((m, i) => (i === index ? { ...m, ...patch } : m))));
  };

  const remove = (index: number) => {
    onChange(normalize(items.filter((_, i) => i !== index)));
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    onChange(normalize(next));
  };

  const setHero = (index: number) => {
    onChange(normalize(items.map((m, i) => ({ ...m, isHero: i === index }))));
  };

  return (
    <View className="gap-3">
      {items.map((m, index) => (
        <View
          key={m.id ?? m.uri ?? String(index)}
          className="rounded-xl border border-border bg-background p-3"
        >
          <View className="flex-row gap-3">
            <View className="h-20 w-20 overflow-hidden rounded-lg bg-muted">
              {previewUri(m) !== undefined ? (
                <Image source={{ uri: previewUri(m) }} style={{ width: '100%', height: '100%' }} />
              ) : null}
              {m.type === 'video' ? (
                <View className="absolute inset-0 items-center justify-center">
                  <Icon name="Play" size={20} color="white" />
                </View>
              ) : null}
            </View>
            <View className="flex-1 gap-2">
              <View className="flex-row items-center gap-2">
                <Pressable
                  onPress={() => setHero(index)}
                  accessibilityRole="button"
                  accessibilityLabel={m.isHero ? 'Hero image' : 'Set as hero image'}
                  className={cn(
                    'flex-row items-center gap-1 rounded-full px-2 py-1',
                    m.isHero ? 'bg-brand/10' : 'bg-muted',
                  )}
                >
                  <Icon name="Star" size={12} color={m.isHero ? brand : mutedFg} />
                  <Text
                    className={cn(
                      'text-[10px] font-semibold',
                      m.isHero ? 'text-brand' : 'text-muted-foreground',
                    )}
                  >
                    {m.isHero ? 'Hero' : 'Set hero'}
                  </Text>
                </Pressable>
                <View className="flex-1" />
                <Pressable
                  onPress={() => move(index, -1)}
                  disabled={index === 0}
                  accessibilityRole="button"
                  accessibilityLabel="Move up"
                  className="h-8 w-8 items-center justify-center rounded-full bg-muted"
                >
                  <Icon name="ArrowUp" size={14} color={index === 0 ? mutedFg : brand} />
                </Pressable>
                <Pressable
                  onPress={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  accessibilityRole="button"
                  accessibilityLabel="Move down"
                  className="h-8 w-8 items-center justify-center rounded-full bg-muted"
                >
                  <Icon
                    name="ArrowDown"
                    size={14}
                    color={index === items.length - 1 ? mutedFg : brand}
                  />
                </Pressable>
                <Pressable
                  onPress={() => remove(index)}
                  accessibilityRole="button"
                  accessibilityLabel="Remove media"
                  className="h-8 w-8 items-center justify-center rounded-full bg-muted"
                >
                  <Icon name="X" size={14} color={mutedFg} />
                </Pressable>
              </View>
              <Input
                value={m.altText}
                onChangeText={(t) => update(index, { altText: t })}
                placeholder="Alt text"
              />
            </View>
          </View>
        </View>
      ))}

      <Pressable
        onPress={add}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Add images or videos"
        className="flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background py-4 active:opacity-80"
      >
        <Icon name="Plus" size={18} color={brand} />
        <Text className="text-sm font-medium text-foreground">
          {busy ? 'Opening library…' : 'Add images / videos'}
        </Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Verify** — `pnpm exec tsc --noEmit` (if `Play`/`Star`/`ArrowUp`/`ArrowDown` reject as `IconName`, swap to a valid Lucide key and report), `pnpm lint`.
- [ ] **Step 3: Commit**

```bash
git add src/features/listing-wizard/components/MediaGallery.tsx
git commit -m "feat(listing-wizard): add MediaGallery editor (multi image/video, alt, hero, reorder)"
```

---

### Task 4: `SingleImageField` + `DocumentPickerField`

**Files:**

- Create: `src/features/listing-wizard/components/SingleImageField.tsx`
- Create: `src/features/listing-wizard/components/DocumentPickerField.tsx`

**Interfaces:**

- Consumes: `WizardMediaItem`, `WizardDocItem`, `pickSingleImage`, `pickDocumentsMulti`, `isDocumentPickingAvailable`, atoms.
- Produces:
  - `SingleImageField({ label, value, onChange }: Readonly<{ label: string; value: WizardMediaItem | null; onChange: (v: WizardMediaItem | null) => void }>)`
  - `DocumentPickerField({ items, onChange }: Readonly<{ items: WizardDocItem[]; onChange: (items: WizardDocItem[]) => void }>)`

- [ ] **Step 1: SingleImageField**

Create `src/features/listing-wizard/components/SingleImageField.tsx`:

```tsx
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { Label } from '@/components/atoms/Label';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { pickSingleImage } from '../media/pickers';
import type { WizardMediaItem } from '../media/types';

export function SingleImageField({
  label,
  value,
  onChange,
}: Readonly<{
  label: string;
  value: WizardMediaItem | null;
  onChange: (v: WizardMediaItem | null) => void;
}>) {
  const brand = useThemeColor('--brand');
  const mutedFg = useThemeColor('--muted-foreground');
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    setBusy(true);
    try {
      const picked = await pickSingleImage();
      if (picked !== null) onChange(picked);
    } finally {
      setBusy(false);
    }
  };

  const previewUri = value?.uri ?? value?.url;

  return (
    <View className="gap-1.5">
      <Label>{label}</Label>
      {value !== null ? (
        <View className="rounded-xl border border-border bg-background p-3">
          <View className="flex-row gap-3">
            <View className="h-20 w-20 overflow-hidden rounded-lg bg-muted">
              {previewUri !== undefined ? (
                <Image source={{ uri: previewUri }} style={{ width: '100%', height: '100%' }} />
              ) : null}
            </View>
            <View className="flex-1 gap-2">
              <View className="flex-row justify-end">
                <Pressable
                  onPress={() => onChange(null)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${label}`}
                  className="h-8 w-8 items-center justify-center rounded-full bg-muted"
                >
                  <Icon name="X" size={14} color={mutedFg} />
                </Pressable>
              </View>
              <Input
                value={value.altText}
                onChangeText={(t) => onChange({ ...value, altText: t })}
                placeholder="Alt text"
              />
            </View>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={pick}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Add ${label}`}
          className="flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background py-6 active:opacity-80"
        >
          <Icon name="Plus" size={18} color={brand} />
          <Text className="text-sm font-medium text-foreground">
            {busy ? 'Opening library…' : 'Add image'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
```

- [ ] **Step 2: DocumentPickerField**

Create `src/features/listing-wizard/components/DocumentPickerField.tsx`:

```tsx
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { isDocumentPickingAvailable, pickDocumentsMulti } from '../media/pickers';
import type { WizardDocItem } from '../media/types';

export function DocumentPickerField({
  items,
  onChange,
}: Readonly<{ items: WizardDocItem[]; onChange: (items: WizardDocItem[]) => void }>) {
  const brand = useThemeColor('--brand');
  const mutedFg = useThemeColor('--muted-foreground');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!isDocumentPickingAvailable()) {
      Alert.alert('Unavailable', 'Document picking needs a native rebuild of the app.');
      return;
    }
    setBusy(true);
    try {
      const picked = await pickDocumentsMulti();
      if (picked.length > 0) onChange([...items, ...picked]);
    } finally {
      setBusy(false);
    }
  };

  const remove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <View className="gap-2">
      {items.map((doc, index) => (
        <View
          key={`${doc.uri}-${String(index)}`}
          className="flex-row items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5"
        >
          <Icon name="FileText" size={16} color={mutedFg} />
          <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
            {doc.name}
          </Text>
          <Pressable
            onPress={() => remove(index)}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${doc.name}`}
            className="h-8 w-8 items-center justify-center rounded-full bg-muted"
          >
            <Icon name="X" size={14} color={mutedFg} />
          </Pressable>
        </View>
      ))}
      <Pressable
        onPress={add}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Add documents"
        className="flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background py-4 active:opacity-80"
      >
        <Icon name="Plus" size={18} color={brand} />
        <Text className="text-sm font-medium text-foreground">
          {busy ? 'Opening…' : 'Add documents'}
        </Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 3: Verify** — `pnpm exec tsc --noEmit`, `pnpm lint`. Confirm `Input`, `Label` atom import paths resolve (`@/components/atoms/Input`, `@/components/atoms/Label`); if a path differs, correct it and report.
- [ ] **Step 4: Commit**

```bash
git add src/features/listing-wizard/components/SingleImageField.tsx src/features/listing-wizard/components/DocumentPickerField.tsx
git commit -m "feat(listing-wizard): add SingleImageField + DocumentPickerField"
```

---

### Task 5: `use-save-media` hook

**Files:**

- Create: `src/features/listing-wizard/hooks/use-save-media.ts`

**Interfaces:**

- Consumes: services from `../services` (Task 2); `WizardMediaItem`, `WizardDocItem` (`../media/types`); `WizardCreated` (`./use-save-content`).
- Produces:
  - `interface WizardContentInput { title: string; description: string; heroMedia: WizardMediaItem[]; aboutImage1: WizardMediaItem | null; aboutImage2: WizardMediaItem | null; videoLink: string; view360Link: string }`
  - `interface SaveMediaArgs { created: WizardCreated; content: WizardContentInput; documents: WizardDocItem[]; notes: string }`
  - `interface SaveMediaResult { heroMedia: WizardMediaItem[]; aboutImage1: WizardMediaItem | null; aboutImage2: WizardMediaItem | null }`
  - `useSaveMedia(): UseMutationResult<SaveMediaResult, Error, SaveMediaArgs>`

- [ ] **Step 1: Hook**

Create `src/features/listing-wizard/hooks/use-save-media.ts`:

```ts
import { useMutation } from '@tanstack/react-query';

import type { WizardDocItem, WizardMediaItem } from '../media/types';
import {
  getOpportunityListingMedia,
  getPrimaryListingMedia,
  upsertOpportunityListingAbout,
  upsertOpportunityListingHeroMedia,
  upsertOpportunityListingDocuments,
  upsertPrimaryListingAbout,
  upsertPrimaryListingHeroMedia,
} from '../services';
import type { WizardCreated } from './use-save-content';

export interface WizardContentInput {
  title: string;
  description: string;
  heroMedia: WizardMediaItem[];
  aboutImage1: WizardMediaItem | null;
  aboutImage2: WizardMediaItem | null;
  videoLink: string;
  view360Link: string;
}

export interface SaveMediaArgs {
  created: WizardCreated;
  content: WizardContentInput;
  documents: WizardDocItem[];
  notes: string;
}

export interface SaveMediaResult {
  heroMedia: WizardMediaItem[];
  aboutImage1: WizardMediaItem | null;
  aboutImage2: WizardMediaItem | null;
}

/**
 * Persists the Media step: upserts hero (with title/description carried from the Description
 * step) + about images, uploads supporting documents (secondary), then re-seeds media from a
 * content GET so a re-save sends kept items via existingMedia (idempotent, no duplicates).
 */
export function useSaveMedia() {
  return useMutation<SaveMediaResult, Error, SaveMediaArgs>({
    mutationFn: async ({ created, content, documents, notes }) => {
      if (created.listingId === undefined) {
        throw new Error('Save the earlier steps first.');
      }
      const heroFields = {
        title: content.title,
        description: content.description,
        videoLink: content.videoLink,
        view360Link: content.view360Link,
        media: content.heroMedia,
      };
      const aboutFields = { image1: content.aboutImage1, image2: content.aboutImage2 };

      if (created.branch === 'primary') {
        await upsertPrimaryListingHeroMedia(created.listingId, heroFields);
        await upsertPrimaryListingAbout(created.listingId, aboutFields);
        const media = await getPrimaryListingMedia(created.listingId);
        return { heroMedia: media.hero, aboutImage1: media.about1, aboutImage2: media.about2 };
      }

      // secondary
      await upsertOpportunityListingHeroMedia(created.listingId, heroFields);
      await upsertOpportunityListingAbout(created.listingId, aboutFields);
      if (created.opportunityId !== undefined) {
        for (const doc of documents.filter((d) => d.uri !== '')) {
          await upsertOpportunityListingDocuments(created.opportunityId, doc, notes);
        }
      }
      const media = await getOpportunityListingMedia(created.listingId);
      return { heroMedia: media.hero, aboutImage1: media.about1, aboutImage2: media.about2 };
    },
  });
}
```

- [ ] **Step 2: Add the document helper to `services.ts`**

Task 2 exposed `uploadOpportunityDocument`. Add a thin wrapper used above (so the hook stays
declarative). Append to `src/features/listing-wizard/services.ts`:

```ts
/** Upload one supporting document as GENERAL_DOCUMENT (secondary Media step). */
export async function upsertOpportunityListingDocuments(
  opportunityId: string,
  file: WizardDocItem,
  notes: string,
): Promise<void> {
  await uploadOpportunityDocument(opportunityId, {
    file,
    documentType: 'GENERAL_DOCUMENT',
    notes: notes === '' ? undefined : notes,
  });
}
```

- [ ] **Step 3: Verify** — `pnpm exec tsc --noEmit`, `pnpm lint`.
- [ ] **Step 4: Commit**

```bash
git add src/features/listing-wizard/hooks/use-save-media.ts src/features/listing-wizard/services.ts
git commit -m "feat(listing-wizard): add use-save-media hook (hero+about+docs, resync)"
```

---

### Task 6: `MediaStep` orchestrator

**Files:**

- Create: `src/features/listing-wizard/components/steps/MediaStep.tsx`

**Interfaces:**

- Consumes: `WizardContentInput` (`../../hooks/use-save-media`), `WizardDocItem`, `WizardMediaItem`, `MediaGallery`, `SingleImageField`, `DocumentPickerField`, `WizardCard`, `Input`, `Label`, `Textarea` atoms.
- Produces:
  - `interface MediaStepProps { content: WizardContentInput; onContentChange: <K extends keyof WizardContentInput>(key: K, value: WizardContentInput[K]) => void; showDocuments: boolean; documents: WizardDocItem[]; onDocumentsChange: (items: WizardDocItem[]) => void; notes: string; onNotesChange: (notes: string) => void }`
  - `MediaStep(props: Readonly<MediaStepProps>)`

- [ ] **Step 1: Component**

Create `src/features/listing-wizard/components/steps/MediaStep.tsx`:

```tsx
import { ScrollView, View } from 'react-native';

import { Input } from '@/components/atoms/Input';
import { Label } from '@/components/atoms/Label';
import { Textarea } from '@/components/atoms/Textarea';

import type { WizardContentInput } from '../../hooks/use-save-media';
import type { WizardDocItem } from '../../media/types';
import { DocumentPickerField } from '../DocumentPickerField';
import { MediaGallery } from '../MediaGallery';
import { SingleImageField } from '../SingleImageField';
import { WizardCard } from '../WizardCard';

export interface MediaStepProps {
  content: WizardContentInput;
  onContentChange: <K extends keyof WizardContentInput>(
    key: K,
    value: WizardContentInput[K],
  ) => void;
  showDocuments: boolean;
  documents: WizardDocItem[];
  onDocumentsChange: (items: WizardDocItem[]) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
}

export function MediaStep({
  content,
  onContentChange,
  showDocuments,
  documents,
  onDocumentsChange,
  notes,
  onNotesChange,
}: Readonly<MediaStepProps>) {
  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-4">
        <WizardCard
          icon="Images"
          title="Images"
          description="Hero images and videos shown at the top of the listing."
        >
          <MediaGallery
            items={content.heroMedia}
            onChange={(items) => onContentChange('heroMedia', items)}
          />
        </WizardCard>

        <WizardCard
          icon="Image"
          title="About Images"
          description="The two images shown in the About this Property section."
        >
          <SingleImageField
            label="Image 1"
            value={content.aboutImage1}
            onChange={(v) => onContentChange('aboutImage1', v)}
          />
          <SingleImageField
            label="Image 2"
            value={content.aboutImage2}
            onChange={(v) => onContentChange('aboutImage2', v)}
          />
        </WizardCard>

        <WizardCard
          icon="Video"
          title="Video & Virtual Tour"
          description="Optional links to a walkthrough video and a 360° tour."
        >
          <View className="gap-1.5">
            <Label>Video Link</Label>
            <Input
              value={content.videoLink}
              onChangeText={(t) => onContentChange('videoLink', t)}
              placeholder="Please enter link for video"
              autoCapitalize="none"
            />
          </View>
          <View className="gap-1.5">
            <Label>View 360</Label>
            <Input
              value={content.view360Link}
              onChangeText={(t) => onContentChange('view360Link', t)}
              placeholder="Please enter link for view 360"
              autoCapitalize="none"
            />
          </View>
        </WizardCard>

        {showDocuments ? (
          <WizardCard
            icon="FileText"
            title="Documents"
            description="Upload any supporting documents (title deed, evidence, contracts, etc.) — all optional."
          >
            <DocumentPickerField items={documents} onChange={onDocumentsChange} />
            <View className="gap-1.5">
              <Label>Notes / Remarks</Label>
              <Textarea
                value={notes}
                onChangeText={onNotesChange}
                placeholder="Enter any additional notes here..."
                numberOfLines={2}
              />
            </View>
          </WizardCard>
        ) : null}
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Verify** — `pnpm exec tsc --noEmit` (confirm `Textarea` accepts `onChangeText`/`numberOfLines` — it does, per the shared `FormTextarea`; if the atom's prop differs, adjust and report), `pnpm lint`. If `Images`/`Image`/`Video` reject as `IconName`, swap to a valid Lucide key and report.
- [ ] **Step 3: Commit**

```bash
git add src/features/listing-wizard/components/steps/MediaStep.tsx
git commit -m "feat(listing-wizard): add MediaStep orchestrator (images/about/video/docs)"
```

---

### Task 7: Wire step 3 into `CreateListingWizard`

**Files:**

- Modify: `src/features/listing-wizard/components/CreateListingWizard.tsx` (full rewrite)

**Interfaces:**

- Consumes: everything above + existing `useInformationForm`, `useDescriptionForm`, `useCreateListing`, `useSaveContent`+`WizardCreated`, `branchFor`, `InformationStep`, `DescriptionStep`, `MediaStep`, `WizardFooter`, `WizardStepper`, `WizardContentInput`, `WizardDocItem`.
- Produces: `CreateListingWizard()` (default export unchanged).

- [ ] **Step 1: Rewrite the wizard**

Replace the whole file `src/features/listing-wizard/components/CreateListingWizard.tsx`:

```tsx
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BackButton } from '@/components/atoms/BackButton';
import { Text } from '@/components/atoms/Text';
import { showToast } from '@/lib/toast/toast.store';
import { useDescriptionForm } from '../forms/description.form';
import { useInformationForm } from '../forms/information.form';
import { useCreateListing } from '../hooks/use-create-listing';
import { useSaveContent, type WizardCreated } from '../hooks/use-save-content';
import { useSaveMedia, type WizardContentInput } from '../hooks/use-save-media';
import type { WizardDocItem } from '../media/types';
import { branchFor } from '../types';
import { DescriptionStep } from './steps/DescriptionStep';
import { InformationStep } from './steps/InformationStep';
import { MediaStep } from './steps/MediaStep';
import { WizardFooter } from './WizardFooter';
import { WizardStepper } from './WizardStepper';

type SubmitMode = 'draft' | 'continue';

const EMPTY_CONTENT: WizardContentInput = {
  title: '',
  description: '',
  heroMedia: [],
  aboutImage1: null,
  aboutImage2: null,
  videoLink: '',
  view360Link: '',
};

export function CreateListingWizard() {
  const insets = useSafeAreaInsets();
  const createListing = useCreateListing();
  const saveContent = useSaveContent();
  const saveMedia = useSaveMedia();

  const [stepIndex, setStepIndex] = useState(0);
  const [created, setCreated] = useState<WizardCreated | null>(null);
  // Shared content across Description + Media so the hero upsert keeps title/description.
  const [content, setContent] = useState<WizardContentInput>(EMPTY_CONTENT);
  const [documents, setDocuments] = useState<WizardDocItem[]>([]);
  const [notes, setNotes] = useState('');

  const modeRef = useRef<SubmitMode>('continue');
  const [pendingMode, setPendingMode] = useState<SubmitMode | null>(null);

  const updateContent = <K extends keyof WizardContentInput>(
    key: K,
    value: WizardContentInput[K],
  ) => {
    setContent((prev) => ({ ...prev, [key]: value }));
  };

  const informationForm = useInformationForm(async (values) => {
    try {
      const result = await createListing.mutateAsync(values);
      const branch = branchFor(values.completionStatus);
      if (branch === null) {
        throw new Error('Select a completion status before saving.');
      }
      const next: WizardCreated =
        result.kind === 'listing'
          ? { branch, listingId: result.id }
          : { branch, opportunityId: result.id };
      setCreated(next);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Could not save the listing.');
      throw error;
    }
    if (modeRef.current === 'draft') {
      showToast('success', 'Saved as draft');
      router.back();
      return;
    }
    showToast('success', 'Listing created');
    setStepIndex(1);
  });

  const descriptionForm = useDescriptionForm(async (values) => {
    if (created === null) {
      showToast('error', 'Complete the information step first.');
      throw new Error('missing created ids');
    }
    try {
      const listingId = await saveContent.mutateAsync({ created, values });
      setCreated({ ...created, listingId });
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Could not save the content.');
      throw error;
    }
    // Stash title/description into shared content so the Media hero upsert carries them.
    setContent((prev) => ({ ...prev, title: values.title, description: values.description }));
    showToast('success', 'Listing content saved');
    setStepIndex(2);
  });

  const submitInformation = (mode: SubmitMode) => {
    modeRef.current = mode;
    setPendingMode(mode);
    informationForm
      .handleSubmit()
      .catch(() => {})
      .finally(() => setPendingMode(null));
  };

  const submitDescription = () => {
    setPendingMode('continue');
    descriptionForm
      .handleSubmit()
      .catch(() => {})
      .finally(() => setPendingMode(null));
  };

  const submitMedia = () => {
    if (created === null) {
      showToast('error', 'Complete the earlier steps first.');
      return;
    }
    setPendingMode('continue');
    saveMedia
      .mutateAsync({ created, content, documents, notes })
      .then((result) => {
        // Re-seed media from server truth so a re-save doesn't duplicate uploads.
        setContent((prev) => ({
          ...prev,
          heroMedia: result.heroMedia,
          aboutImage1: result.aboutImage1,
          aboutImage2: result.aboutImage2,
        }));
        setDocuments([]);
        showToast(
          'success',
          created.branch === 'secondary' ? 'Media & documents saved' : 'Media saved',
        );
      })
      .catch((error: unknown) => {
        showToast('error', error instanceof Error ? error.message : 'Could not save media.');
      })
      .finally(() => setPendingMode(null));
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3 px-4 pb-2 pt-2">
        <BackButton />
        <Text className="text-xl font-bold text-foreground">Create Listing</Text>
      </View>
      <WizardStepper activeIndex={stepIndex} />
      <View className="flex-1">
        {stepIndex === 0 ? <InformationStep form={informationForm} /> : null}
        {stepIndex === 1 ? <DescriptionStep form={descriptionForm} /> : null}
        {stepIndex === 2 ? (
          <MediaStep
            content={content}
            onContentChange={updateContent}
            showDocuments={created?.branch === 'secondary'}
            documents={documents}
            onDocumentsChange={setDocuments}
            notes={notes}
            onNotesChange={setNotes}
          />
        ) : null}
      </View>
      {stepIndex === 0 ? (
        <WizardFooter
          onCancel={() => router.back()}
          onSaveDraft={() => submitInformation('draft')}
          onCreate={() => submitInformation('continue')}
          submittingMode={pendingMode}
        />
      ) : null}
      {stepIndex === 1 ? (
        <WizardFooter
          onCancel={() => router.back()}
          onSaveDraft={() => {}}
          onCreate={submitDescription}
          submittingMode={pendingMode}
          primaryLabel="Save & Continue"
          onBack={() => setStepIndex(0)}
          showSaveDraft={false}
        />
      ) : null}
      {stepIndex === 2 ? (
        <WizardFooter
          onCancel={() => router.back()}
          onSaveDraft={() => {}}
          onCreate={submitMedia}
          submittingMode={pendingMode}
          primaryLabel="Save Media"
          onBack={() => setStepIndex(1)}
          showSaveDraft={false}
        />
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2: Verify** — `pnpm exec tsc --noEmit` (integration gate — all prior tasks' types must line up), `pnpm lint` (sonarjs cognitive-complexity cap 20; if the component trips it, extract the three `submit*` handlers or the footer block into small helpers and report — do not diverge from behavior).
- [ ] **Step 3: Commit**

```bash
git add src/features/listing-wizard/components/CreateListingWizard.tsx
git commit -m "feat(listing-wizard): wire Media step (step 3) + shared content state"
```

---

### Task 8: Manual QA

No automated tests (project rule). Run on device/simulator.

- [ ] **Step 1: Launch** — `pnpm ios` (or `pnpm android`); sign in with listing-create permission; open Create Listing.
- [ ] **Step 2: Secondary flow**
  1. Step 1: secondary completion status + required fields → **Create & Continue**.
  2. Step 2: Title + Description → **Save & Continue** → lands on **Media** (stepper shows step 3).
  3. Images: add several photos + a video; set a hero (Star), reorder (up/down), edit alt, remove one.
  4. About Images: add Image 1 + Image 2, set alt.
  5. Video & 360: enter both links.
  6. Documents: add 1–2 files, enter notes.
  7. **Save Media** → toast "Media & documents saved"; gallery re-seeds with server thumbnails.
  8. In Network Logger (`/(app)/network-logs`) confirm: `POST /opportunity-listing/:id/hero` (multipart, 200), `POST .../:id/about` (200), `POST /opportunities/:oppId/documents` per file (201), then `GET /opportunity-listing/:id` (resync).
  9. **Save Media** again → hero POST sends `existingMedia` with ids (no duplicate media); documents not re-uploaded (list cleared).
- [ ] **Step 3: Primary flow**
  1. Primary completion status → create → Description → Media.
  2. Documents card is **hidden** (primary has no owner).
  3. Add hero media + about images + links → **Save Media** → `POST /listing-cms/:id?section=hero` (X-Use-FormData) + `?section=about`, then `GET /listing-cms/:id`. Hero = the item marked Star (verify `heroIndex`).
- [ ] **Step 4: Multipart sanity** — if any upload returns 400/415 or the server sees empty fields/files, confirm the request has a `multipart/form-data; boundary=…` Content-Type in Network Logger. The services intentionally set `Content-Type: undefined` so RN adds the boundary (chat pattern). If a device still forces JSON, that is the contingency to fix.
- [ ] **Step 5: Back nav** — from Media, tap **Back** → Description retains Title/Description; return to Media → picked media still present (shared state).

---

## Self-Review

**Spec coverage:**

- Shared `WizardContent` (hero-clobber fix) → Task 7 (`content` state + Description stash). ✓
- Data model `WizardMediaItem`/`WizardDocItem` → Task 1. ✓
- Pickers (multi image+video, single image, multi document, defensive) → Task 1. ✓
- Secondary hero/about/document services + primary hero/about services + resync GETs → Task 2. ✓
- Header idiom fix for step-2 hero services → Task 2 Step 1. ✓
- Hero gallery (multi, alt, hero-pick, remove, reorder up/down, video badge) → Task 3. ✓
- About single-image ×2 + alt; document multi-file → Task 4. ✓
- `use-save-media` (branch save + document upload + resync) → Task 5. ✓
- `MediaStep` 4 sections, documents secondary-only, verbatim copy → Task 6. ✓
- Nav: Description advances to Media; Media footer Back + Save Media + save/resync/stay → Task 7. ✓
- Idempotency via resync → Tasks 2 (GETs) + 5 (call) + 7 (state re-seed). ✓
- Out of scope (Identity, Portals, resume, extra doc slots, drag reorder) → not implemented. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step has full code. ✓

**Type consistency:** `WizardMediaItem`/`WizardDocItem` (Task 1) used by Tasks 2–7. `HeroMediaFields`/`AboutImageFields`/`ListingMedia` (Task 2) used by Task 5. `WizardContentInput`/`SaveMediaArgs`/`SaveMediaResult` (Task 5) used by Tasks 6–7. `upsertOpportunityListingDocuments` defined in Task 5 Step 2, called in Task 5 hook. `WizardCreated` (from `use-save-content`) reused. Service names match between Task 2 definitions and Task 5 imports (`upsertOpportunityListingHeroMedia`, `upsertOpportunityListingAbout`, `upsertPrimaryListingHeroMedia`, `upsertPrimaryListingAbout`, `getOpportunityListingMedia`, `getPrimaryListingMedia`, `uploadOpportunityDocument`). ✓

**Known limitation (documented):** After a resync, a newly-added item marked hero on the secondary branch can't be forced to sortOrder 0 (web-parity limit; primary uses `heroIndex`). Flagged in Task 2 note + acceptable for this increment.
