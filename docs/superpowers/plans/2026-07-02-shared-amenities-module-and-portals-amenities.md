# Shared Amenities Module + Portals Amenities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create one shared amenity-mapping module, migrate every consumer to it, and build the create-listing wizard's Portals step Amenities selector (master fetch + selectable grid) with save.

**Architecture:** New `src/lib/amenities/` exposes image/icon/label/media/sort/filter resolvers (the current `amenityDefaultImages` logic + a new slug→Lucide-icon map + de-duplicated helpers). Consumers switch to it. The Portals step (index 3) fetches the master amenities catalog and lets the user select `selectedAmenityIds`, saved per branch.

**Tech Stack:** React Native 0.81 / Expo SDK 54, NativeWind, TanStack Query, axios (`apiClient`), lucide-react-native via the `Icon` atom.

## Global Constraints

- **No test runner.** Verify every task with `pnpm exec tsc --noEmit` + `pnpm lint`. No unit tests. Manual QA at the end.
- Migration tasks must be **behaviour-preserving** — the same icons/images/labels resolve; verified by tsc + lint + spot QA (no visual change to detail/compare screens).
- Strict TypeScript; `Readonly<{...}>` prop types. Prettier: single quotes, semicolons, trailing commas, 100-col, 2-space; `prettier-plugin-tailwindcss` sorts classes.
- Semantic Tailwind tokens only — no hardcoded hex.
- API paths prefixed `/api/v1`. `apiClient` unwraps `{ success, data }`. Multipart POSTs use header `{ 'Content-Type': undefined }`; primary CMS calls also `'X-Use-FormData': 'true'`.
- Icons are Lucide keys via the `Icon` atom; if tsc rejects a key as not assignable to `IconName`, swap to a valid Lucide key and report.
- A parallel "listings compare" effort commits to the same branch under `src/features/listings/*` and `src/features/projects/*compare*`. Commit with the exact `git add` paths per task; never `git add -A`/`.`. The compare-zone migration (Task 11) must re-sync those files immediately before editing.
- Spec: [`docs/superpowers/specs/2026-07-02-shared-amenities-module-and-portals-amenities-design.md`](../specs/2026-07-02-shared-amenities-module-and-portals-amenities-design.md).

---

### Task 1: Shared amenities module (`src/lib/amenities/`)

**Files:**

- Create: `src/lib/amenities/images.ts` (moved from `src/features/projects/constants/amenityDefaultImages.ts`)
- Create: `src/lib/amenities/icons.ts`
- Create: `src/lib/amenities/helpers.ts`
- Create: `src/lib/amenities/index.ts`
- Delete: `src/features/projects/constants/amenityDefaultImages.ts`

**Interfaces produced:**

- `resolveAmenityImages(input: { label?: string; icon?: string | null; slug?: string | null }): readonly ImageSourcePropType[]`
- `resolveAmenityIcon(input: { icon?: string | null; slug?: string | null; label?: string }): IconName`
- `resolveAmenityLabel(input: { customTitle?: string | null; name?: string | null; fallback?: string }): string`
- `sortAmenities<T extends { sortOrder?: number | null }>(items: readonly T[]): T[]`
- `filterVisibleAmenities<T extends { isVisible?: boolean | null }>(items: readonly T[]): T[]`
- `normalizeAmenityMedia(raw: readonly unknown[]): { id: string; mediaUrl: string; mediaType: 'image' | 'video'; altText: string | null; sortOrder: number }[]`
- `slugifyAmenity(value: string): string`, `resolveAmenityPrefix(input): string | null` (internal, exported for icons.ts reuse)
- barrel `index.ts` + `type CanonicalAmenity`.

- [ ] **Step 1: Move the images resolver**

Read `src/features/projects/constants/amenityDefaultImages.ts`. Move its ENTIRE content into `src/lib/amenities/images.ts` UNCHANGED except:

- Fix the `require('../../../../assets/images/amenities/…')` paths to the new depth from `src/lib/amenities/` → `require('../../../assets/images/amenities/…')` (verify the resolved path exists).
- Export the public function as BOTH `resolveAmenityImages` and keep the old name as an alias: rename the existing `getDefaultAmenitySliderImages` to `resolveAmenityImages`, and add `export const getDefaultAmenitySliderImages = resolveAmenityImages;` (temporary alias so any missed importer still compiles).
- Export the internal `slugify` as `slugifyAmenity` and the alias-lookup resolver as `resolveAmenityPrefix(input): string | null` (returns the canonical prefix key or null) so `icons.ts` can reuse the exact same alias table. Do NOT alter `AMENITY_IMAGES_BY_PREFIX` or `AMENITY_LOOKUP_TO_PREFIX` entries (all 12 prefixes / 33 aliases must survive).

