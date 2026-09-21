# Create-Listing Wizard — Identity Verification (Manual Review), Documents card

**Date:** 2026-07-01
**Repo:** `boh-mobile`
**Depends on:** [`2026-07-01-create-listing-wizard-media-documents-step-design.md`](./2026-07-01-create-listing-wizard-media-documents-step-design.md)

## Goal

Add the **Identity Verification** sub-section (Manual Review only) to the Media step's Documents
card, at behavioural parity with web's manual-review tab. It is the last unbuilt part of web's
Documents block (supporting files + notes already shipped). Secondary branch only.

**Scope (agreed):** Manual Review — pick Emirates ID/Passport → Mark Verified / Mark Rejected
(+ internal notes, notes required to reject), acting live against the owner (lead). The uploaded
document is visible (inline thumbnail for images; tap-to-open for any file).
**Deferred:** Send Verification Link (provider Entrust/UAE Pass, generate/copy/share), verification
result card, resume hydration of existing identity docs.

## Web reference

- `WizardIdentitySection` → `IdentityVerificationSection` (manual tab): upload dropzone, Mark
  Verified / Mark Rejected, internal notes (required on reject), file summary with tap-to-preview
  (`FilePreviewDialog`). Identity is scoped to the LEAD (owner).

## Current mobile state

- Media step (step 3) shipped: Documents card renders `DocumentPickerField` (supporting →
  GENERAL_DOCUMENT) + Notes `Textarea`, secondary only.
- `MediaStep` props: `content`, `onContentChange`, `showDocuments`, `documents`, `onDocumentsChange`,
  `notes`, `onNotesChange`. No `leadId` yet.
- `WizardCreated` (`hooks/use-save-content.ts`) already declares an optional `leadId?: string`, but
  it is never populated — `use-create-listing` returns only the opportunity id for secondary.
- Lead-scoped document endpoints exist on the backend; no mobile services for them yet.
- `expo-document-picker` + `expo-image-picker` present; RN `Linking` is built-in.

## Expose `leadId` (plumbing)

- `use-create-listing.ts`: the secondary result also carries the lead id (created, or the reused
  `existingOwnerId`). Change `CreateListingResult` so the opportunity variant is
  `{ kind: 'opportunity'; id: string; leadId: string }`. Populate `leadId` on both the
  create-lead and reuse-owner paths.
- `CreateListingWizard.tsx`: when mapping the create result, set `created.leadId` from
  `result.leadId` (opportunity variant). Pass `created.leadId` into `MediaStep`.

## Backend contract (lead-scoped, live; `/api/v1`, apiClient unwraps `{ success, data }`)

FormData files are RN objects `{ uri, name, type } as unknown as Blob`; header override
`{ 'Content-Type': undefined }` (RN sets the boundary), matching the chat/media pattern.

- **Upload** — `POST /api/v1/leads/:leadId/documents` (multipart): `file`,
  `documentType='EMIRATES_ID'`, `notes?` (omit when empty) → returns the document; map to
  `{ id: string; fileName: string; fileUrl: string; mimeType: string }` (read defensively:
  `id`, `fileName`/`name`, `fileUrl`/`url`, `mimeType`/`mimetype`).
- **Verify** — `PATCH /api/v1/leads/:leadId/documents/:documentId/verify` JSON body
  `{ status: 'VERIFIED' | 'REJECTED' }`.
- **Update notes** — `PATCH /api/v1/leads/:leadId/documents/:documentId` (multipart): `notes`.

Status type: `DocVerifyStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'`.

## Flow (manual review, live entity)

Local component state: `pendingFile: WizardDocItem | null`, `uploaded: { id; fileName; fileUrl;
mimeType } | null`, `notes: string`, `status: DocVerifyStatus` (default `'PENDING'`), `busy`.

- **Pick** — single document via `expo-document-picker` (`type: ['image/*','application/pdf',
'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']`).
  Sets `pendingFile`, resets `status` to `'PENDING'`, clears any prior `uploaded`.
- **Mark Verified** — if not yet uploaded: `uploadLeadDocument(leadId, file, notes)` → store
  `uploaded`; then `verifyLeadDocument(leadId, uploaded.id, 'VERIFIED')`; set `status='VERIFIED'`.
  If already uploaded, just verify. Disabled when no file / busy / already VERIFIED.
- **Mark Rejected** — require `notes.trim()` (else toast "Add internal notes before rejecting.");
  upload if needed → `verifyLeadDocument(..., 'REJECTED')`; set `status='REJECTED'`. Disabled when
  no file / busy / already REJECTED.
