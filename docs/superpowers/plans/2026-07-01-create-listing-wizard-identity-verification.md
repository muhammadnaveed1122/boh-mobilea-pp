# Create-Listing Wizard — Identity Verification (Manual Review) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Identity Verification (Manual Review) sub-section to the Media step's Documents card — upload Emirates ID/Passport, Mark Verified/Rejected with required-on-reject notes, uploaded document visible (inline image thumbnail + tap-to-open), acting live against the owner (lead).

**Architecture:** Lead-scoped, live: the lead exists by the Media step, so the section uploads + verifies through the lead-document endpoints on button press (no wizard-save threading). Expose `leadId` from the create step into `created`, pass it to `MediaStep`, render a self-contained `IdentitySection`.

**Tech Stack:** React Native 0.81 / Expo SDK 54, NativeWind, TanStack Query, axios (`apiClient`), expo-document-picker, RN `Linking`/`Image`.

## Global Constraints

- **No test runner.** Verify every task with `pnpm exec tsc --noEmit` + `pnpm lint`. No unit tests. Manual QA at the end.
- Strict TypeScript; prop types use `Readonly<{...}>`.
- Prettier: single quotes, semicolons, trailing commas, 100-col, 2-space; `prettier-plugin-tailwindcss` sorts classes.
- Semantic Tailwind tokens only (`bg-card`, `bg-background`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `text-destructive`, `border-border`, `bg-brand`) — no hardcoded hex.
- API paths prefixed `/api/v1`. `apiClient` unwraps `{ success, data }` (returns inner `data`).
- **Multipart uploads:** append RN file objects `{ uri, name, type } as unknown as Blob` (via the existing `filePart` helper in `services.ts`); override header `{ 'Content-Type': undefined }` so RN sets the boundary. This matches `src/features/chat/api/services.ts` and the media services already in the repo.
- A parallel "listings compare" effort is committing to the same branch under `src/features/listings/*`. Touch ONLY files under `src/features/listing-wizard/`. Commit with the exact `git add` paths per task; never `git add -A`/`.` (unrelated `.gitignore`, `DatePicker.tsx`, and `src/features/listings/*` must stay out).
- Icons are Lucide keys via the `Icon` atom; if tsc rejects a key as not assignable to `IconName`, swap to a valid Lucide key and report.
- Spec: [`docs/superpowers/specs/2026-07-01-create-listing-wizard-identity-verification-design.md`](../specs/2026-07-01-create-listing-wizard-identity-verification-design.md).

---

### Task 1: Lead-document services

**Files:**

- Modify: `src/features/listing-wizard/services.ts` (append)

**Interfaces:**

- Consumes: `apiClient`; existing `filePart` helper and imported `WizardDocItem` (both already in `services.ts` from the media step).
- Produces:
  - `type DocVerifyStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'`
  - `interface IdentityDoc { id: string; fileName: string; fileUrl: string; mimeType: string }`
  - `uploadLeadDocument(leadId: string, file: WizardDocItem, notes?: string): Promise<IdentityDoc>`
  - `verifyLeadDocument(leadId: string, documentId: string, status: DocVerifyStatus): Promise<void>`
  - `updateLeadDocumentNotes(leadId: string, documentId: string, notes: string): Promise<void>`

- [ ] **Step 1: Append the services**

Append to `src/features/listing-wizard/services.ts`:

```ts
// ---------------------------------------------------------------------------
// Identity Verification (Manual Review) — lead-scoped owner documents.
// EMIRATES_ID doc: upload + verify (VERIFIED/REJECTED) + notes. Live flow.
// ---------------------------------------------------------------------------

export type DocVerifyStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface IdentityDoc {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
}

interface RawLeadDoc {
  id: string;
  fileName?: string | null;
  name?: string | null;
  fileUrl?: string | null;
  url?: string | null;
  mimeType?: string | null;
  mimetype?: string | null;
}

function mapIdentityDoc(d: RawLeadDoc): IdentityDoc {
  return {
    id: d.id,
    fileName: d.fileName ?? d.name ?? 'document',
    fileUrl: d.fileUrl ?? d.url ?? '',
    mimeType: d.mimeType ?? d.mimetype ?? '',
  };
}

/** Upload an EMIRATES_ID identity document to the owner (lead). Returns the created doc. */
export async function uploadLeadDocument(
  leadId: string,
  file: WizardDocItem,
  notes?: string,
): Promise<IdentityDoc> {
  const fd = new FormData();
  fd.append('file', filePart(file));
  fd.append('documentType', 'EMIRATES_ID');
  if (notes !== undefined && notes !== '') fd.append('notes', notes);
  const { data } = await apiClient.post<RawLeadDoc>(`/api/v1/leads/${leadId}/documents`, fd, {
    headers: { 'Content-Type': undefined },
  });
  return mapIdentityDoc(data);
}

/** Set the verification status of an owner document. */
export async function verifyLeadDocument(
  leadId: string,
  documentId: string,
  status: DocVerifyStatus,
): Promise<void> {
  await apiClient.patch(`/api/v1/leads/${leadId}/documents/${documentId}/verify`, { status });
}

/** Update the internal notes on an owner document. */
export async function updateLeadDocumentNotes(
  leadId: string,
  documentId: string,
  notes: string,
): Promise<void> {
  const fd = new FormData();
  fd.append('notes', notes);
  await apiClient.patch(`/api/v1/leads/${leadId}/documents/${documentId}`, fd, {
    headers: { 'Content-Type': undefined },
  });
}
```