- [ ] **Step 2: Icon resolver**

Create `src/lib/amenities/icons.ts`:

```ts
import type { IconName } from '@/components/atoms/Icon';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const lucideIcons = require('lucide-react-native/icons') as Record<string, unknown>;

import { resolveAmenityPrefix, slugifyAmenity } from './images';

/** Canonical amenity image-prefix → Lucide icon key. Keys mirror AMENITY_IMAGES_BY_PREFIX. */
const PREFIX_TO_ICON: Record<string, IconName> = {
  'electricity-backup': 'Zap',
  'gym-and-health': 'Dumbbell',
  'swimming-pool': 'Waves',
  'cleaning-services': 'Sparkles',
  'broadband-internet': 'Wifi',
  'maintenance-staff': 'Wrench',
  'security-staff': 'ShieldCheck',
  'cctv-security': 'Cctv',
  'laundry-facility': 'WashingMachine',
  'satellite-or-cable-tv': 'Tv',
  'pets-allowed': 'Dog',
  floors: 'Building2',
};

const FALLBACK_AMENITY_ICON: IconName = 'Check';

function isLucideIconName(value: string): value is IconName {
  return value !== '' && value in lucideIcons;
}

/**
 * Resolve an amenity to a Lucide IconName:
 * 1) a raw `icon` that is already a valid Lucide key passes through (current listings behaviour);
 * 2) else the slug/icon/label is aliased to a canonical prefix → mapped icon;
 * 3) else `Check`.
 */
export function resolveAmenityIcon(input: {
  icon?: string | null;
  slug?: string | null;
  label?: string;
}): IconName {
  const raw = input.icon ?? '';
  if (isLucideIconName(raw)) return raw;
  const prefix = resolveAmenityPrefix({
    slug: input.slug ?? undefined,
    icon: input.icon ?? undefined,
    label: input.label,
  });
  if (prefix !== null && prefix in PREFIX_TO_ICON) return PREFIX_TO_ICON[prefix];
  // Last chance: slugified label/icon that happens to be a Lucide key.
  const slugged = slugifyAmenity(input.slug ?? input.icon ?? input.label ?? '');
  return isLucideIconName(slugged) ? (slugged as IconName) : FALLBACK_AMENITY_ICON;
}
```

Note: `resolveAmenityPrefix` in Step 1 must accept `{ slug?, icon?, label? }` and return the canonical prefix (the same value `resolvePrefix` computes internally) or `null`. If the existing internal function differs in signature, adapt it to this shape while keeping the lookup table identical.

- [ ] **Step 3: Helpers**

Create `src/lib/amenities/helpers.ts`:

```ts
/** Amenity display-name precedence: custom title → catalog name → fallback. */
export function resolveAmenityLabel(input: {
  customTitle?: string | null;
  name?: string | null;
  fallback?: string;
}): string {
  const custom = input.customTitle?.trim();
  if (custom) return custom;
  const name = input.name?.trim();
  if (name) return name;
  return input.fallback ?? 'Amenity';
}

/** Stable sort by `sortOrder ?? 0` (ascending). */
export function sortAmenities<T extends { sortOrder?: number | null }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/** Keep only amenities not explicitly hidden (`isVisible !== false`). */
export function filterVisibleAmenities<T extends { isVisible?: boolean | null }>(
  items: readonly T[],
): T[] {
  return items.filter((a) => a.isVisible !== false);
}

export interface CanonicalAmenityMedia {
  id: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  altText: string | null;
  sortOrder: number;
}

/** Normalize a raw media array to http(s) items only, mapping video vs image. */
export function normalizeAmenityMedia(raw: readonly unknown[]): CanonicalAmenityMedia[] {
  const out: CanonicalAmenityMedia[] = [];
  raw.forEach((item, index) => {
    const m = (item ?? {}) as Record<string, unknown>;
    const url =
      typeof m.mediaUrl === 'string' ? m.mediaUrl : typeof m.url === 'string' ? m.url : '';
    if (!/^https?:\/\//.test(url)) return;
    const type = m.mediaType === 'video' || m.type === 'video' ? 'video' : 'image';
    out.push({
      id: typeof m.id === 'string' ? m.id : `amenity-media-${String(index)}`,
      mediaUrl: url,
      mediaType: type,
      altText: typeof m.altText === 'string' ? m.altText : null,
      sortOrder: typeof m.sortOrder === 'number' ? m.sortOrder : index,
    });
  });
  return out;
}
```