- **Notes** — `onBlur`: if `uploaded !== null` and notes changed, `updateLeadDocumentNotes(leadId,
uploaded.id, notes)`. Notes label shows a required `*` while `status==='REJECTED'`.
- Errors → error toast; state unchanged. Success of a mark → success toast ("Identity verified" /
  "Identity marked rejected").

## Document visibility (required)

After a file is picked or uploaded, render a **file-summary row**:

- Type icon (image / pdf / doc via extension), the file name, and the current status
  (Pending / Verified / Rejected) as an icon+text badge (never color-only).
- If the file is an image (mime starts `image/` or image extension), render an **inline thumbnail**
  (`<Image>`); the preview uri is `uploaded.fileUrl ?? pendingFile.uri`.
- The whole row is a `Pressable` (`accessibilityRole="button"`, label "Open document") that opens
  the document: `Linking.openURL(uploaded?.fileUrl ?? pendingFile.uri)`. Guard with
  `Linking.canOpenURL`; on failure toast "Cannot open this document.".

## Components / files (new, under `src/features/listing-wizard/`)

- `services.ts` (append):
  - `uploadLeadDocument(leadId: string, file: WizardDocItem, notes?: string): Promise<IdentityDoc>`
  - `verifyLeadDocument(leadId: string, documentId: string, status: DocVerifyStatus): Promise<void>`
  - `updateLeadDocumentNotes(leadId: string, documentId: string, notes: string): Promise<void>`
  - types `DocVerifyStatus`, `IdentityDoc { id; fileName; fileUrl; mimeType }`.
- `hooks/use-identity-verification.ts` — wraps the three calls:
  - `uploadAndVerify(args: { leadId; file: WizardDocItem; existingId?: string; status: 'VERIFIED' | 'REJECTED'; notes: string }): Promise<IdentityDoc>` (uploads when `existingId` absent, then verifies; returns the doc).
  - `updateNotes(leadId, documentId, notes): Promise<void>`.
  - `isBusy: boolean`. (Built on `useMutation`s so `isBusy` reflects in-flight state.)
- `media/pickers.ts` (append): `pickSingleDocument(): Promise<WizardDocItem | null>` — single-file
  variant (defensive, like `pickDocumentsMulti`).
- `components/IdentitySection.tsx` — `IdentitySection({ leadId }: Readonly<{ leadId: string }>)`.
  Manual-review UI as above.
- `components/steps/MediaStep.tsx` (modify): add optional prop `leadId?: string`; inside the
  Documents `WizardCard`, after `DocumentPickerField` and before the Notes `Textarea`, render
  `{leadId ? <IdentitySection leadId={leadId} /> : null}`.
- `components/CreateListingWizard.tsx` (modify): populate `created.leadId`; pass
  `leadId={created?.leadId}` to `MediaStep`.
- `hooks/use-create-listing.ts` (modify): return `leadId` for secondary.

## UI (ui-ux-pro-max)

- Sub-card inside Documents: label "Identity Verification" + helper "Complete identity verification
  with Passport or Emirates ID." (verbatim-ish from web).
- Pick tile reuses the dashed-border add pattern from `DocumentPickerField`/`SingleImageField`.
- Two outline action buttons: Mark Verified (brand/green accent) and Mark Rejected (destructive
  accent); show the resolved state ("Verified"/"Rejected") when set.
- Status conveyed by icon + text (CheckCircle / XCircle / Clock), not color alone.
- Internal notes `Textarea` (`numberOfLines={3}`), required `*` when rejected.
- Semantic tokens only (no hex); controls ≥44pt; `accessibilityLabel` on pick/open/verify/reject.

## Out of scope

- Send Verification Link flow (provider select, generate/copy/share via Email/WhatsApp), UAE Pass.
- Provider verification-detail/result card.
- Resume hydration of an existing identity document (create-only flow; starts empty).
- Full in-app file preview dialog (we use inline image thumbnail + `Linking.openURL`).
- Opportunity-scoped identity (we scope to the lead, matching web).

## Open items (resolved)

- **Target:** Identity Verification, Manual Review only.
- **Scope of entity:** lead (owner) — expose `leadId` from the create step.
- **Uploaded document visible:** yes — file-summary row, inline image thumbnail, tap-to-open via `Linking`.
- **Live vs deferred save:** live (entity exists at the Media step); acts on Mark buttons.