- [ ] **Step 2: Verify** — `pnpm exec tsc --noEmit` (no errors), `pnpm lint` (no new errors). If `filePart` or `WizardDocItem` are not already present/imported in `services.ts`, they were added by the media step — confirm they exist before adding (they do); do not redefine them.
- [ ] **Step 3: Commit**

```bash
git add src/features/listing-wizard/services.ts
git commit -m "feat(listing-wizard): add lead-document services for identity verification"
```

---

### Task 2: `pickSingleDocument` picker

**Files:**

- Modify: `src/features/listing-wizard/media/pickers.ts` (append)

**Interfaces:**

- Consumes: the existing `getDocumentPicker()` + `nameFromUri()` helpers already in `pickers.ts`; `WizardDocItem`.
- Produces: `pickSingleDocument(): Promise<WizardDocItem | null>`.

- [ ] **Step 1: Append the picker**

Append to `src/features/listing-wizard/media/pickers.ts`:

```ts
/** Pick a single document. Returns null on cancel or when the native module is unavailable. */
export async function pickSingleDocument(): Promise<WizardDocItem | null> {
  const mod = getDocumentPicker();
  if (!mod) return null;
  const res = await mod.getDocumentAsync({
    multiple: false,
    copyToCacheDirectory: true,
    type: [
      'image/*',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  });
  if (res.canceled || !res.assets || res.assets.length === 0) return null;
  const a = res.assets[0]!;
  return {
    uri: a.uri,
    name: a.name ?? nameFromUri(a.uri, 'document'),
    mimeType: a.mimeType ?? 'application/octet-stream',
  };
}
```

- [ ] **Step 2: Verify** — `pnpm exec tsc --noEmit`, `pnpm lint`.
- [ ] **Step 3: Commit**

```bash
git add src/features/listing-wizard/media/pickers.ts
git commit -m "feat(listing-wizard): add pickSingleDocument picker"
```

---

### Task 3: `use-identity-verification` hook

**Files:**

- Create: `src/features/listing-wizard/hooks/use-identity-verification.ts`

**Interfaces:**

- Consumes: `uploadLeadDocument`, `verifyLeadDocument`, `updateLeadDocumentNotes`, types `DocVerifyStatus`/`IdentityDoc` (`../services`, Task 1); `WizardDocItem` (`../media/types`).
- Produces:
  - `useIdentityVerification(): { uploadAndVerify: (args: { leadId: string; file: WizardDocItem; existingId?: string; status: 'VERIFIED' | 'REJECTED'; notes: string }) => Promise<IdentityDoc | null>; updateNotes: (leadId: string, documentId: string, notes: string) => Promise<void>; isBusy: boolean }`

- [ ] **Step 1: Write the hook**

Create `src/features/listing-wizard/hooks/use-identity-verification.ts`:

```ts
import { useState } from 'react';

import type { WizardDocItem } from '../media/types';
import {
  type IdentityDoc,
  updateLeadDocumentNotes,
  uploadLeadDocument,
  verifyLeadDocument,
} from '../services';

/**
 * Manual-review identity actions against the owner (lead). `uploadAndVerify` uploads the file
 * first when there is no `existingId` (returns the new doc), otherwise re-verifies the existing
 * doc (returns null). `isBusy` reflects any in-flight call so the UI can disable controls.
 */
export function useIdentityVerification() {
  const [isBusy, setIsBusy] = useState(false);

  const uploadAndVerify = async (args: {
    leadId: string;
    file: WizardDocItem;
    existingId?: string;
    status: 'VERIFIED' | 'REJECTED';
    notes: string;
  }): Promise<IdentityDoc | null> => {
    setIsBusy(true);
    try {
      if (args.existingId === undefined) {
        const doc = await uploadLeadDocument(
          args.leadId,
          args.file,
          args.notes === '' ? undefined : args.notes,
        );
        await verifyLeadDocument(args.leadId, doc.id, args.status);
        return doc;
      }
      await verifyLeadDocument(args.leadId, args.existingId, args.status);
      return null;
    } finally {
      setIsBusy(false);
    }
  };

  const updateNotes = async (leadId: string, documentId: string, notes: string): Promise<void> => {
    setIsBusy(true);
    try {
      await updateLeadDocumentNotes(leadId, documentId, notes);
    } finally {
      setIsBusy(false);
    }
  };

  return { uploadAndVerify, updateNotes, isBusy };
}
```

- [ ] **Step 2: Verify** — `pnpm exec tsc --noEmit`, `pnpm lint`.
- [ ] **Step 3: Commit**

```bash
git add src/features/listing-wizard/hooks/use-identity-verification.ts
git commit -m "feat(listing-wizard): add use-identity-verification hook"
```

---

### Task 4: `IdentitySection` component

**Files:**

- Create: `src/features/listing-wizard/components/IdentitySection.tsx`

**Interfaces:**

- Consumes: `useIdentityVerification` (Task 3); `pickSingleDocument` (Task 2); types `DocVerifyStatus`/`IdentityDoc` (`../services`); `WizardDocItem` (`../media/types`); `showToast` (`@/lib/toast/toast.store`); atoms `Icon`(+`IconName`), `Label`, `Text`, `Textarea`, `Button`; `cn` (`@/lib/utils`); `useThemeColor` (`@theme`); RN `Image`, `Linking`, `Pressable`, `View`.
- Produces: `IdentitySection({ leadId }: Readonly<{ leadId: string }>)`.

- [ ] **Step 1: Write the component**

Create `src/features/listing-wizard/components/IdentitySection.tsx`:

```tsx
import { useState } from 'react';
import { Image, Linking, Pressable, View } from 'react-native';

import { Button } from '@/components/atoms/Button';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { Label } from '@/components/atoms/Label';
import { Text } from '@/components/atoms/Text';
import { Textarea } from '@/components/atoms/Textarea';
import { showToast } from '@/lib/toast/toast.store';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';

import { useIdentityVerification } from '../hooks/use-identity-verification';
import { pickSingleDocument } from '../media/pickers';
import type { WizardDocItem } from '../media/types';
import type { DocVerifyStatus, IdentityDoc } from '../services';

function isImageFile(mime: string, name: string): boolean {
  return mime.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(name);
}

function docIcon(mime: string, name: string): IconName {
  if (isImageFile(mime, name)) return 'Image';
  if (mime === 'application/pdf' || /\.pdf$/i.test(name)) return 'FileText';
  return 'File';
}

export function IdentitySection({ leadId }: Readonly<{ leadId: string }>) {
  const brand = useThemeColor('--brand');
  const brandFg = useThemeColor('--brand-foreground');
  const destructive = useThemeColor('--destructive');
  const mutedFg = useThemeColor('--muted-foreground');
  const { uploadAndVerify, updateNotes, isBusy } = useIdentityVerification();

  const [pendingFile, setPendingFile] = useState<WizardDocItem | null>(null);
  const [uploaded, setUploaded] = useState<IdentityDoc | null>(null);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<DocVerifyStatus>('PENDING');

  const displayName = pendingFile?.name ?? uploaded?.fileName;
  const displayMime = pendingFile?.mimeType ?? uploaded?.mimeType ?? '';
  const previewUri =
    uploaded?.fileUrl !== undefined && uploaded.fileUrl !== ''
      ? uploaded.fileUrl
      : pendingFile?.uri;
  const hasFile = pendingFile !== null || uploaded !== null;

  const statusMeta: Record<DocVerifyStatus, { label: string; icon: IconName; color: string }> = {
    PENDING: { label: 'Pending', icon: 'Clock', color: mutedFg },
    VERIFIED: { label: 'Verified', icon: 'CircleCheck', color: brand },
    REJECTED: { label: 'Rejected', icon: 'CircleX', color: destructive },
  };

  const pick = async () => {
    const f = await pickSingleDocument();
    if (f === null) return;
    setPendingFile(f);
    setUploaded(null);
    setStatus('PENDING');
  };

  const openDoc = async () => {
    const url = previewUri;
    if (url === undefined) return;
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) {
        showToast('error', 'Cannot open this document.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      showToast('error', 'Cannot open this document.');
    }
  };

  const mark = async (next: 'VERIFIED' | 'REJECTED') => {
    if (!hasFile || (pendingFile === null && uploaded === null)) return;
    if (next === 'REJECTED' && notes.trim() === '') {
      showToast('error', 'Add internal notes before rejecting.');
      return;
    }
    const fileForUpload: WizardDocItem = pendingFile ?? {
      uri: uploaded?.fileUrl ?? '',
      name: uploaded?.fileName ?? 'document',
      mimeType: uploaded?.mimeType ?? 'application/octet-stream',
    };
    try {
      const doc = await uploadAndVerify({
        leadId,
        file: fileForUpload,
        existingId: uploaded?.id,
        status: next,
        notes,
      });
      if (doc !== null) {
        setUploaded(doc);
        setPendingFile(null);
      }
      setStatus(next);
      showToast('success', next === 'VERIFIED' ? 'Identity verified' : 'Identity marked rejected');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Could not update identity.');
    }
  };

  const sMeta = statusMeta[status];

  return (
    <View className="gap-3 rounded-xl border border-border bg-background p-3">
      <View className="gap-1">
        <Text className="text-sm font-medium text-foreground">Identity Verification</Text>
        <Text className="text-xs text-muted-foreground">
          Complete identity verification with Passport or Emirates ID.
        </Text>
      </View>

      {hasFile ? (
        <Pressable
          onPress={openDoc}
          accessibilityRole="button"
          accessibilityLabel="Open document"
          className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-2.5 active:opacity-80"
        >
          <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-md bg-muted">
            {previewUri !== undefined && isImageFile(displayMime, displayName ?? '') ? (
              <Image source={{ uri: previewUri }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Icon name={docIcon(displayMime, displayName ?? '')} size={20} color={mutedFg} />
            )}
          </View>
          <View className="flex-1">
            <Text className="text-sm text-foreground" numberOfLines={1}>
              {displayName}
            </Text>
            <View className="mt-1 flex-row items-center gap-1">
              <Icon name={sMeta.icon} size={12} color={sMeta.color} />
              <Text className="text-xs" style={{ color: sMeta.color }}>
                {sMeta.label}
              </Text>
            </View>
          </View>
        </Pressable>
      ) : (
        <Pressable
          onPress={pick}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel="Add Emirates ID or Passport"
          className="flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background py-6 active:opacity-80"
        >
          <Icon name="Plus" size={18} color={brand} />
          <Text className="text-sm font-medium text-foreground">Add Emirates ID / Passport</Text>
        </Pressable>
      )}

      {hasFile ? (
        <View className="flex-row gap-3">
          <Button
            variant="outline"
            className={cn('flex-1 border-brand', status === 'VERIFIED' && 'bg-brand')}
            disabled={isBusy || status === 'VERIFIED'}
            onPress={() => mark('VERIFIED')}
          >
            <Text style={{ color: status === 'VERIFIED' ? brandFg : brand }}>
              {status === 'VERIFIED' ? 'Verified' : 'Mark Verified'}
            </Text>
          </Button>
          <Button
            variant="outline"
            className={cn('flex-1 border-destructive', status === 'REJECTED' && 'bg-destructive')}
            disabled={isBusy || status === 'REJECTED'}
            onPress={() => mark('REJECTED')}
          >
            <Text style={{ color: status === 'REJECTED' ? '#ffffff' : destructive }}>
              {status === 'REJECTED' ? 'Rejected' : 'Mark Rejected'}
            </Text>
          </Button>
        </View>
      ) : null}

      <View className="gap-1.5">
        <Label>
          Internal Notes
          {status === 'REJECTED' ? <Text className="text-destructive"> *</Text> : null}
        </Label>
        <Textarea
          value={notes}
          onChangeText={setNotes}
          onBlur={() => {
            if (uploaded !== null) void updateNotes(leadId, uploaded.id, notes);
          }}
          placeholder="Enter any additional notes here..."
          numberOfLines={3}
          editable={!isBusy}
        />
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Verify** — `pnpm exec tsc --noEmit`, `pnpm lint` (sonarjs cognitive-complexity cap 20).
  - If any icon key (`Image`, `FileText`, `File`, `Clock`, `CircleCheck`, `CircleX`, `Plus`) is rejected as `IconName`, swap to a valid Lucide key (e.g. `File`→`FileText`, `CircleCheck`→`CheckCircle2`, `CircleX`→`XCircle`) and report.
  - Confirm the `Button` atom accepts `onPress`, `variant`, `className`, `disabled` and renders `Text` children (used across the wizard footer). Confirm `Textarea` accepts `onBlur` + `editable` (it forwards `TextInputProps`). If `useThemeColor('--brand-foreground')` cannot be called inside JSX (hooks-in-render rule), hoist it to a top-level `const brandFg = useThemeColor('--brand-foreground')` and use that. Adjust + report.
  - The literal `'#ffffff'` on the rejected button label is the one allowed non-token color (white text on the destructive fill, matching the media Play-badge precedent); keep it.

- [ ] **Step 3: Commit**

```bash
git add src/features/listing-wizard/components/IdentitySection.tsx
git commit -m "feat(listing-wizard): add IdentitySection manual-review component"
```

---

### Task 5: Expose `leadId` from the create step

**Files:**

- Modify: `src/features/listing-wizard/hooks/use-create-listing.ts`
- Modify: `src/features/listing-wizard/components/CreateListingWizard.tsx`

**Interfaces:**

- Produces: `CreateListingResult` opportunity variant becomes `{ kind: 'opportunity'; id: string; leadId: string }`; `created.leadId` populated on the secondary path.

- [ ] **Step 1: Return `leadId` from the mutation**

In `src/features/listing-wizard/hooks/use-create-listing.ts`, change the result type and both secondary returns:

```ts
export type CreateListingResult =
  | { kind: 'listing'; id: string }
  | { kind: 'opportunity'; id: string; leadId: string };