- [ ] **Step 4: Barrel**

Create `src/lib/amenities/index.ts`:

```ts
export * from './images';
export * from './icons';
export * from './helpers';

/** Minimal common amenity shape the resolvers operate on. */
export interface CanonicalAmenity {
  id: string;
  name: string;
  slug?: string;
  icon?: string | null;
  description?: string;
  isVisible?: boolean;
  sortOrder?: number;
}
```

- [ ] **Step 5: Repoint the sole current importer of `amenityDefaultImages`**

`src/features/new-projects/components/detail/AmenitiesSection.tsx` imports `getDefaultAmenitySliderImages` from `@/features/projects/constants/amenityDefaultImages`. Change that import to `import { resolveAmenityImages } from '@/lib/amenities'` and update the call in `defaultImagesFor` to `resolveAmenityImages({ label: a.name, icon: a.icon ?? '', slug: a.slug })`. (Deeper migration of this file's icon happens in Task 7; this step only keeps it compiling after the delete.)

- [ ] **Step 6: Delete the old file** — `git rm src/features/projects/constants/amenityDefaultImages.ts` (Step 5 removed its last importer).
- [ ] **Step 7: Verify** — `pnpm exec tsc --noEmit` (swap any rejected Lucide icon key + report), `pnpm lint`.
- [ ] **Step 8: Commit**

```bash
git add src/lib/amenities src/features/new-projects/components/detail/AmenitiesSection.tsx
git commit -m "feat(amenities): add shared amenity-mapping module (images/icons/helpers)"
```

(The `git rm` from Step 6 is already staged; if not, `git add -u src/features/projects/constants/amenityDefaultImages.ts`.)

---

### Task 2: Portals amenity services

**Files:**

- Modify: `src/features/listing-wizard/services.ts` (append)

**Interfaces produced:**

- `interface MasterAmenity { id: string; name: string; description: string; slug: string; icon: string | null; iconUrl: string | null; isPfAmenity: boolean }`
- `getMasterAmenities(): Promise<MasterAmenity[]>`
- `upsertOpportunityListingAmenities(listingId: string, selectedAmenityIds: string[]): Promise<void>`
- `upsertPrimaryListingAmenities(listingId: string, selectedAmenityIds: string[]): Promise<void>`

- [ ] **Step 1: Append services**

Append to `src/features/listing-wizard/services.ts`:

```ts
// ---------------------------------------------------------------------------
// Amenities (Portals step) — master catalog + per-branch selection save.
// ---------------------------------------------------------------------------

export interface MasterAmenity {
  id: string;
  name: string;
  description: string;
  slug: string;
  icon: string | null;
  iconUrl: string | null;
  isPfAmenity: boolean;
}

function mapMasterAmenity(raw: unknown): MasterAmenity {
  const a = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(a.id ?? ''),
    name: typeof a.name === 'string' ? a.name : '',
    description: typeof a.description === 'string' ? a.description : '',
    slug: typeof a.slug === 'string' ? a.slug : '',
    icon: typeof a.icon === 'string' ? a.icon : null,
    iconUrl: typeof a.iconUrl === 'string' ? a.iconUrl : null,
    isPfAmenity: a.isPfAmenity === true,
  };
}

/** Master amenities catalog (for the Portals selector). */
export async function getMasterAmenities(): Promise<MasterAmenity[]> {
  const { data } = await apiClient.get<unknown[]>('/api/v1/project-public-page/amenities');
  return (Array.isArray(data) ? data : []).map(mapMasterAmenity);
}

/** Secondary branch — set the opportunity-listing's selected amenities. */
export async function upsertOpportunityListingAmenities(
  listingId: string,
  selectedAmenityIds: string[],
): Promise<void> {
  await apiClient.patch(`/api/v1/opportunity-listing/${listingId}/amenities`, {
    selectedAmenityIds,
  });
}

/** Primary branch — set the listing-cms amenities section (multipart). */
export async function upsertPrimaryListingAmenities(
  listingId: string,
  selectedAmenityIds: string[],
): Promise<void> {
  const fd = new FormData();
  fd.append(
    'amenities',
    JSON.stringify(selectedAmenityIds.map((amenityId, index) => ({ amenityId, sortOrder: index }))),
  );
  await apiClient.post(`/api/v1/listing-cms/${listingId}?section=amenities`, fd, {
    headers: { 'Content-Type': undefined, 'X-Use-FormData': 'true' },
  });
}
```

- [ ] **Step 2: Verify** — `pnpm exec tsc --noEmit`, `pnpm lint`.
- [ ] **Step 3: Commit**

```bash
git add src/features/listing-wizard/services.ts
git commit -m "feat(listing-wizard): add master amenities + amenities-save services"
```

---

### Task 3: Amenities hooks

**Files:**

- Create: `src/features/listing-wizard/hooks/use-master-amenities.ts`
- Create: `src/features/listing-wizard/hooks/use-save-amenities.ts`

**Interfaces produced:**

- `useMasterAmenities(): UseQueryResult<MasterAmenity[]>`
- `useSaveAmenities(): UseMutationResult<void, Error, { created: WizardCreated; selectedAmenityIds: string[] }>`

- [ ] **Step 1: Master query hook**

Create `src/features/listing-wizard/hooks/use-master-amenities.ts`:

```ts
import { useQuery } from '@tanstack/react-query';

import { getMasterAmenities } from '../services';

export function useMasterAmenities() {
  return useQuery({
    queryKey: ['master-amenities'],
    queryFn: getMasterAmenities,
    staleTime: 300_000,
  });
}
```

- [ ] **Step 2: Save hook**

Create `src/features/listing-wizard/hooks/use-save-amenities.ts`:

```ts
import { useMutation } from '@tanstack/react-query';

import { upsertOpportunityListingAmenities, upsertPrimaryListingAmenities } from '../services';
import type { WizardCreated } from './use-save-content';

export interface SaveAmenitiesArgs {
  created: WizardCreated;
  selectedAmenityIds: string[];
}

export function useSaveAmenities() {
  return useMutation<void, Error, SaveAmenitiesArgs>({
    mutationFn: async ({ created, selectedAmenityIds }) => {
      if (created.listingId === undefined) {
        throw new Error('Save the earlier steps first.');
      }
      if (created.branch === 'primary') {
        await upsertPrimaryListingAmenities(created.listingId, selectedAmenityIds);
        return;
      }
      await upsertOpportunityListingAmenities(created.listingId, selectedAmenityIds);
    },
  });
}
```

- [ ] **Step 3: Verify** — `pnpm exec tsc --noEmit`, `pnpm lint`.
- [ ] **Step 4: Commit**

```bash
git add src/features/listing-wizard/hooks/use-master-amenities.ts src/features/listing-wizard/hooks/use-save-amenities.ts
git commit -m "feat(listing-wizard): add master-amenities + save-amenities hooks"
```

---

### Task 4: `AmenitiesSelector` component

**Files:**

- Create: `src/features/listing-wizard/components/AmenitiesSelector.tsx`

**Interfaces:**

- Consumes: `MasterAmenity` (`../services`); `resolveAmenityIcon` (`@/lib/amenities`); atoms `Checkbox`, `Icon`(+`IconName`), `Input`, `Text`; `cn`; `useThemeColor`; RN `Image`, `Pressable`, `View`.
- Produces: `AmenitiesSelector({ options, selectedIds, onChange }: Readonly<{ options: MasterAmenity[]; selectedIds: string[]; onChange: (ids: string[]) => void }>)`.

- [ ] **Step 1: Write the component**

Create `src/features/listing-wizard/components/AmenitiesSelector.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { Checkbox } from '@/components/atoms/Checkbox';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { resolveAmenityIcon } from '@/lib/amenities';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';

import type { MasterAmenity } from '../services';

export function AmenitiesSelector({
  options,
  selectedIds,
  onChange,
}: Readonly<{
  options: MasterAmenity[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}>) {
  const brand = useThemeColor('--brand');
  const mutedFg = useThemeColor('--muted-foreground');
  const [search, setSearch] = useState('');

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q === '') return options;
    return options.filter((a) => a.name.toLowerCase().includes(q));
  }, [options, search]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  return (
    <View className="gap-3">
      <Input
        value={search}
        onChangeText={setSearch}
        placeholder="Search amenities"
        autoCapitalize="none"
      />
      {filtered.length === 0 ? (
        <Text className="py-2 text-sm text-muted-foreground">No amenities match your search.</Text>
      ) : (
        <View className="gap-2">
          {filtered.map((a) => {
            const isSelected = selected.has(a.id);
            return (
              <Pressable
                key={a.id}
                onPress={() => toggle(a.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={a.name}
                className={cn(
                  'flex-row items-center gap-3 rounded-xl border p-3',
                  isSelected ? 'border-brand bg-brand/10' : 'border-border bg-background',
                )}
              >
                <View className="h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-muted">
                  {a.iconUrl !== null ? (
                    <Image
                      source={{ uri: a.iconUrl }}
                      style={{ width: 20, height: 20 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <Icon
                      name={resolveAmenityIcon({ icon: a.icon, slug: a.slug, label: a.name })}
                      size={18}
                      color={mutedFg}
                    />
                  )}
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-sm font-medium text-foreground">{a.name}</Text>
                    {a.isPfAmenity ? (
                      <View className="flex-row items-center gap-0.5 rounded bg-muted px-1 py-0.5">
                        <Icon name="Globe" size={9} color={mutedFg} />
                        <Text className="text-[9px] text-muted-foreground">PF</Text>
                      </View>
                    ) : null}
                  </View>
                  {a.description !== '' ? (
                    <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={2}>
                      {a.description}
                    </Text>
                  ) : null}
                </View>
                <Checkbox checked={isSelected} onCheckedChange={() => toggle(a.id)} />
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Verify** — `pnpm exec tsc --noEmit`, `pnpm lint`.
  - Confirm the `Checkbox` atom's prop is `checked` + `onCheckedChange` (it wraps `@rn-primitives/checkbox` per CLAUDE.md); if the prop names differ, adjust + report.
  - If `Globe` rejects as `IconName`, swap to a valid Lucide key (e.g. `Building2`) and report.
- [ ] **Step 3: Commit**

```bash
git add src/features/listing-wizard/components/AmenitiesSelector.tsx
git commit -m "feat(listing-wizard): add AmenitiesSelector (search + PF badge + checkbox)"
```

---

### Task 5: `PortalsStep` component

**Files:**

- Create: `src/features/listing-wizard/components/steps/PortalsStep.tsx`

**Interfaces:**

- Consumes: `useMasterAmenities` (`../../hooks/use-master-amenities`); `AmenitiesSelector` (`../AmenitiesSelector`); `WizardCard` (`../WizardCard`); atoms `Text`; RN `ActivityIndicator`, `ScrollView`, `View`.
- Produces: `PortalsStep({ selectedAmenityIds, onSelectedChange }: Readonly<{ selectedAmenityIds: string[]; onSelectedChange: (ids: string[]) => void }>)`.

- [ ] **Step 1: Write the component**

Create `src/features/listing-wizard/components/steps/PortalsStep.tsx`:

```tsx
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { useMasterAmenities } from '../../hooks/use-master-amenities';
import { AmenitiesSelector } from '../AmenitiesSelector';
import { WizardCard } from '../WizardCard';

export function PortalsStep({
  selectedAmenityIds,
  onSelectedChange,
}: Readonly<{ selectedAmenityIds: string[]; onSelectedChange: (ids: string[]) => void }>) {
  const brand = useThemeColor('--brand');
  const { data, isLoading, isError } = useMasterAmenities();

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-4">
        <WizardCard
          icon="SquareStack"
          title="Amenities"
          description="Amenities shown on the listing and sent to Property Finder."
        >
          {isLoading ? (
            <View className="py-6">
              <ActivityIndicator color={brand} />
            </View>
          ) : isError ? (
            <Text className="py-2 text-sm text-destructive">
              Could not load amenities. Pull back and retry.
            </Text>
          ) : (
            <AmenitiesSelector
              options={data ?? []}
              selectedIds={selectedAmenityIds}
              onChange={onSelectedChange}
            />
          )}
        </WizardCard>
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Verify** — `pnpm exec tsc --noEmit` (if `SquareStack` rejects as `IconName`, swap to `Grid3x3` or `LayoutGrid` and report), `pnpm lint`.
- [ ] **Step 3: Commit**

```bash
git add src/features/listing-wizard/components/steps/PortalsStep.tsx
git commit -m "feat(listing-wizard): add PortalsStep with Amenities card"
```

---

### Task 6: Wire Portals into `CreateListingWizard`

**Files:**

- Modify: `src/features/listing-wizard/hooks/use-save-media.ts` (add `selectedAmenityIds` to `WizardContentInput`)
- Modify: `src/features/listing-wizard/components/CreateListingWizard.tsx`

**Interfaces:**

- Consumes: `PortalsStep`, `useSaveAmenities`.

- [ ] **Step 1: Add `selectedAmenityIds` to the content type**

In `src/features/listing-wizard/hooks/use-save-media.ts`, add `selectedAmenityIds: string[]` to the `WizardContentInput` interface (after `view360Link`). This is the shared content object; the media save does not send it (amenities save is separate), so no other change to that file.

- [ ] **Step 2: Wire the step + save**

In `src/features/listing-wizard/components/CreateListingWizard.tsx`:

- Import: `import { PortalsStep } from './steps/PortalsStep';` and `import { useSaveAmenities } from '../hooks/use-save-amenities';`.
- Add `selectedAmenityIds: []` to the `EMPTY_CONTENT` constant.
- Add `const saveAmenities = useSaveAmenities();` near the other hooks.
- Change the Media step's `submitMedia` success handler: after the existing re-seed + toast, `setStepIndex(3);` (advance to Portals) instead of staying.
- Add `submitAmenities`:

```tsx
const submitAmenities = () => {
  if (created === null) {
    showToast('error', 'Complete the earlier steps first.');
    return;
  }
  setPendingMode('continue');
  saveAmenities
    .mutateAsync({ created, selectedAmenityIds: content.selectedAmenityIds })
    .then(() => {
      showToast('success', 'Amenities saved');
    })
    .catch((error: unknown) => {
      showToast('error', error instanceof Error ? error.message : 'Could not save amenities.');
    })
    .finally(() => setPendingMode(null));
};
```

- Render the step body for index 3:

```tsx
{
  stepIndex === 3 ? (
    <PortalsStep
      selectedAmenityIds={content.selectedAmenityIds}
      onSelectedChange={(ids) => updateContent('selectedAmenityIds', ids)}
    />
  ) : null;
}
```

- Add the footer for index 3:

```tsx
{
  stepIndex === 3 ? (
    <WizardFooter
      onCancel={() => router.back()}
      onSaveDraft={() => {}}
      onCreate={submitAmenities}
      submittingMode={pendingMode}
      primaryLabel="Save Amenities"
      onBack={() => setStepIndex(2)}
      showSaveDraft={false}
    />
  ) : null;
}
```

- [ ] **Step 3: Verify** — `pnpm exec tsc --noEmit`, `pnpm lint` (cognitive-complexity cap 20; if `CreateListingWizard` trips it, extract the `submit*` handlers into small helpers and report).
- [ ] **Step 4: Commit**

```bash
git add src/features/listing-wizard/hooks/use-save-media.ts src/features/listing-wizard/components/CreateListingWizard.tsx
git commit -m "feat(listing-wizard): wire Portals step (Amenities) + advance from Media"
```

---

### Task 7: Migrate new-projects `AmenitiesSection` icon

**Files:**

- Modify: `src/features/new-projects/components/detail/AmenitiesSection.tsx`

- [ ] **Step 1: Use the shared icon resolver**

Read the file. It renders a static `Check` icon per amenity card (grid + modal). Replace the static `Check` with `resolveAmenityIcon` from `@/lib/amenities`, keyed off the amenity: `<Icon name={resolveAmenityIcon({ icon: a.icon, slug: a.slug, label: a.name })} ... />` at the grid card icon and (if present) the modal header icon. Keep `resolveAmenityImages` (already wired in Task 1 Step 5) for the carousel. Do not change layout/behaviour otherwise.

- [ ] **Step 2: Verify** — `pnpm exec tsc --noEmit`, `pnpm lint`.
- [ ] **Step 3: Commit**

```bash
git add src/features/new-projects/components/detail/AmenitiesSection.tsx
git commit -m "refactor(amenities): new-projects AmenitiesSection uses shared icon resolver"
```

---

### Task 8: Migrate properties amenity utils + remove dead component

**Files:**

- Modify: `src/features/properties/utils/normalize-detail.ts`
- Modify: `src/features/properties/utils/to-project-amenities.ts`
- Delete: `src/features/properties/components/detail/PropertyAmenities.tsx` (dead — confirm no importers first)

- [ ] **Step 1: Confirm the dead component**

Run `grep -rn "PropertyAmenities" src` — if the ONLY hits are its own definition/exports (no importer), delete it: `git rm src/features/properties/components/detail/PropertyAmenities.tsx`. If an importer exists, DO NOT delete — report it and skip the delete.

- [ ] **Step 2: Migrate `normalize-detail.ts`**

Read the file. In the amenity-normalization path (`toAmenities`), replace the ad-hoc name precedence with `resolveAmenityLabel({ customTitle: r.customTitle, name: ref?.name ?? r.name })`, the media mapping with `normalizeAmenityMedia(r.media ?? [])`, the visibility filter with `filterVisibleAmenities(...)`, and the sort with `sortAmenities(...)` — all from `@/lib/amenities`. Keep the produced shape (`PropertyAmenityItem`) identical (map `normalizeAmenityMedia` output back to the `PropertyMedia` fields the type expects: `{ url: mediaUrl, type: mediaType, altText }`). Behaviour must be unchanged.

- [ ] **Step 3: Migrate `to-project-amenities.ts`**

Read the file. Source the per-item `media` via `normalizeAmenityMedia(item.media ?? [])` (mapping back to the `{ id, mediaUrl, mediaType, altText, sortOrder }` shape the project type expects). Keep the rest of the adapter as-is.

- [ ] **Step 4: Verify** — `pnpm exec tsc --noEmit`, `pnpm lint`. Manually eyeball that `normalize-detail` still yields the same fields.
- [ ] **Step 5: Commit**

```bash
git add src/features/properties/utils/normalize-detail.ts src/features/properties/utils/to-project-amenities.ts
git commit -m "refactor(amenities): properties utils use shared label/media/sort helpers; drop dead PropertyAmenities"
```

(The `git rm` from Step 1, if performed, is already staged.)

---

### Task 9: Migrate listings detail `sections.tsx`

**Files:**

- Modify: `src/features/listings/components/detail/sections.tsx`

- [ ] **Step 1: Use shared resolvers**

Read the file's `AmenitiesSection` (around lines 156-202). Replace the local `isIconName`/`name in icons` check with `resolveAmenityIcon({ icon: a.amenity?.icon, slug: a.amenity?.slug, label: a.amenity?.name })`, the inline name with `resolveAmenityLabel({ customTitle: a.customTitle, name: a.amenity?.name })`, and the inline `sortOrder ?? 0` sort with `sortAmenities(...)` — all from `@/lib/amenities`. Remove the now-unused `icons` namespace import + `isIconName` helper if nothing else uses them. Keep the 8-item preview + "show all" toggle + chip UI identical.

- [ ] **Step 2: Verify** — `pnpm exec tsc --noEmit`, `pnpm lint`.
- [ ] **Step 3: Commit**

```bash
git add src/features/listings/components/detail/sections.tsx
git commit -m "refactor(amenities): listings detail section uses shared icon/label/sort helpers"
```

---

### Task 10: Migrate `projects/services.ts getProjectAmenities`

**Files:**

- Modify: `src/features/projects/services.ts`

- [ ] **Step 1: Use `filterVisibleAmenities`**

Read `getProjectAmenities` (around lines 326-342). Replace the inline `.filter((a) => a.isVisible !== false)` with `filterVisibleAmenities(...)` from `@/lib/amenities`, then map to `name` as before. No other change.

- [ ] **Step 2: Verify** — `pnpm exec tsc --noEmit`, `pnpm lint`.
- [ ] **Step 3: Commit**

```bash
git add src/features/projects/services.ts
git commit -m "refactor(amenities): projects getProjectAmenities uses shared visibility filter"
```

---

### Task 11: Migrate the compare zone (isolated, LAST)

**Files:**

- Modify: `src/features/listings/hooks/use-listing-compare-amenities.ts`
- Modify: `src/features/listings/components/detail/sections.tsx` (only if not already done in Task 9 — skip)
- (Review, likely no change) `src/features/listings/compare/compare-rows.ts`, `src/features/projects/compare/compare-rows.ts`, `src/features/listings/components/ListingCompareScreen.tsx`, `src/features/projects/components/ProjectCompareScreen.tsx`

**IMPORTANT:** These files are the active-collision zone. Before editing, run `git status` and `git log --oneline -5` to confirm the current state; if the parallel compare work changed them since this plan was written, re-read them fresh and adapt.

- [ ] **Step 1: Migrate `use-listing-compare-amenities.ts`**

Read the file. Replace its inline `a.customTitle ?? a.amenity?.name ?? 'Amenity'` name derivation with `resolveAmenityLabel({ customTitle: a.customTitle, name: a.amenity?.name })` and the inline `sortOrder ?? 0` sort with `sortAmenities(...)` from `@/lib/amenities`. Output (string[] of names) unchanged.

- [ ] **Step 2: Confirm compare-rows / CompareScreens need no change**

Read `listings/compare/compare-rows.ts`, `projects/compare/compare-rows.ts`, `ListingCompareScreen.tsx`, `ProjectCompareScreen.tsx`. These render already-resolved name strings (or counts) — they do NOT map slug/icon/label. Confirm no amenity-mapping logic remains that duplicates the shared module. If any does, migrate it with the shared helpers; otherwise leave untouched and note "no change needed" in the report.

- [ ] **Step 3: Verify** — `pnpm exec tsc --noEmit`, `pnpm lint`.
- [ ] **Step 4: Commit**

```bash
git add src/features/listings/hooks/use-listing-compare-amenities.ts
git commit -m "refactor(amenities): listing-compare-amenities uses shared label/sort helpers"
```

---

### Task 12: Manual QA

No automated tests (project rule). Run on device/simulator.

- [ ] **Step 1: Portals amenities (secondary)** — reach the wizard Portals step (Info → Description → Media "Save Media" → Portals). Search filters the list; tap rows to toggle; PF badge shows on `isPfAmenity` items; icons render (iconUrl image or Lucide). Tap **Save Amenities** → toast "Amenities saved". Network Logger: `GET /api/v1/project-public-page/amenities` (load) + `PATCH /api/v1/opportunity-listing/:id/amenities {selectedAmenityIds}` (save).
- [ ] **Step 2: Portals amenities (primary)** — primary branch → Portals → select → Save → `POST /api/v1/listing-cms/:id?section=amenities` (multipart, X-Use-FormData) with the `amenities` JSON.
- [ ] **Step 3: Regression — detail screens** — open a New Project detail, a Property (buy) detail, and a secondary Listing detail: amenity carousels/images + icons + names render exactly as before the migration (no missing images, no all-`Check` icons where a real icon should show).
- [ ] **Step 4: Regression — compare** — open project compare and listing compare: amenity chips/counts render as before.

---

## Self-Review

**Spec coverage:**

- Shared module (images/icons/label/media/sort/filter + barrel + CanonicalAmenity) → Task 1. ✓
- Migrate all consumers: new-projects icon → T7; properties utils + dead component → T8; listings detail → T9; projects service → T10; compare zone (last, isolated) → T11; the sole `amenityDefaultImages` importer repointed → T1 Step 5. ✓
- Master service + save (secondary/primary) → T2. ✓
- Hooks (master query, save mutation) → T3. ✓
- AmenitiesSelector (search, iconUrl/Lucide icon, PF badge, checkbox) → T4. ✓
- PortalsStep (index 3, Amenities card, loading/error) → T5. ✓
- Wizard wiring (content field, Media→Portals, footer, save) → T6. ✓
- Icon strategy Lucide+iconUrl fallback → T1/T4. ✓
- Out of scope (rest of Portals, custom amenity, resume hydration) → not implemented. ✓

**Placeholder scan:** New-file tasks carry full code. Migration tasks (existing files I have not fully read) give exact shared-API calls + the precise local logic to replace + a behaviour-preserving constraint — the implementer reads the file and applies the named transformation (correct approach for a refactor; no vague "handle edge cases"). ✓

**Type consistency:** `MasterAmenity` (T2) used by T3/T4/T5. `WizardCreated` (existing) used by T3. `SaveAmenitiesArgs` (T3) drives T6's `submitAmenities`. `WizardContentInput.selectedAmenityIds` (T6 S1) consumed by T6 render + save. Shared exports `resolveAmenityImages`/`resolveAmenityIcon`/`resolveAmenityLabel`/`sortAmenities`/`filterVisibleAmenities`/`normalizeAmenityMedia` (T1) consumed by T7-T11. ✓

**Known risk (documented):** Task 11 touches files the parallel compare work also edits — re-sync before editing; per-commit review diffs keep mine isolated.