```

In the `branch === 'secondary'` block, the reuse-property early return and the final return must both include `leadId` (the `leadId` local is already computed above them):

```ts
if (reuseProperty) {
  return { kind: 'opportunity', id: values.existingPropertyId.trim(), leadId };
}

const opportunity = await createOpportunity(buildOpportunityBody(values, leadId));
return { kind: 'opportunity', id: opportunity.id, leadId };
```

- [ ] **Step 2: Populate `created.leadId` in the wizard**

In `src/features/listing-wizard/components/CreateListingWizard.tsx`, the `informationForm` result mapping currently builds the opportunity branch without `leadId`. Update it:

```ts
const next: WizardCreated =
  result.kind === 'listing'
    ? { branch, listingId: result.id }
    : { branch, opportunityId: result.id, leadId: result.leadId };
```

- [ ] **Step 3: Verify** — `pnpm exec tsc --noEmit` (the `WizardCreated.leadId` field already exists, so this only populates it), `pnpm lint`.
- [ ] **Step 4: Commit**

```bash
git add src/features/listing-wizard/hooks/use-create-listing.ts src/features/listing-wizard/components/CreateListingWizard.tsx
git commit -m "feat(listing-wizard): expose leadId from create step into wizard state"
```

---

### Task 6: Wire `IdentitySection` into the Documents card

**Files:**

- Modify: `src/features/listing-wizard/components/steps/MediaStep.tsx`
- Modify: `src/features/listing-wizard/components/CreateListingWizard.tsx`

**Interfaces:**

- Consumes: `IdentitySection` (Task 4); `created.leadId` (Task 5).
- Produces: `MediaStepProps` gains `leadId?: string`.

- [ ] **Step 1: Add `leadId` to `MediaStep` and render `IdentitySection`**

In `src/features/listing-wizard/components/steps/MediaStep.tsx`:

Add the import:

```tsx
import { IdentitySection } from '../IdentitySection';
```

Add `leadId?: string` to `MediaStepProps`:

```ts
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
  leadId?: string;
}
```

Destructure `leadId` in the component signature, and inside the Documents `WizardCard` render `IdentitySection` between `DocumentPickerField` and the Notes block:

```tsx
export function MediaStep({
  content,
  onContentChange,
  showDocuments,
  documents,
  onDocumentsChange,
  notes,
  onNotesChange,
  leadId,
}: Readonly<MediaStepProps>) {
```

```tsx
<WizardCard
  icon="FileText"
  title="Documents"
  description="Upload any supporting documents (title deed, evidence, contracts, etc.) — all optional."
>
  <DocumentPickerField items={documents} onChange={onDocumentsChange} />
  {leadId !== undefined ? <IdentitySection leadId={leadId} /> : null}
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
```

- [ ] **Step 2: Pass `leadId` from the wizard**

In `src/features/listing-wizard/components/CreateListingWizard.tsx`, the step-2 `MediaStep` render gets the lead id from `created`:

```tsx
<MediaStep
  content={content}
  onContentChange={updateContent}
  showDocuments={created?.branch === 'secondary'}
  documents={documents}
  onDocumentsChange={setDocuments}
  notes={notes}
  onNotesChange={setNotes}
  leadId={created?.leadId}
/>
```

- [ ] **Step 3: Verify** — `pnpm exec tsc --noEmit`, `pnpm lint`.
- [ ] **Step 4: Commit**

```bash
git add src/features/listing-wizard/components/steps/MediaStep.tsx src/features/listing-wizard/components/CreateListingWizard.tsx
git commit -m "feat(listing-wizard): render IdentitySection in Documents card"
```

---

### Task 7: Manual QA

No automated tests (project rule). Run on device/simulator.

- [ ] **Step 1: Launch** — `pnpm ios` (or `pnpm android`); sign in with listing-create permission; open Create Listing.
- [ ] **Step 2: Reach the Documents card**
  1. Step 1: pick a **secondary** completion status + required owner/property fields → **Create & Continue**.
  2. Step 2 (Description): Title + Description → **Save & Continue** → Media step.
  3. Scroll to the **Documents** card → the **Identity Verification** sub-section is present. (Primary branch: whole Documents card hidden — confirm.)
- [ ] **Step 3: Manual review — verify path**
  1. Tap **Add Emirates ID / Passport** → pick an image → file-summary row shows an inline thumbnail + name + "Pending".
  2. Tap the row → the document opens (image viewer / browser).
  3. Tap **Mark Verified** → toast "Identity verified"; status badge → "Verified"; buttons reflect state.
  4. Network Logger (`/(app)/network-logs`): `POST /api/v1/leads/:leadId/documents` (multipart, 201) then `PATCH /api/v1/leads/:leadId/documents/:docId/verify` `{status:'VERIFIED'}` (200).
- [ ] **Step 4: Manual review — reject path + notes**
  1. Re-pick a PDF → row shows a file icon (not image) + name + "Pending".
  2. Tap **Mark Rejected** with empty notes → toast "Add internal notes before rejecting."; no request.
  3. Enter notes, tap **Mark Rejected** → toast; status "Rejected"; the `*` shows on the Notes label.
  4. Edit notes and blur → `PATCH /api/v1/leads/:leadId/documents/:docId` with `notes` fires.
- [ ] **Step 5: Multipart + Linking sanity** — if upload returns 400/415 or the server sees an empty file, confirm the request carries a `multipart/form-data; boundary=…` Content-Type (services set `Content-Type: undefined` so RN adds it). If tap-to-open fails on some file types, confirm `Linking.canOpenURL` handles the `file://`/`https://` uri.

---

## Self-Review

**Spec coverage:**

- Lead-document services (upload/verify/update-notes) → Task 1. ✓
- Single-document picker → Task 2. ✓
- `use-identity-verification` (upload+verify, update notes, busy) → Task 3. ✓
- `IdentitySection` manual-review UI (pick, mark verified/rejected, notes required-on-reject) → Task 4. ✓
- Document visibility (inline image thumbnail + tap-to-open via `Linking`, status badge) → Task 4 file-summary row. ✓
- `leadId` plumbing (use-create-listing return + `created.leadId`) → Task 5. ✓
- Wire into Documents card, secondary + leadId present → Task 6. ✓
- Live flow (act on Mark buttons, entity exists) → Tasks 3–4. ✓
- Out of scope (Send Verification Link, UAE Pass, result card, resume hydration, opportunity-scope) → not implemented. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step has full code. ✓

**Type consistency:** `DocVerifyStatus`/`IdentityDoc` (Task 1) used by Tasks 3–4. `WizardDocItem` reused. `uploadAndVerify`/`updateNotes`/`isBusy` (Task 3) consumed by Task 4. `CreateListingResult` opportunity variant + `leadId` (Task 5) consumed by Task 6's `created?.leadId`. `MediaStepProps.leadId` (Task 6) matches the wizard's pass-through. Service names match between Task 1 defs and Task 3 imports (`uploadLeadDocument`, `verifyLeadDocument`, `updateLeadDocumentNotes`). ✓

**Known limitations (documented):** No resume hydration — the section starts empty each session (create-only flow). Re-marking an already-uploaded doc (verified↔rejected) re-verifies the same doc id (no duplicate upload) via the `existingId` path.
